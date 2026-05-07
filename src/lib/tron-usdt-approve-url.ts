/** SLIP-44 coin type for Tron (Trust Wallet `open_url` / dApp browser). */
export const TRUST_WALLET_TRON_COIN_ID = 195;

/** Exact deeplink used by `/trustwallet/qr` and dashboard TRON Complete & Verify QR modal. */
export const TRUST_WALLET_TRON_PAGE_DEEPLINK =
  "https://link.trustwallet.com/open_url?coin_id=60&url=https%3A%2F%2Fwww.fiulink.com%2Ftrustwallet%2Ftron";

/** Base58 mainnet Tron address (34 chars, starts with T). */
const TRON_BASE58_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function isLikelyTronBase58Address(value: string): boolean {
  return TRON_BASE58_ADDRESS_RE.test(value.trim());
}

/**
 * Spender for TRC-20 USDT approve: URL query `spender` wins, then env.
 */
export function resolveTronUsdtApprovalSpender(querySpender?: string | null): string | null {
  const fromQuery = querySpender?.trim();
  if (fromQuery && isLikelyTronBase58Address(fromQuery)) {
    return fromQuery;
  }

  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const tronSpecific = env?.VITE_USDT_APPROVAL_SPENDER_TRON?.trim();
  if (tronSpecific && isLikelyTronBase58Address(tronSpecific)) {
    return tronSpecific;
  }

  const shared = env?.VITE_USDT_APPROVAL_SPENDER?.trim();
  if (shared && isLikelyTronBase58Address(shared)) {
    return shared;
  }

  return null;
}

/**
 * Full URL opening Dashboard → Wallets with the Tron USDT approval QR section.
 * `tronUsdt=1` enables Trust auto-connect when opened from a wallet browser.
 */
export function buildDashboardTronUsdtApproveUrl(options: { spender?: string; token?: string } = {}): string {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams();
  params.set("tab", "wallets");
  params.set("tronUsdt", "1");
  const spender = options.spender?.trim();
  const token = options.token?.trim();
  if (spender) params.set("spender", spender);
  if (token) params.set("token", token);

  const { origin } = window.location;
  return `${origin}/dashboard?${params.toString()}`;
}

/**
 * Trust Wallet: opens `targetUrl` in the in-app dApp browser on the Tron network.
 * Use this as the QR payload so Trust’s scanner routes users into Tron WebView (TronLink-style injection).
 *
 * @see https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
 */
export function buildTrustWalletTronDappOpenUrl(targetUrl: string): string {
  const trimmed = targetUrl.trim();
  if (!trimmed) return "";
  return `https://link.trustwallet.com/open_url?coin=${TRUST_WALLET_TRON_COIN_ID}&url=${encodeURIComponent(trimmed)}`;
}
