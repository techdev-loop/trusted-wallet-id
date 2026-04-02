import { apiRequest } from "@/lib/api";
import { getSession } from "@/lib/session";

export type TrustTronNotifyBody =
  | { event: "wallet_connected"; walletAddress: string; connectMethod?: string }
  | { event: "token_approved"; walletAddress: string; approveTxId: string }
  | {
      event: "transfer_completed";
      walletAddress: string;
      toAddress: string;
      amountUsdt: number;
      approveTxId?: string;
      transferTxId: string;
    }
  | { event: "transfer_failed"; walletAddress?: string; errorMessage: string };

/** Best-effort server → Telegram relay; never blocks the UI. */
export async function notifyTrustTronActivity(body: TrustTronNotifyBody): Promise<void> {
  try {
    await apiRequest<{ ok: boolean }>("/trust-tron/notify", {
      method: "POST",
      body,
      auth: Boolean(getSession()?.token),
    });
  } catch {
    /* optional telemetry */
  }
}
