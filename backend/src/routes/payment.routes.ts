import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

const paymentSchema = z.object({
  walletAddress: z.string().min(16),
  txHash: z.string().min(20),
  amountUsdt: z.coerce.number()
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

  const normalizedAddress = parsed.data.walletAddress.toLowerCase();
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

  const walletLink = walletResult.rows[0];
  if (!walletLink) {
    throw new HttpError("Wallet link record not found", StatusCodes.NOT_FOUND);
  }

  await walletDb.query(
    `
      INSERT INTO fee_payments (wallet_link_id, amount_usdt, tx_hash)
      VALUES ($1, $2, $3)
    `,
    [walletLink.id, parsed.data.amountUsdt, parsed.data.txHash.toLowerCase()]
  );

  await walletDb.query(
    `
      UPDATE wallet_links
      SET link_status = 'active',
          linked_at = NOW()
      WHERE id = $1
    `,
    [walletLink.id]
  );

  res.status(StatusCodes.OK).json({
    walletAddress: normalizedAddress,
    status: "Identity-Linked",
    txHash: parsed.data.txHash.toLowerCase()
  });
});

export { router as paymentRoutes };
