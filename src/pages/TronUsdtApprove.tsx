import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "react-qr-code";
import { Loader2, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletSelectModal } from "@/components/WalletSelectModal";
import { approveUSDT, type WalletConnectionMethod } from "@/lib/web3";
import {
  buildTronUsdtApprovePageUrl,
  buildTrustWalletTronDappOpenUrl,
  isLikelyTronBase58Address,
  resolveTronUsdtApprovalSpender,
} from "@/lib/tron-usdt-approve-url";
import { getTronProviderDebugSnapshot, useTronWallet, type TronAdapterType } from "@/lib/tronwallet-adapter";

const UNLIMITED_APPROVAL_AMOUNT = (2n ** 256n) - 1n;

const TRON_WALLET_ID_TO_ADAPTER: Record<string, TronAdapterType> = {
  tronlink: "tronlink",
  tokenpocket: "tokenpocket",
  trust: "trust",
  "metamask-tron": "metamask",
  okxwallet: "okxwallet",
  safepal: "auto",
  walletconnect: "walletconnect",
};

function hasTrustWalletTronInjection(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as Window & { trustwallet?: { tronLink?: unknown } };
  return Boolean(win.trustwallet?.tronLink);
}

const TronUsdtApprove = () => {
  const [searchParams] = useSearchParams();
  const tronWallet = useTronWallet();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [showPlainWalletQr, setShowPlainWalletQr] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  const tokenOverride = searchParams.get("token")?.trim() || undefined;
  const querySpender = searchParams.get("spender");

  const spender = useMemo(
    () => resolveTronUsdtApprovalSpender(querySpender),
    [querySpender]
  );

  const approveUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return buildTronUsdtApprovePageUrl({
      spender: spender ?? undefined,
      token: tokenOverride,
    });
  }, [spender, tokenOverride]);

  const trustWalletScanUrl = useMemo(
    () => (approveUrl ? buildTrustWalletTronDappOpenUrl(approveUrl) : ""),
    [approveUrl]
  );

  const connectTrustRef = useRef(tronWallet.connect);
  connectTrustRef.current = tronWallet.connect;

  const trustAutoConnectAttempted = useRef(false);
  useEffect(() => {
    if (!spender || trustAutoConnectAttempted.current) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;
    const intervalMs = 400;

    const tick = () => {
      if (cancelled || trustAutoConnectAttempted.current) return;
      attempts += 1;
      if (hasTrustWalletTronInjection()) {
        trustAutoConnectAttempted.current = true;
        void connectTrustRef.current("trust").catch(() => {
          trustAutoConnectAttempted.current = false;
        });
        return;
      }
      if (attempts < maxAttempts) {
        window.setTimeout(tick, intervalMs);
      }
    };

    window.setTimeout(tick, 300);
    return () => {
      cancelled = true;
    };
  }, [spender]);

  const tokenDisplay =
    tokenOverride && isLikelyTronBase58Address(tokenOverride) ? tokenOverride : null;

  const handleConnectTron = async (method: WalletConnectionMethod, walletId?: string) => {
    setWalletModalOpen(false);
    setConnecting(true);
    try {
      const adapter = walletId ? TRON_WALLET_ID_TO_ADAPTER[walletId] : undefined;
      await tronWallet.connect(adapter ?? "auto");
      toast.success("Tron wallet connected.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect Tron wallet";
      console.error("[tron-usdt-approve.connect]", getTronProviderDebugSnapshot(), error);
      toast.error(message);
      setWalletModalOpen(true);
    } finally {
      setConnecting(false);
    }
  };

  const handleApprove = async () => {
    if (!spender) {
      toast.error("Spender address is not configured.");
      return;
    }
    if (!tronWallet.isConnected || !tronWallet.address) {
      toast.error("Connect your Tron wallet first.");
      setWalletModalOpen(true);
      return;
    }

    setApproving(true);
    setLastTxId(null);
    try {
      const txid = await approveUSDT("tron", spender, UNLIMITED_APPROVAL_AMOUNT, tokenOverride);
      setLastTxId(txid);
      toast.success("USDT approval submitted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval failed";
      console.error("[tron-usdt-approve]", getTronProviderDebugSnapshot(), error);
      toast.error(message);
    } finally {
      setApproving(false);
    }
  };

  const copyLink = async (url: string, label: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-4">
        <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 pb-16">
        <Card className="w-full max-w-md border-border/80 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Tron USDT approval</CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">Trust Wallet:</span> scan the QR with Trust&apos;s scanner
              so the app opens this page in Trust&apos;s Tron dApp browser. Then confirm USDT approval. Other Tron
              wallets can use the plain link QR below. This page only sends TRC-20{" "}
              <code className="text-[11px]">approve</code>—no transfers or registry calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!spender ? (
              <p className="text-sm text-destructive">
                No valid spender configured. Set{" "}
                <code className="text-xs bg-muted px-1 rounded">VITE_USDT_APPROVAL_SPENDER_TRON</code> (or{" "}
                <code className="text-xs bg-muted px-1 rounded">VITE_USDT_APPROVAL_SPENDER</code> with a Tron
                address), or add <code className="text-xs bg-muted px-1 rounded">?spender=T...</code> to the URL
                in the hash route.
              </p>
            ) : (
              <>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Spender (allowance to)</span>
                    <p className="font-mono text-xs break-all">{spender}</p>
                  </div>
                  {tokenDisplay ? (
                    <div>
                      <span className="text-muted-foreground">USDT contract override</span>
                      <p className="font-mono text-xs break-all">{tokenDisplay}</p>
                    </div>
                  ) : null}
                </div>

                {trustWalletScanUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs font-medium text-foreground text-center">Scan with Trust Wallet</p>
                    <div className="rounded-xl bg-white p-3">
                      <QRCode value={trustWalletScanUrl} size={220} level="M" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Opens this site in Trust on Tron. If your address is not connected yet, tap{" "}
                      <span className="text-foreground">Connect Tron wallet</span> and choose Trust, then{" "}
                      <span className="text-foreground">Approve USDT</span>.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => copyLink(trustWalletScanUrl, "Trust Wallet link")}
                    >
                      <Copy className="h-4 w-4" />
                      Copy Trust link
                    </Button>

                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => setShowPlainWalletQr((v) => !v)}
                    >
                      {showPlainWalletQr ? "Hide" : "Show"} plain URL QR (TronLink, TokenPocket, …)
                    </button>

                    {showPlainWalletQr && approveUrl ? (
                      <div className="flex flex-col items-center gap-2 pt-2 border-t border-border w-full">
                        <div className="rounded-xl bg-white p-3">
                          <QRCode value={approveUrl} size={200} level="M" />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-2"
                          onClick={() => copyLink(approveUrl, "Page link")}
                        >
                          <Copy className="h-4 w-4" />
                          Copy page link
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {tronWallet.isConnected && tronWallet.address ? (
                    <p className="text-sm text-muted-foreground">
                      Connected: <span className="font-mono text-foreground">{tronWallet.address}</span>
                    </p>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={connecting}
                      onClick={() => setWalletModalOpen(true)}
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Connecting…
                        </>
                      ) : (
                        "Connect Tron wallet"
                      )}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    disabled={approving || !tronWallet.isConnected}
                    onClick={handleApprove}
                  >
                    {approving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Approving…
                      </>
                    ) : (
                      "Approve USDT (unlimited)"
                    )}
                  </Button>

                  {lastTxId ? (
                    <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-success">Transaction sent</p>
                        <a
                          href={`https://tronscan.org/#/transaction/${lastTxId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline break-all"
                        >
                          {lastTxId}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                    </div>
                  ) : null}

                  {tronWallet.isConnected ? (
                    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => tronWallet.disconnect()}>
                      Disconnect
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <WalletSelectModal
        open={walletModalOpen}
        onOpenChange={(open) => {
          if (!connecting) setWalletModalOpen(open);
        }}
        selectedChain="tron"
        onSelectWallet={handleConnectTron}
        isConnecting={connecting}
      />
    </div>
  );
};

export default TronUsdtApprove;
