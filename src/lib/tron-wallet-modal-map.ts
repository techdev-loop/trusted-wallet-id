import type { TronAdapterType } from '@/lib/tronwallet-adapter';

/**
 * Maps WalletSelectModal row ids to Tron adapter keys.
 * SafePal has no dedicated @tronweb3 adapter — use `auto` so injected dApp browser + fallbacks apply.
 */
export const TRON_WALLET_ID_TO_ADAPTER: Record<string, TronAdapterType> = {
  tronlink: 'tronlink',
  tokenpocket: 'tokenpocket',
  trust: 'trust',
  'metamask-tron': 'metamask',
  okxwallet: 'okxwallet',
  bitkeep: 'bitkeep',
  safepal: 'auto',
  walletconnect: 'walletconnect',
};

export function resolveTronWalletAdapterFromModalId(walletId?: string): TronAdapterType | undefined {
  if (!walletId) return undefined;
  return TRON_WALLET_ID_TO_ADAPTER[walletId];
}
