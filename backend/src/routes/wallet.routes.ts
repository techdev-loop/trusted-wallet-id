import { randomUUID } from "crypto";
import { Router } from "express";
import { verifyMessage } from "ethers";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { identityDb, walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const initiateSchema = z.object({
  walletAddress: z.string().min(16)
});

const confirmSchema = z.object({
  walletAddress: z.string().min(16),
  signature: z.string().min(16)
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
  if (!kycProfile || kycProfile.verification_status !== "verified") {
    throw new HttpError("Complete KYC verification before wallet linking", StatusCodes.BAD_REQUEST);
  }

  const normalizedAddress = parsed.data.walletAddress.toLowerCase();
  const nonce = randomUUID();

  const upsertResult = await walletDb.query<{ id: string }>(
    `
      INSERT INTO wallet_links (user_id, wallet_address, message_nonce, link_status)
      VALUES ($1, $2, $3, 'pending_payment')
      ON CONFLICT (wallet_address)
      DO UPDATE
      SET user_id = EXCLUDED.user_id,
          message_nonce = EXCLUDED.message_nonce,
          link_status = 'pending_payment',
          unlinked_at = NULL
      RETURNING id
    `,
    [req.user.sub, normalizedAddress, nonce]
  );

  const message = buildVerificationMessage(normalizedAddress, nonce);

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

  const normalizedAddress = parsed.data.walletAddress.toLowerCase();
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
    [normalizedAddress]
  );

  const walletLink = walletResult.rows[0];
  if (!walletLink || walletLink.user_id !== req.user.sub) {
    throw new HttpError("Wallet link request not found", StatusCodes.NOT_FOUND);
  }

  const message = buildVerificationMessage(walletLink.wallet_address, walletLink.message_nonce);
  const recoveredAddress = verifyMessage(message, parsed.data.signature).toLowerCase();
  if (recoveredAddress !== walletLink.wallet_address) {
    throw new HttpError("Wallet signature verification failed", StatusCodes.BAD_REQUEST);
  }

  res.status(StatusCodes.OK).json({
    walletLinkId: walletLink.id,
    walletAddress: walletLink.wallet_address,
    signatureVerified: true,
    nextStep: "Pay 10 USDT fee"
  });
});

export { router as walletRoutes };
