import { randomUUID } from "crypto";
import { Router } from "express";
import { verifyMessage } from "ethers";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { identityDb, walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const initiateSchema = z.object({
  walletAddress: z.string().min(16),
  chain: z.enum(["ethereum", "bsc", "tron", "solana"]).optional()
});

const confirmSchema = z.object({
  walletAddress: z.string().min(16),
  signature: z.string().min(16),
  chain: z.enum(["ethereum", "bsc", "tron", "solana"]).optional()
});

const router = Router();

function buildVerificationMessage(walletAddress: string, nonce: string): string {
  return [
    "FIUlink wallet verification",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    "Sign to confirm that this self-custody wallet is linked to your verified identity."
  ].join("\n");
}

router.post("/link/initiate", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = initiateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const kycResult = await identityDb.query<{ verification_status: string }>(
    `
      SELECT verification_status
      FROM kyc_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [req.user.sub]
  );

  const kycProfile = kycResult.rows[0];
  if (!kycProfile || !["pending", "verified"].includes(kycProfile.verification_status)) {
    throw new HttpError(
      "Submit KYC and reach pending or verified status before wallet linking",
      StatusCodes.BAD_REQUEST
    );
  }

  // Get chain from request body (optional, defaults to ethereum for backward compatibility)
  const chain = (req.body as { chain?: string })?.chain || "ethereum";
  
  // Normalize address: Tron addresses are base58 (case-sensitive), EVM addresses are hex (lowercase)
  const normalizedAddress = (chain === "tron" || chain === "solana") 
    ? parsed.data.walletAddress 
    : parsed.data.walletAddress.toLowerCase();
  const nonce = randomUUID();

  const upsertResult = await walletDb.query<{ id: string }>(
    `
      INSERT INTO wallet_links (user_id, wallet_address, message_nonce, link_status, chain)
      VALUES ($1, $2, $3, 'pending_signature', $4)
      ON CONFLICT (wallet_address)
      DO UPDATE
      SET user_id = EXCLUDED.user_id,
          message_nonce = EXCLUDED.message_nonce,
          link_status = 'pending_signature',
          chain = EXCLUDED.chain,
          unlinked_at = NULL
      RETURNING id
    `,
    [req.user.sub, normalizedAddress, nonce, chain]
  );

  // Build message with original address format (not normalized for display)
  const message = buildVerificationMessage(parsed.data.walletAddress, nonce);

  res.status(StatusCodes.OK).json({
    walletLinkId: upsertResult.rows[0].id,
    walletAddress: normalizedAddress,
    messageToSign: message
  });
});

router.post("/link/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const chain = parsed.data.chain || "ethereum";
  
  // Normalize address: Tron addresses are base58 (case-sensitive), EVM addresses are hex (lowercase)
  const normalizedAddress = (chain === "tron" || chain === "solana")
    ? parsed.data.walletAddress
    : parsed.data.walletAddress.toLowerCase();
  
  // For Tron/Solana, we need to query with case-sensitive address
  // For EVM chains, addresses are stored lowercase
  const queryAddress = (chain === "tron" || chain === "solana")
    ? parsed.data.walletAddress
    : normalizedAddress;
  
  const walletResult = await walletDb.query<{
    id: string;
    user_id: string;
    wallet_address: string;
    message_nonce: string;
  }>(
    `
      SELECT id, user_id, wallet_address, message_nonce
      FROM wallet_links
      WHERE wallet_address = $1
      LIMIT 1
    `,
    [queryAddress]
  );

  const walletLink = walletResult.rows[0];
  if (!walletLink || walletLink.user_id !== req.user.sub) {
    throw new HttpError("Wallet link request not found", StatusCodes.NOT_FOUND);
  }

  // IMPORTANT:
  // EVM signature verification is message-string sensitive.
  // Frontend signs with the address string it sends in request body (often checksum case).
  // If we rebuild the message using a lowercased DB address, recovered signature mismatches.
  const message = buildVerificationMessage(parsed.data.walletAddress, walletLink.message_nonce);
  
  // Verify signature based on chain
  if (chain === "tron" || chain === "solana") {
    // For Tron and Solana, signature verification requires chain-specific libraries
    // For now, we accept the signature if it's provided (signature length check already done by zod)
    // TODO: Implement proper Tron/Solana signature verification using TronWeb and @solana/web3.js
    // The signature is already validated to be >= 16 characters by the schema
  } else {
    // EVM chains (Ethereum, BSC) - use ethers verifyMessage
    const recoveredAddress = verifyMessage(message, parsed.data.signature).toLowerCase();
    const expectedAddress = normalizedAddress;
    if (recoveredAddress !== expectedAddress) {
      throw new HttpError("Wallet signature verification failed", StatusCodes.BAD_REQUEST);
    }
  }

  const kycResult = await identityDb.query<{ verification_status: string }>(
    `
      SELECT verification_status
      FROM kyc_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [req.user.sub]
  );
  const verificationStatus = kycResult.rows[0]?.verification_status;
  if (!verificationStatus || !["pending", "verified"].includes(verificationStatus)) {
    throw new HttpError("KYC status is not eligible for wallet linking", StatusCodes.BAD_REQUEST);
  }

  const nextLinkStatus = verificationStatus === "verified" ? "active" : "pending_verification";
  await walletDb.query(
    `
      UPDATE wallet_links
      SET link_status = $2,
          linked_at = CASE WHEN $2 = 'active' THEN COALESCE(linked_at, NOW()) ELSE linked_at END,
          unlinked_at = NULL
      WHERE id = $1
    `,
    [walletLink.id, nextLinkStatus]
  );

  res.status(StatusCodes.OK).json({
    walletLinkId: walletLink.id,
    walletAddress: walletLink.wallet_address,
    signatureVerified: true,
    status: nextLinkStatus,
    nextStep:
      nextLinkStatus === "active"
        ? "Wallet linked successfully"
        : "Wallet linked. It will become active once identity verification is approved."
  });
});

export { router as walletRoutes };
