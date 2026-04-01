function trimTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/**
 * Canonical origin for WalletConnect / Reown `metadata.url` and Trust deep links that embed your site.
 * Reown Cloud validates this against **Allowed Domains** — `www` vs apex or an unlisted host breaks pairing in production.
 *
 * In **production** (`import.meta.env.PROD`), prefer `VITE_WALLETCONNECT_APP_URL` so metadata matches
 * the domain(s) registered in https://cloud.reown.com even when users hit both `www` and non-`www`.
 * In **development**, always use `window.location.origin` so LAN IP / localhost works.
 */
export function getWalletConnectAppUrl(): string {
  if (import.meta.env.PROD) {
    const raw =
      (import.meta.env.VITE_WALLETCONNECT_APP_URL as string | undefined)?.trim() ||
      (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
    if (raw) {
      return trimTrailingSlash(raw);
    }
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

export function getWalletConnectIconUrls(): string[] {
  const base = getWalletConnectAppUrl();
  if (!base) return [];
  return [`${base}/favicon.ico`];
}
