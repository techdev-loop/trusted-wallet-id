import { useState, useEffect } from "react";
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react";
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

// Wallet definitions
const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "rainbowkit",
    name: "RainbowKit",
    icon: "🌈",
    description: "Open RainbowKit to choose any EVM wallet (MetaMask, WalletConnect, Coinbase, etc.)",
    method: "auto",
    supportedChains: ["ethereum", "bsc"],
  },
  {
    id: "tronlink",
    name: "TronLink",
    icon: "🔷",
    description: "Desktop: Browser extension | Mobile: Open in TronLink app's browser",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.tronlink.org/",
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    description: "Open this page in Trust Wallet app browser to connect Tron wallet",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://trustwallet.com/",
  },
  {
    id: "okxwallet",
    name: "OKX Wallet",
    icon: "⭕",
    description: "Connect with OKX Wallet for Tron",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.okx.com/web3",
  },
  {
    id: "safepal",
    name: "SafePal",
    icon: "🛡️",
    description: "Connect SafePal in dApp browser for Tron",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.safepal.com/",
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    description: "Connect with Phantom via Solana Wallet Adapter",
    method: "injected",
    supportedChains: ["solana"],
    installUrl: "https://phantom.app/",
  },
  {
    id: "solflare",
    name: "Solflare",
    icon: "☀️",
    description: "Connect with Solflare via Solana Wallet Adapter",
    method: "injected",
    supportedChains: ["solana"],
    installUrl: "https://solflare.com/",
  },
  {
    id: "walletconnect",
    name: "WalletConnect (QR)",
    icon: "🔗",
    description: "Connect Tron wallets by scanning WalletConnect QR code",
    method: "walletconnect",
    supportedChains: ["tron"],
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
        const win = window as any;
        const userAgent = String(navigator.userAgent || "").toLowerCase();
        // TronLink injects tronWeb or tronLink
        if (win.tronWeb || win.tronLink) {
          detected.push("tronlink");
        }
        // Check for other Tron wallets that might inject tronWeb
        if (win.tronWeb) {
        }
        if (
          win.trustwallet?.tronLink ||
          win.ethereum?.isTrust ||
          userAgent.includes("trustwallet") ||
          userAgent.includes("trust wallet")
        ) {
          detected.push("trust");
        }
        if (win.okxwallet?.tronLink || win.okxwallet) {
          detected.push("okxwallet");
        }
        if (win.safepal || win.ethereum?.isSafePal || win.ethereum?.providers?.some((provider: any) => provider?.isSafePal)) {
          detected.push("safepal");
        }
      }
    }

    // Check for Phantom and other Solana wallets
    if (selectedChain === "solana") {
      if (typeof window !== "undefined") {
        const win = window as any;
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

  // Filter wallets by selected chain
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

  const availableWallets = WALLET_OPTIONS.filter((wallet) => {
    if (!wallet.supportedChains.includes(selectedChain)) {
      return false;
    }
    if (isMobile && (wallet.id === "trust" || wallet.id === "safepal")) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (isMobile) {
      if (a.id === "walletconnect") return -1;
      if (b.id === "walletconnect") return 1;
    }

    // Sort native wallets (TronLink, Phantom) first for their respective chains
    if (selectedChain === "tron") {
      if (a.id === "tronlink") return -1;
      if (b.id === "tronlink") return 1;
      if (a.id === "trust") return -1;
      if (b.id === "trust") return 1;
      if (a.id === "okxwallet") return -1;
      if (b.id === "okxwallet") return 1;
      if (a.id === "safepal") return -1;
      if (b.id === "safepal") return 1;
    }
    if (selectedChain === "solana") {
      if (a.id === "phantom") return -1;
      if (b.id === "phantom") return 1;
      if (a.id === "solflare") return -1;
      if (b.id === "solflare") return 1;
    }
    return 0;
  });

  // Debug: log available wallets
  useEffect(() => {
    if (open) {
      console.log("Available wallets for", selectedChain, ":", availableWallets.map(w => w.name));
    }
  }, [open, selectedChain, availableWallets]);

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

    const isTronWalletOption =
      selectedChain === "tron" &&
      ["tronlink", "trust", "okxwallet", "safepal", "walletconnect"].includes(wallet.id);

    if (wallet.id === "trust" && selectedChain === "tron") {
      const win = window as any;
      const hasTrustTronProvider = Boolean(win?.trustwallet?.tronLink);
      if (!hasTrustTronProvider) {
        openInstallLink(buildTrustTronDeepLink());
        return;
      }
    }

    // If wallet is not installed, open install page.
    // For Tron wallets, try connecting first even when detection is uncertain on mobile.
    if (!isTronWalletOption && status === "not-installed" && wallet.installUrl) {
      openInstallLink(wallet.installUrl);
      return;
    }

    console.log("Wallet selected:", wallet.name, "method:", wallet.method, "walletId:", wallet.id);
    setSelectedWallet(wallet.id);
    // Small delay to ensure modal state updates before connection starts
    setTimeout(() => {
      onSelectWallet(wallet.method, wallet.id);
    }, 100);
  };

  // Debug: log when modal state changes
  useEffect(() => {
    console.log("WalletSelectModal open state:", open);
  }, [open]);

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
              Connect Wallet
            </DialogTitle>
            <DialogDescription>
              Select a wallet to connect to {selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)} network
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
                      {wallet.id === "walletconnect" && (
                        <Badge variant="secondary" className="text-xs">
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
                            wallet.id === "safepal")
                        ) {
                          if (isMobile && !isInstalled) {
                            return `Mobile: Open this page in ${wallet.name} app's browser tab`;
                          }
                        }
                        // Show mobile-specific instructions for Phantom
                        if (wallet.id === "phantom") {
                          if (isMobile) {
                            return "Mobile: Tap to open Phantom app and connect";
                          } else {
                            return "Desktop: Connect using Phantom browser extension";
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
              By connecting, you agree to our Terms of Service and Privacy Policy.
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
