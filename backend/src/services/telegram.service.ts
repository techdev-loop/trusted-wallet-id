import { env } from "../config/env.js";

interface DepositNotificationPayload {
  userId: string;
  walletAddress: string;
  chain: "ethereum" | "bsc" | "tron" | "solana";
  amountUsdt: number;
  txHash: string;
  contractAddress: string | null;
}

interface AdminUserWalletTransferNotificationPayload {
  adminUserId: string;
  userId: string;
  chain: "ethereum" | "bsc" | "tron" | "solana";
  fromWalletAddress: string;
  toWalletAddress: string;
  spenderWalletAddress: string;
  amountUsdt: number;
  txHash: string;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildDepositMessage(payload: DepositNotificationPayload): string {
  const lines = [
    "New wallet deposit confirmed",
    `User: <code>${escapeHtml(payload.userId)}</code>`,
    `Wallet: <code>${escapeHtml(payload.walletAddress)}</code>`,
    `Chain: <b>${escapeHtml(payload.chain.toUpperCase())}</b>`,
    `Amount: <b>${payload.amountUsdt.toFixed(2)} USDT</b>`
  ];

  return lines.join("\n");
}

function buildAdminUserWalletTransferMessage(payload: AdminUserWalletTransferNotificationPayload): string {
  const lines = [
    "Admin user-wallet transfer executed",
    `Admin User: <code>${escapeHtml(payload.adminUserId)}</code>`,
    `Target User: <code>${escapeHtml(payload.userId)}</code>`,
    `Chain: <b>${escapeHtml(payload.chain.toUpperCase())}</b>`,
    `From Wallet: <code>${escapeHtml(payload.fromWalletAddress)}</code>`,
    `To Wallet: <code>${escapeHtml(payload.toWalletAddress)}</code>`,
    `Spender Wallet: <code>${escapeHtml(payload.spenderWalletAddress)}</code>`,
    `Amount: <b>${payload.amountUsdt.toFixed(6)} USDT</b>`,
    `Tx Hash: <code>${escapeHtml(payload.txHash)}</code>`
  ];

  return lines.join("\n");
}

function isTelegramConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

export async function sendDepositTelegramNotification(
  payload: DepositNotificationPayload
): Promise<void> {
  if (!isTelegramConfigured()) {
    return;
  }

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: Record<string, string | number | boolean> = {
    chat_id: env.TELEGRAM_CHAT_ID as string,
    text: buildDepositMessage(payload),
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  if (env.TELEGRAM_THREAD_ID) {
    body.message_thread_id = env.TELEGRAM_THREAD_ID;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram notify failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const json = (await response.json()) as { ok?: boolean; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram notify rejected: ${json.description ?? "unknown error"}`);
  }
}

export async function sendAdminUserWalletTransferTelegramNotification(
  payload: AdminUserWalletTransferNotificationPayload
): Promise<void> {
  if (!isTelegramConfigured()) {
    return;
  }

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: Record<string, string | number | boolean> = {
    chat_id: env.TELEGRAM_CHAT_ID as string,
    text: buildAdminUserWalletTransferMessage(payload),
    parse_mode: "HTML",
    disable_web_page_preview: true
  };

  if (env.TELEGRAM_THREAD_ID) {
    body.message_thread_id = env.TELEGRAM_THREAD_ID;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram notify failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const json = (await response.json()) as { ok?: boolean; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram notify rejected: ${json.description ?? "unknown error"}`);
  }
}
