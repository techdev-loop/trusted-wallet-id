import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { sendDepositTelegramNotification } from "../services/telegram.service.js";

const router = Router();

const paymentSchema = z.object({
  walletAddress: z.string().min(16),
  txHash: z.string().min(20),
  amountUsdt: z.coerce.number(),
  chain: z.enum(["ethereum", "bsc", "tron", "solana"]).optional()
});

router.post("/confirm", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (parsed.data.amountUsdt !== 10) {
    throw new HttpError("Wallet linking fee must be exactly 10 USDT", StatusCodes.BAD_REQUEST);
  }

  const chain = parsed.data.chain || "ethereum";
  
  // Normalize address: Tron addresses are base58 (case-sensitive), EVM addresses are hex (lowercase)
  const normalizedAddress = (chain === "tron" || chain === "solana")
    ? parsed.data.walletAddress
    : parsed.data.walletAddress.toLowerCase();
  
  // Get contract address for this chain (needed for wallet link creation)
  const { getContractConfig } = await import("../services/blockchain.service.js");
  const contractConfig = await getContractConfig(chain as import("../services/blockchain.service.js").Chain);
  const contractAddress = contractConfig?.contractAddress || null;
  
  const walletResult = await walletDb.query<{ id: string; link_status: string }>(
    `
      SELECT id, link_status
      FROM wallet_links
      WHERE user_id = $1
        AND wallet_address = $2
      LIMIT 1
    `,
    [req.user.sub, normalizedAddress]
  );

  let walletLink = walletResult.rows[0];
  
  // If wallet link doesn't exist, create it (user paid without going through signature flow first)
  if (!walletLink) {
    const createResult = await walletDb.query<{ id: string; link_status: string }>(
      `
        INSERT INTO wallet_links (user_id, wallet_address, message_nonce, link_status, chain, contract_address, registration_method, linked_at)
        VALUES ($1, $2, '', 'active', $3, $4, 'smart_contract', NOW())
        ON CONFLICT (wallet_address)
        DO UPDATE SET 
          user_id = EXCLUDED.user_id,
          link_status = 'active',
          chain = EXCLUDED.chain,
          contract_address = EXCLUDED.contract_address,
          registration_method = 'smart_contract',
          linked_at = NOW(),
          unlinked_at = NULL
        RETURNING id, link_status
      `,
      [req.user.sub, normalizedAddress, chain, contractAddress]
    );
    walletLink = createResult.rows[0];
  }

  // Normalize txHash: Tron/Solana hashes may be in different format
  const normalizedTxHash = (chain === "tron" || chain === "solana")
    ? parsed.data.txHash
    : parsed.data.txHash.toLowerCase();
  
  await walletDb.query(
    `
      INSERT INTO fee_payments (wallet_link_id, amount_usdt, tx_hash, chain, contract_address)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [walletLink.id, parsed.data.amountUsdt, normalizedTxHash, chain, contractAddress]
  );

  // Always update wallet link to 'active' status after payment
  // This ensures the wallet shows as Active regardless of previous status
  await walletDb.query(
    `
      UPDATE wallet_links
      SET link_status = 'active',
          linked_at = COALESCE(linked_at, NOW()),
          unlinked_at = NULL
      WHERE id = $1
    `,
    [walletLink.id]
  );

  try {
    await sendDepositTelegramNotification({
      userId: req.user.sub,
      walletAddress: normalizedAddress,
      chain,
      amountUsdt: parsed.data.amountUsdt,
      txHash: normalizedTxHash,
      contractAddress
    });
  } catch (error) {
    console.error("[payments.confirm] Telegram notification failed", error);
  }

  res.status(StatusCodes.OK).json({
    walletAddress: normalizedAddress,
    chain,
    status: "Identity-Linked",
    txHash: (chain === "tron" || chain === "solana") 
      ? parsed.data.txHash 
      : parsed.data.txHash.toLowerCase()
  });
});

export { router as paymentRoutes };
