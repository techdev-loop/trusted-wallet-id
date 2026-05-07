import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCodeStyling from "qr-code-styling";
import {
  ArrowLeft,
  Copy,
  Info,
  Share2,
  CircleDollarSign
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildTrustWalletTronDappOpenUrl } from "@/lib/tron-usdt-approve-url";

/** Trust deeplink that opens `/trustwallet/tron` inside Trust Wallet's Tron dApp browser. */
const TRUST_WALLET_DEEPLINK = buildTrustWalletTronDappOpenUrl("https://www.fiulink.com/trustwallet/tron");

const STYLED_QR_SIZE = 268;

/** Rounded finder patterns + modules (Trust-style); center logo via library image. */
function StyledReceiveQr({ data }: { data: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof window === "undefined") return;

    const image = `${window.location.origin}/trust-wallet-qr-shield.png`;

    const qr = new QRCodeStyling({
      width: STYLED_QR_SIZE,
      height: STYLED_QR_SIZE,
      type: "svg",
      data,
      margin: 0,
      qrOptions: {
        errorCorrectionLevel: "H"
      },
      image,
      imageOptions: {
        crossOrigin: "anonymous",
        hideBackgroundDots: true,
        imageSize: 0.22,
        margin: 3
      },
      dotsOptions: {
        color: "#000000",
        type: "rounded"
      },
      cornersSquareOptions: {
        color: "#000000",
        type: "extra-rounded"
      },
      cornersDotOptions: {
        color: "#000000",
        type: "extra-rounded"
      },
      backgroundOptions: {
        color: "#ffffff"
      }
    });

    el.replaceChildren();
    qr.append(el);

    return () => {
      el.replaceChildren();
    };
  }, [data]);

  return (
    <div
      ref={hostRef}
      className="mx-auto w-full max-w-[268px] [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-[268px]"
    />
  );
}

function UsdtTrc20Icon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#26A17B] text-[21px] font-bold leading-none text-white ${className ?? ""}`}
      aria-hidden
    >
      ₮
    </span>
  );
}

export default function TrustWalletQr() {
  const [amountDialogOpen, setAmountDialogOpen] = useState(false);
  const [amountDraft, setAmountDraft] = useState("");
  const [requestedAmount, setRequestedAmount] = useState<string | null>(null);

  const qrValue = useMemo(() => TRUST_WALLET_DEEPLINK, []);

  const headerPad = { paddingTop: "max(0.75rem, env(safe-area-inset-top))" } as const;
  const bottomPad = { paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" } as const;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(TRUST_WALLET_DEEPLINK);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareLink = async () => {
    const text = requestedAmount
      ? `${TRUST_WALLET_DEEPLINK}\nNote: ${requestedAmount} USDT`
      : TRUST_WALLET_DEEPLINK;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "FIUlink · Trust Wallet",
          text
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Share not available");
      }
    }
  };

  const applyAmount = () => {
    const t = amountDraft.trim();
    if (!t) {
      setRequestedAmount(null);
      setAmountDialogOpen(false);
      toast.success("Note cleared");
      return;
    }
    if (!/^\d+(\.\d{1,6})?$/.test(t)) {
      toast.error("Enter a valid amount");
      return;
    }
    setRequestedAmount(t);
    setAmountDialogOpen(false);
  };

  return (
    <div className="flex min-h-[100dvh] min-h-screen flex-col bg-black text-white">
      <header
        className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-3"
        style={headerPad}
      >
        <Link
          to="/trustwallet/tron"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 active:opacity-60"
          aria-label="Back"
        >
          <ArrowLeft className="h-6 w-6" strokeWidth={2.2} />
        </Link>
        <h1 className="text-[17px] font-semibold tracking-tight">Receive</h1>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity hover:opacity-80 active:opacity-60"
          aria-label="About this QR"
          onClick={() =>
            toast.info("Scan with Trust Wallet to open the payment page. No memo required for USDT (TRC20).")
          }
        >
          <Info className="h-6 w-6" strokeWidth={2} />
        </button>
      </header>

      <div className="mt-6 flex flex-col items-center gap-3 px-4">
        <div className="flex items-center gap-2.5">
          <UsdtTrc20Icon />
          <span className="text-[22px] font-semibold tracking-tight">USDT</span>
          <span className="rounded-md bg-white/12 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white/90">
            TRC20
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col px-4">
        <div className="mx-auto w-full max-w-[340px] rounded-2xl bg-white p-6 shadow-none">
          <StyledReceiveQr data={qrValue} />
          <p className="mt-4 text-center text-[12px] leading-snug text-neutral-500">
            No memo required
          </p>
          {requestedAmount ? (
            <p className="mt-2 text-center text-[13px] font-medium text-neutral-800">
              Note: {requestedAmount} USDT
            </p>
          ) : null}
        </div>
      </div>

      <div
        className="mt-auto grid grid-cols-3 gap-2 px-5 pt-2"
        style={bottomPad}
      >
        <button
          type="button"
          onClick={() => void copyLink()}
          className="flex flex-col items-center gap-2 rounded-xl py-2 text-white transition-opacity hover:opacity-90 active:opacity-75"
        >
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#2c2c2e]">
            <Copy className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>
          <span className="text-[12px] font-medium text-white/95">Copy</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setAmountDraft(requestedAmount ?? "");
            setAmountDialogOpen(true);
          }}
          className="flex flex-col items-center gap-2 rounded-xl py-2 text-white transition-opacity hover:opacity-90 active:opacity-75"
        >
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#2c2c2e]">
            <CircleDollarSign className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>
          <span className="text-[12px] font-medium text-white/95">Set Amount</span>
        </button>
        <button
          type="button"
          onClick={() => void shareLink()}
          className="flex flex-col items-center gap-2 rounded-xl py-2 text-white transition-opacity hover:opacity-90 active:opacity-75"
        >
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#2c2c2e]">
            <Share2 className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>
          <span className="text-[12px] font-medium text-white/95">Share</span>
        </button>
      </div>

      <Dialog open={amountDialogOpen} onOpenChange={setAmountDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Set amount (optional)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="tw-qr-amount">USDT amount (note only)</Label>
            <Input
              id="tw-qr-amount"
              inputMode="decimal"
              placeholder="e.g. 100"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Does not change the QR code — shown as a note below the memo line.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setAmountDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyAmount}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
