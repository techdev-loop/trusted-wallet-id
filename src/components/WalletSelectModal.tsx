import { useState, useEffect } from "react";
import { Loader2, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Chain, WalletConnectionMethod } from "@/lib/web3";

type GlobalWalletWindow = Window & {
  tronWeb?: unknown;
  tronLink?: unknown;
  trustwallet?: { tronLink?: unknown };
  ethereum?: {
    isTrust?: boolean;
    isMetaMask?: boolean;
    isBitKeep?: boolean;
    isSafePal?: boolean;
    providers?: Array<{ isSafePal?: boolean }>;
  };
  okxwallet?: { tronLink?: unknown } | null;
  tokenpocket?: unknown;
  bitkeep?: unknown;
  safepal?: unknown;
  phantom?: unknown;
  solflare?: unknown;
};

function globalWalletWindow(): GlobalWalletWindow {
  return window as unknown as GlobalWalletWindow;
}

export interface WalletOption {
  id: string;
  name: string;
  icon: string | React.ReactNode;
  description: string;
  method: WalletConnectionMethod;
  isInstalled?: boolean;
  installUrl?: string;
  supportedChains: Chain[];
}

interface WalletSelectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedChain: Chain;
  onSelectWallet: (method: WalletConnectionMethod, walletId?: string) => void;
  isConnecting: boolean;
}

/** Tron list order: WalletConnect first (closest to “any wallet” / RainbowKit-style UX). */
const TRON_WALLET_SORT_ORDER: string[] = [
  "walletconnect",
  "tronlink",
  "trust",
  "metamask-tron",
  "tokenpocket",
  "okxwallet",
  "bitkeep",
  "safepal",
];

const TRON_TRY_CONNECT_IDS = new Set([
  "tronlink",
  "trust",
  "okxwallet",
  "safepal",
  "walletconnect",
  "metamask-tron",
  "tokenpocket",
  "bitkeep",
]);

// Wallet definitions
const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "rainbowkit",
    name: "Choose wallet",
    icon: "🌈",
    description: "Opens RainbowKit — MetaMask, WalletConnect, Coinbase Wallet, and other EVM wallets.",
    method: "auto",
    supportedChains: ["ethereum", "bsc"],
  },
  {
    id: "walletconnect",
    name: "Any wallet (WalletConnect)",
    icon: "🔗",
    description:
      "Scan QR or approve on your phone — Trust Wallet, SafePal, OKX, Bitget, TokenPocket, and hundreds more.",
    method: "walletconnect",
    supportedChains: ["tron"],
  },
  {
    id: "tronlink",
    name: "TronLink",
    icon: "🔷",
    description: "Browser extension on desktop, or open this site inside TronLink’s DApp browser.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.tronlink.org/",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    description:
      "Best inside Trust’s Discover browser with Tron selected. If you’re in Chrome/Safari, we’ll open Trust for you.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://trustwallet.com/",
  },
  {
    id: "metamask-tron",
    name: "MetaMask",
    icon: "🦊",
    description: "MetaMask with Tron support — works when MetaMask exposes Tron in this browser.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://metamask.io/download/",
  },
  {
    id: "tokenpocket",
    name: "TokenPocket",
    icon: "📱",
    description: "TokenPocket extension or open this page in TokenPocket’s browser.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.tokenpocket.pro/",
  },
  {
    id: "okxwallet",
    name: "OKX Wallet",
    icon: "⭕",
    description: "OKX Wallet extension or OKX app browser with Tron enabled.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.okx.com/web3",
  },
  {
    id: "bitkeep",
    name: "Bitget Wallet",
    icon: "💜",
    description: "Bitget Wallet (formerly BitKeep) — extension or in-app browser.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://web3.bitget.com/",
  },
  {
    id: "safepal",
    name: "SafePal",
    icon: "🔐",
    description:
      "Open this site in SafePal’s DApp browser with Tron. Or use “Any wallet (WalletConnect)” above from any wallet app.",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.safepal.com/",
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    description: "Link with Phantom via Solana Wallet Adapter",
    method: "injected",
    supportedChains: ["solana"],
    installUrl: "https://phantom.app/",
  },
  {
    id: "solflare",
    name: "Solflare",
    icon: "☀️",
    description: "Link with Solflare via Solana Wallet Adapter",
    method: "injected",
    supportedChains: ["solana"],
    installUrl: "https://solflare.com/",
  },
];

export function WalletSelectModal({
  open,
  onOpenChange,
  selectedChain,
  onSelectWallet,
  isConnecting,
}: WalletSelectModalProps) {
  const buildTrustTronDeepLink = () =>
    `https://link.trustwallet.com/open_url?coin_id=195&url=${encodeURIComponent(window.location.href)}`;

  const [detectedWallets, setDetectedWallets] = useState<string[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Detect installed wallets
  useEffect(() => {
    if (!open) return;

    const detected: string[] = [];

    // RainbowKit handles EVM wallet discovery itself.
    if (selectedChain === "ethereum" || selectedChain === "bsc") {
      detected.push("rainbowkit");
    }

    // Check for Tron wallets
    if (selectedChain === "tron") {
      if (typeof window !== "undefined") {
        const win = globalWalletWindow();
        const userAgent = String(navigator.userAgent || "").toLowerCase();
        // TronLink injects tronWeb or tronLink
        if (win.tronWeb || win.tronLink) {
          detected.push("tronlink");
        }
        if (
          win.trustwallet?.tronLink ||
          win.ethereum?.isTrust ||
          userAgent.includes("trustwallet") ||
          userAgent.includes("trust wallet")
        ) {
          detected.push("trust");
        }
        if (win.ethereum?.isMetaMask) {
          detected.push("metamask-tron");
        }
        if (win.tokenpocket) {
          detected.push("tokenpocket");
        }
        const okx = win.okxwallet;
        if (
          (okx && typeof okx === "object" && "tronLink" in okx && okx.tronLink) ||
          okx
        ) {
          detected.push("okxwallet");
        }
        if (win.bitkeep || win.ethereum?.isBitKeep) {
          detected.push("bitkeep");
        }
        const eth = win.ethereum;
        const safePalInjected =
          Boolean(win.safepal) ||
          Boolean(eth?.isSafePal) ||
          Boolean(eth?.providers?.some((provider) => provider?.isSafePal));
        if (safePalInjected) {
          detected.push("safepal");
        }
      }
    }

    // Check for Phantom and other Solana wallets
    if (selectedChain === "solana") {
      if (typeof window !== "undefined") {
        const win = globalWalletWindow();
        if (win.phantom) {
          detected.push("phantom");
        }
        if (win.solflare) {
          detected.push("solflare");
        }
      }
    }

    setDetectedWallets(detected);
  }, [open, selectedChain]);

  const availableWallets = WALLET_OPTIONS.filter((wallet) =>
    wallet.supportedChains.includes(selectedChain)
  ).sort((a, b) => {
    if (selectedChain === "tron") {
      const ia = TRON_WALLET_SORT_ORDER.indexOf(a.id);
      const ib = TRON_WALLET_SORT_ORDER.indexOf(b.id);
      const ra = ia === -1 ? 999 : ia;
      const rb = ib === -1 ? 999 : ib;
      if (ra !== rb) return ra - rb;
    }
    if (selectedChain === "solana") {
      if (a.id === "phantom") return -1;
      if (b.id === "phantom") return 1;
      if (a.id === "solflare") return -1;
      if (b.id === "solflare") return 1;
    }
    return 0;
  });

  const getWalletStatus = (wallet: WalletOption) => {
    if (wallet.id === "walletconnect") {
      return "installed";
    }

    if (wallet.id === "rainbowkit" && (selectedChain === "ethereum" || selectedChain === "bsc")) {
      return "installed";
    }

    const isDetected = detectedWallets.includes(wallet.id);
    if (isDetected) {
      return "installed";
    }
    return "not-installed";
  };

  const openInstallLink = (url: string) => {
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = url;
      return;
    }

    const openedWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      window.location.href = url;
    }
  };

  const handleWalletClick = async (wallet: WalletOption) => {
    // For Tron wallets, the TronWallet adapter will handle connection automatically
    // No need to show manual instructions - the adapter handles mobile app opening

    const status = getWalletStatus(wallet);

    const isTronTryConnect =
      selectedChain === "tron" && TRON_TRY_CONNECT_IDS.has(wallet.id);

    if (wallet.id === "trust" && selectedChain === "tron") {
      const win = globalWalletWindow();
      const hasTrustTronProvider = Boolean(win.trustwallet?.tronLink);
      if (!hasTrustTronProvider) {
        toast.message("Opening Trust Wallet", {
          description:
            "If the app does not open, install Trust Wallet or use “Any wallet (WalletConnect)” and scan with Trust.",
        });
        openInstallLink(buildTrustTronDeepLink());
        return;
      }
    }

    // If wallet is not installed, open install page.
    // For Tron wallets we usually attempt adapter connection anyway (detection is imperfect).
    if (!isTronTryConnect && status === "not-installed" && wallet.installUrl) {
      openInstallLink(wallet.installUrl);
      return;
    }

    setSelectedWallet(wallet.id);
    setTimeout(() => {
      onSelectWallet(wallet.method, wallet.id);
    }, 100);
  };

  if (!open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      // Prevent closing during connection
      if (isConnecting && !newOpen) {
        return;
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent 
        className="w-[calc(100vw-1.5rem)] max-w-[560px] rounded-2xl z-50 p-0 overflow-hidden border border-border/70 bg-card/95 shadow-[var(--shadow-xl)] backdrop-blur-md"
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside during connection
          if (isConnecting) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape during connection
          if (isConnecting) {
            e.preventDefault();
          }
        }}
      >
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Link wallet
            </DialogTitle>
            <DialogDescription>
              {selectedChain === "tron"
                ? "Use WalletConnect to pair Trust, SafePal, OKX, and most mobile wallets via QR — or pick an extension / in‑app browser below."
                : `Select a wallet to link to ${selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)} network`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
          {availableWallets.map((wallet) => {
            const status = getWalletStatus(wallet);
            const isSelected = selectedWallet === wallet.id && isConnecting;
            const isInstalled = status === "installed";

            return (
              <Button
                key={wallet.id}
                variant={isSelected ? "accent" : "outline"}
                className="w-full h-auto min-h-[78px] p-3 sm:p-4 justify-start items-start gap-3 sm:gap-4 hover:bg-accent/50 transition-colors text-left whitespace-normal overflow-hidden"
                onClick={() => handleWalletClick(wallet)}
                disabled={isConnecting}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="text-2xl shrink-0 leading-none">{wallet.icon}</div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{wallet.name}</span>
                      {isInstalled && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Detected
                        </Badge>
                      )}
                      {status === "not-installed" && wallet.installUrl && (
                        <Badge variant="outline" className="text-xs">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Install
                        </Badge>
                      )}
                      {wallet.id === "walletconnect" && selectedChain === "tron" && (
                        <Badge variant="default" className="text-xs">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                      {wallet.id === "walletconnect" && (
                        <Badge variant="outline" className="text-xs">
                          QR
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words leading-relaxed">
                      {(() => {
                        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
                        
                        // Show mobile-specific instructions for Tron wallets
                        if (
                          selectedChain === "tron" &&
                          (wallet.id === "tronlink" ||
                            wallet.id === "trust" ||
                            wallet.id === "okxwallet" ||
                            wallet.id === "safepal" ||
                            wallet.id === "metamask-tron" ||
                            wallet.id === "tokenpocket" ||
                            wallet.id === "bitkeep")
                        ) {
                          if (isMobile && !isInstalled) {
                            return `Mobile: Open this page in ${wallet.name} app's browser tab`;
                          }
                        }
                        // Show mobile-specific instructions for Phantom
                        if (wallet.id === "phantom") {
                          if (isMobile) {
                            return "Mobile: Tap to open Phantom app and link";
                          } else {
                            return "Desktop: Link using Phantom browser extension";
                          }
                        }
                        
                        return wallet.description;
                      })()}
                    </p>
                  </div>
                  {isSelected && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>

          {availableWallets.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No wallets available for {selectedChain} network.</p>
              <p className="text-sm mt-2">
                Please install a compatible wallet extension.
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground text-center whitespace-normal break-words">
              By linking a wallet, you agree to our Terms of Service and Privacy Policy.
              New to Web3?{" "}
              <a
                href="https://ethereum.org/en/wallets/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Learn more about wallets
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
