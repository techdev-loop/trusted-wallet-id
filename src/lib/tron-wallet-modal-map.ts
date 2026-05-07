import type { TronAdapterType } from "@/lib/tronwallet-adapter";

/**
 * Maps WalletSelectModal ids to Tron adapter keys.
 * SafePal has no dedicated tron adapter, so route through auto detection.
 */
export const TRON_WALLET_ID_TO_ADAPTER: Record<string, TronAdapterType> = {
  tronlink: "tronlink",
  tokenpocket: "tokenpocket",
  trust: "trust",
  "metamask-tron": "metamask",
  okxwallet: "okxwallet",
  bitkeep: "bitkeep",
  safepal: "auto",
  walletconnect: "walletconnect",
};

export function resolveTronWalletAdapterFromModalId(walletId?: string): TronAdapterType | undefined {
  if (!walletId) return undefined;
  return TRON_WALLET_ID_TO_ADAPTER[walletId];
}
