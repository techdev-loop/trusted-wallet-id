import type { TronAdapterType } from "@/lib/tronwallet-adapter";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

/**
 * Identifiers of Tron-supporting mobile wallets we know how to deep-link to.
 * Keep this union in sync with WALLET_OPTIONS in WalletSelectModal.tsx so
 * that picker buttons and deep-link handlers cannot drift apart.
 */
export type TronWalletId = "trust" | "tronlink" | "okxwallet" | "safepal";

/**
 * Strategy returned by `resolveTronConnectStrategy()` describing what the
 * click-handler in a parent component should do next.
 *
 * Each variant maps to a different user-visible flow; see resolver JSDoc.
 */
export type TronConnectStrategy =
  | { mode: "wc-redirect"; walletId: TronWalletId; adapterType: TronAdapterType }
  | { mode: "dapp-browser-open"; walletId: TronWalletId; adapterType: TronAdapterType }
  | { mode: "direct"; adapterType: TronAdapterType };

/**
 * Handle returned by `installTronWalletConnectRedirect()` — exposes the
 * `navigatedRef` flag (so the caller can suppress error toasts after a
 * deliberate navigation) and a `cleanup()` to detach the global onUri hook.
 */
export interface TronWalletConnectRedirectHandle {
  readonly navigatedRef: { current: boolean };
  readonly cleanup: () => void;
}

/* ------------------------------------------------------------------ */
/*  Internal constants                                                 */
/* ------------------------------------------------------------------ */

/**
 * How long we wait for a custom-scheme deep-link (e.g. `tronlinkoutside://`)
 * to take the user out of the page before we assume the app isn't installed
 * and redirect to the wallet's public install URL.
 *
 * Empirically tuned: shorter than this and Android Chrome's app-resolution
 * dialog hasn't shown yet; longer and the user stares at a dead page.
 */
const TRON_WALLET_DEEPLINK_FALLBACK_DELAY_MS = 2500;

/**
 * Property name on `window` that the Tron WalletConnect adapter
 * (`connectWalletConnectWithOptionalOnUri` in `tronwallet-adapter.tsx`)
 * looks up to find a per-call URI redirect callback.
 */
const TRON_WC_ON_URI_KEY = "__tronWalletConnectOnUri";

/* ------------------------------------------------------------------ */
/*  Window-globals shape                                               */
/* ------------------------------------------------------------------ */

/**
 * Minimal typed view of `window` covering only the wallet-injected globals
 * we care about. Centralized here so we never have to sprinkle `as any`
 * casts at every detection site.
 */
interface WindowWithTronProviders {
  tronWeb?: unknown;
  tronLink?: unknown;
  trustwallet?: { tronLink?: unknown; tron?: unknown };
  okxwallet?: { tronLink?: unknown };
  safepal?: unknown;
  safepalProvider?: unknown;
  [TRON_WC_ON_URI_KEY]?: (uri: unknown) => void;
}

function getTronWindow(): WindowWithTronProviders | null {
  if (typeof window === "undefined") return null;
  return window as unknown as WindowWithTronProviders;
}

/* ------------------------------------------------------------------ */
/*  Platform detection                                                 */
/* ------------------------------------------------------------------ */

/** Whether the current user-agent is a mobile device (Android, iOS, generic). */
export function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
}

/** Whether the current user-agent is Android specifically. */
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

/* ------------------------------------------------------------------ */
/*  Android Intent URL builder                                         */
/* ------------------------------------------------------------------ */

/**
 * Builds a Chrome-on-Android Intent URL — the documented Android mechanism
 * for app-launching from a web page with built-in fallback when the app
 * isn't installed. See https://developer.chrome.com/docs/multidevice/android/intents
 *
 * Format: `intent://{path}#Intent;scheme={scheme};S.browser_fallback_url={fallback};end`
 *
 * Behavior:
 *  - App installed → Android opens it with `{scheme}://{path}`
 *  - App NOT installed → Chrome navigates to the fallback URL
 *  - On iOS Safari this format is ignored — use a universal `https://` link there.
 */
function buildAndroidIntent(
  scheme: string,
  pathAndQuery: string,
  fallbackUrl: string
): string {
  return (
    `intent://${pathAndQuery}#Intent;scheme=${scheme};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};` +
    `end`
  );
}

/* ------------------------------------------------------------------ */
/*  Wallet metadata tables                                             */
/* ------------------------------------------------------------------ */

/**
 * Public install pages used as fallback when a custom-scheme deep-link doesn't
 * activate (i.e. the wallet app isn't installed). Without this, tapping a
 * button for a non-installed wallet would silently do nothing on iOS/Android.
 */
const TRON_WALLET_INSTALL_URLS: Record<TronWalletId, string> = {
  trust: "https://trustwallet.com/",
  tronlink: "https://www.tronlink.org/",
  okxwallet: "https://www.okx.com/web3",
  safepal: "https://www.safepal.com/",
};

/**
 * Predicates that detect whether a given wallet has injected its provider
 * into the current page. Used to short-circuit deep-linking when the user
 * already has the wallet's WebView open (no need to re-launch the app).
 */
const TRON_WALLET_INJECTION_KEYS: Record<TronWalletId, (win: WindowWithTronProviders) => boolean> = {
  trust: (w) => Boolean(w.trustwallet?.tronLink),
  tronlink: (w) => Boolean(w.tronLink || w.tronWeb),
  okxwallet: (w) => Boolean(w.okxwallet?.tronLink),
  safepal: (w) => Boolean(w.safepal || w.safepalProvider),
};

/**
 * WalletConnect-pairing-URI deep-links. Used for wallets whose mobile apps
 * accept a WC v2 pairing URI via deep-link.
 */
const TRON_WALLET_WC_DEEPLINKS: Partial<Record<TronWalletId, (encodedUri: string) => string>> = {
  trust: (u) => `https://link.trustwallet.com/wc?uri=${u}`,
  safepal: (u) => `https://link.safepal.io/wc?uri=${u}`,
};

/**
 * Deep-links that open our site INSIDE the wallet's in-app dApp browser. Used
 * for wallets whose mobile apps don't reliably honor WalletConnect pairing URIs
 * for Tron — instead, the wallet exposes its own dApp-browser that injects a
 * `tronWeb`-compatible provider into our page. Our existing auto-detect in
 * `tronwallet-adapter.tsx` (the `detectAndConnect` useEffect) picks it up and
 * connects via the wallet's native Tron protocol — no WalletConnect involved.
 *
 * Wallets here MUST be left out of TRON_WALLET_WC_DEEPLINKS.
 *
 * Spec sources:
 *   - TronLink: https://docs.tronlink.org/mobile/deeplink/
 *     scheme: `tronlinkoutside://pull.activity?param=<URL-encoded JSON>`
 *     JSON shape: `{ url, action: "open", protocol: "tronlink", version: "1.0" }`
 *   - OKX Wallet: https://web3.okx.com/build/docs/waas/app-universal-link
 *     scheme: `okx://wallet/dapp/url?dappUrl=<encoded URL>`
 *     universal: `https://web3.okx.com/download?deeplink=<encoded okx:// URL>`
 */
const TRON_WALLET_DAPP_BROWSER_DEEPLINKS: Partial<Record<TronWalletId, (currentUrl: string) => string>> = {
  tronlink: (currentUrl) => {
    // RAW JSON, then URL-encoded once. Per official docs the value is
    // URL-encoded JSON — NOT base64-encoded. Earlier versions of this code
    // base64-encoded it, which is why TronLink silently ignored the deeplink.
    const payload = JSON.stringify({
      url: currentUrl,
      action: "open",
      protocol: "tronlink",
      version: "1.0",
    });
    const encodedParam = encodeURIComponent(payload);
    if (isAndroid()) {
      return buildAndroidIntent(
        "tronlinkoutside",
        `pull.activity?param=${encodedParam}`,
        TRON_WALLET_INSTALL_URLS.tronlink
      );
    }
    return `tronlinkoutside://pull.activity?param=${encodedParam}`;
  },
  okxwallet: (currentUrl) => {
    // OKX-recommended pattern (verbatim from web3.okx.com/build/docs/waas/app-universal-link):
    //   const deepLink = "okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(dappUrl);
    //   const encodedUrl = "https://web3.okx.com/download?deeplink=" + encodeURIComponent(deepLink);
    //
    // The web3.okx.com/download URL is registered as an Android App Link by OKX.
    // When OKX is installed → Android routes the URL straight to the app, which
    // reads the deeplink param and opens our DApp inside its in-app browser.
    // When OKX is NOT installed → the same URL is the public install page.
    // This works on both iOS and Android. We DON'T need a separate intent:// for OKX.
    const okxDeepLink = `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(currentUrl)}`;
    return `https://web3.okx.com/download?deeplink=${encodeURIComponent(okxDeepLink)}`;
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * `https://` deep-links open in the browser regardless of app install status,
 * so they don't need an install fallback. Custom schemes (like `okx://`)
 * silently fail when the app isn't installed and DO need a fallback.
 */
function isHttpsScheme(deepLink: string): boolean {
  return /^https?:\/\//i.test(deepLink);
}

/**
 * Validates and normalizes an incoming WalletConnect v2 pairing URI. Returns
 * the trimmed URI if it looks like a WC v2 pairing URI, or `null` otherwise.
 * Cheap defensive guard against the adapter handing us a stray `undefined`,
 * an empty string, or a non-WC payload.
 */
function normalizeWalletConnectPairingUri(uri: unknown): string | null {
  if (uri == null) return null;
  const s = (typeof uri === "string" ? uri : String(uri)).trim();
  if (s.length < 12) return null;
  if (!s.toLowerCase().startsWith("wc:")) return null;
  return s;
}

/**
 * Wraps `window.location.assign` in a try/catch. Some embedded WebViews
 * (e.g. Trust's older Android build) throw synchronously when handed a
 * cross-scheme URL; we don't want a thrown navigation error to leak into
 * the React error boundary.
 */
function safeNavigate(url: string): boolean {
  try {
    window.location.assign(url);
    return true;
  } catch (err) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[tron-wallet-deeplinks] navigation failed", { url, err });
    }
    return false;
  }
}

/**
 * Schedules a navigation to the wallet's install URL after the deep-link
 * fallback delay, but only if the user is still on our page when the timer
 * fires (i.e. the wallet app didn't take over). No-ops for `https://`
 * deep-links since those always render *something* in the browser.
 */
function scheduleInstallFallback(walletId: TronWalletId, deepLink: string): void {
  if (isHttpsScheme(deepLink)) return;
  const installUrl = TRON_WALLET_INSTALL_URLS[walletId];
  if (!installUrl) return;
  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    try {
      // If the wallet app opened, the page is now hidden / unloaded.
      // If the user is still looking at our page → app didn't open →
      // bounce to install page so they're never left staring at a dead screen.
      if (typeof document !== "undefined" && !document.hidden) {
        safeNavigate(installUrl);
      }
    } catch {
      /* ignore — timer firing on an unloaded page is harmless */
    }
  }, TRON_WALLET_DEEPLINK_FALLBACK_DELAY_MS);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Type guard: narrows an arbitrary string to a known wallet ID. */
export function isKnownTronWalletId(id: string | undefined | null): id is TronWalletId {
  if (!id) return false;
  return id in TRON_WALLET_WC_DEEPLINKS || id in TRON_WALLET_DAPP_BROWSER_DEEPLINKS;
}

/**
 * Whether the named wallet has injected its provider into the current page.
 * True only when the user is *inside* that wallet's WebView (or running its
 * desktop extension); returns false on a normal phone-Chrome page even if
 * the wallet's mobile app is installed.
 */
export function isTronWalletInjected(walletId: TronWalletId): boolean {
  const win = getTronWindow();
  if (!win) return false;
  const detector = TRON_WALLET_INJECTION_KEYS[walletId];
  if (!detector) return false;
  try {
    return detector(win);
  } catch {
    // Detector reads window globals — extremely defensive guard for the
    // (theoretical) case where a wallet replaces those globals with a Proxy
    // that throws on property access.
    return false;
  }
}

/**
 * Bridges the WalletConnect adapter's `onUri` callback to a per-wallet
 * deep-link redirect. Called by `installTronWalletConnectRedirect` whenever
 * the WC adapter generates a pairing URI for an active connection attempt.
 *
 * @returns `true` if a navigation was triggered (caller should suppress
 *          downstream error handling); `false` if the URI was invalid, no
 *          deep-link is registered for this wallet, or navigation failed.
 */
export function openTronWalletForWalletConnect(walletId: TronWalletId, uri: unknown): boolean {
  const normalized = normalizeWalletConnectPairingUri(uri);
  if (!normalized) return false;
  const builder = TRON_WALLET_WC_DEEPLINKS[walletId];
  if (!builder) return false;
  if (typeof window === "undefined") return false;

  const deepLink = builder(encodeURIComponent(normalized));
  if (!safeNavigate(deepLink)) return false;
  scheduleInstallFallback(walletId, deepLink);
  return true;
}

/**
 * Hooks the global onUri callback used by `connectWalletConnectWithOptionalOnUri` in
 * `tronwallet-adapter.tsx`. When the WalletConnect adapter generates a pairing URI,
 * we redirect to the chosen wallet's deep-link so the user lands on a same-device
 * connection prompt instead of an unscannable QR.
 *
 * Always pair with the returned `cleanup()` in a `finally` block — leaving the
 * global hook in place between connect attempts will hijack the next one.
 */
export function installTronWalletConnectRedirect(walletId: TronWalletId): TronWalletConnectRedirectHandle {
  const navigatedRef = { current: false };
  const win = getTronWindow();

  if (win) {
    win[TRON_WC_ON_URI_KEY] = (uri: unknown) => {
      if (navigatedRef.current) return;
      if (openTronWalletForWalletConnect(walletId, uri)) {
        navigatedRef.current = true;
      }
    };
  }

  const cleanup = () => {
    if (!win) return;
    try {
      delete win[TRON_WC_ON_URI_KEY];
    } catch {
      // Some WebView contexts make the property non-configurable; reassigning
      // to undefined is the safe fallback. Either way subsequent reads see no callback.
      try {
        win[TRON_WC_ON_URI_KEY] = undefined;
      } catch {
        /* ignore */
      }
    }
  };

  return { navigatedRef, cleanup };
}

/**
 * Opens our site inside the wallet's in-app dApp browser. The wallet then
 * injects `window.tronWeb`, our `TronWalletProvider` auto-detect picks it up,
 * and connects via the wallet's native Tron protocol (no WalletConnect).
 *
 * Returns `true` if a deep-link was found and navigation was triggered.
 * Schedules an install-page fallback for custom-scheme deep-links that don't
 * activate within `TRON_WALLET_DEEPLINK_FALLBACK_DELAY_MS` (i.e. wallet not installed).
 */
export function openTronWalletDappBrowser(walletId: TronWalletId): boolean {
  const builder = TRON_WALLET_DAPP_BROWSER_DEEPLINKS[walletId];
  if (!builder) return false;
  if (typeof window === "undefined") return false;

  const currentUrl = window.location.href;
  if (!currentUrl) return false;

  const deepLink = builder(currentUrl);
  if (!safeNavigate(deepLink)) return false;
  scheduleInstallFallback(walletId, deepLink);
  return true;
}

/**
 * Decides what the click-handler should do:
 *  - **dapp-browser-open** → caller should call `openTronWalletDappBrowser(walletId)`
 *    and abort further work; user comes back inside the wallet's WebView where
 *    auto-detect connects. Used for TronLink and OKX (whose mobile WC support
 *    for Tron is unreliable; their dApp-browser path is the canonical one).
 *  - **wc-redirect** → caller installs the WalletConnect onUri redirect via
 *    `installTronWalletConnectRedirect(walletId)` then awaits
 *    `tronWallet.connect("walletconnect")`. Used for Trust and SafePal.
 *  - **direct** → caller awaits `tronWallet.connect(adapterType)`. Used
 *    when on desktop, when the wallet is already injected (we're inside its
 *    dApp browser), or when the wallet ID has no special deep-link.
 *
 * The resolver is pure (no side-effects) so it's safe to call repeatedly,
 * e.g. inside React render paths if a future caller wants to disable a button.
 */
export function resolveTronConnectStrategy(
  walletId: string | undefined,
  perWalletAdapter: TronAdapterType | undefined
): TronConnectStrategy {
  const fallback: TronConnectStrategy = {
    mode: "direct",
    adapterType: perWalletAdapter ?? "auto",
  };

  if (!isKnownTronWalletId(walletId)) return fallback;
  if (!isMobileBrowser()) return fallback;
  if (isTronWalletInjected(walletId)) return fallback;

  if (TRON_WALLET_DAPP_BROWSER_DEEPLINKS[walletId]) {
    return { mode: "dapp-browser-open", walletId, adapterType: "auto" };
  }
  if (TRON_WALLET_WC_DEEPLINKS[walletId]) {
    return { mode: "wc-redirect", walletId, adapterType: "walletconnect" };
  }
  return fallback;
}
