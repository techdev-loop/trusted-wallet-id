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
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    description: "Connect using MetaMask browser extension",
    method: "injected",
    supportedChains: ["ethereum", "bsc"],
    installUrl: "https://metamask.io/download/",
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
    id: "tokenpocket",
    name: "TokenPocket",
    icon: "💼",
    description: "Mobile: Open in TokenPocket app's browser | Desktop: Browser extension",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://www.tokenpocket.pro/",
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
    id: "metamask-tron",
    name: "MetaMask (Tron)",
    icon: "🦊",
    description: "Use MetaMask with Tron network support",
    method: "injected",
    supportedChains: ["tron"],
    installUrl: "https://metamask.io/download/",
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
    description: "Desktop: Browser extension | Mobile: Open Phantom app",
    method: "injected",
    supportedChains: ["solana"],
    installUrl: "https://phantom.app/",
  },
];

// Additional EVM wallets that might be detected
const EVM_WALLETS = [
  { id: "coinbase", name: "Coinbase Wallet", icon: "🔵" },
  { id: "brave", name: "Brave Wallet", icon: "🦁" },
  { id: "trust", name: "Trust Wallet", icon: "🛡️" },
];

export function WalletSelectModal({
  open,
  onOpenChange,
  selectedChain,
  onSelectWallet,
  isConnecting,
}: WalletSelectModalProps) {
  const [detectedWallets, setDetectedWallets] = useState<string[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);

  // Detect installed wallets
  useEffect(() => {
    if (!open) return;

    const detected: string[] = [];

    // Check for MetaMask and other EVM wallets
    if (selectedChain === "ethereum" || selectedChain === "bsc") {
      if (typeof window !== "undefined") {
        const win = window as any;
        if (win.ethereum) {
          detected.push("metamask");
          
          // Check for other EVM wallets
          const ethereum = win.ethereum;
          if (ethereum.isCoinbaseWallet) detected.push("coinbase");
          if (ethereum.isBraveWallet) detected.push("brave");
          if (ethereum.isTrust) detected.push("trust");
          if (ethereum.providers && Array.isArray(ethereum.providers)) {
            // Multiple wallets detected
            ethereum.providers.forEach((provider: any) => {
              if (provider.isCoinbaseWallet && !detected.includes("coinbase")) {
                detected.push("coinbase");
              }
              if (provider.isBraveWallet && !detected.includes("brave")) {
                detected.push("brave");
              }
            });
          }
        }
      }
    }

    // Check for Tron wallets
    if (selectedChain === "tron") {
      if (typeof window !== "undefined") {
        const win = window as any;
        // TronLink injects tronWeb or tronLink
        if (win.tronWeb || win.tronLink) {
          detected.push("tronlink");
        }
        // TokenPocket also injects tronWeb
        if (win.tronWeb && win.tronWeb.isTokenPocket) {
          detected.push("tokenpocket");
        }
        // Check for other Tron wallets that might inject tronWeb
        if (win.tronWeb) {
          // TokenPocket detection
          if (win.tronWeb.isTokenPocket || win.isTokenPocket) {
            if (!detected.includes("tokenpocket")) {
              detected.push("tokenpocket");
            }
          }
        }
        if (win.trustwallet?.tronLink || win.trustwallet) {
          detected.push("trust");
        }
        if (win.ethereum?.isMetaMask || win.ethereum?.providers?.some((provider: any) => provider?.isMetaMask)) {
          detected.push("metamask-tron");
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
        // Check for other Solana wallets
        if (win.solflare) {
          // Solflare detected but not in our list, could add it
        }
      }
    }

    setDetectedWallets(detected);
  }, [open, selectedChain]);

  // Filter wallets by selected chain
  const availableWallets = WALLET_OPTIONS.filter((wallet) =>
    wallet.supportedChains.includes(selectedChain)
  ).sort((a, b) => {
    // Sort native wallets (TronLink, Phantom) first for their respective chains
    if (selectedChain === "tron") {
      if (a.id === "tronlink") return -1;
      if (b.id === "tronlink") return 1;
      if (a.id === "trust") return -1;
      if (b.id === "trust") return 1;
      if (a.id === "metamask-tron") return -1;
      if (b.id === "metamask-tron") return 1;
      if (a.id === "okxwallet") return -1;
      if (b.id === "okxwallet") return 1;
      if (a.id === "safepal") return -1;
      if (b.id === "safepal") return 1;
    }
    if (selectedChain === "solana") {
      if (a.id === "phantom") return -1;
      if (b.id === "phantom") return 1;
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
    // For EVM chains, if any EVM wallet is detected, show MetaMask as available
    if (wallet.id === "metamask" && (selectedChain === "ethereum" || selectedChain === "bsc")) {
      if (detectedWallets.length > 0) {
        return "installed";
      }
    }

    const isDetected = detectedWallets.includes(wallet.id);
    if (isDetected) {
      return "installed";
    }
    return "not-installed";
  };

  const handleWalletClick = async (wallet: WalletOption) => {
    // For Tron wallets, the TronWallet adapter will handle connection automatically
    // No need to show manual instructions - the adapter handles mobile app opening

    // Check if wallet needs to be installed
    if (wallet.isInstalled === false && wallet.installUrl) {
      window.open(wallet.installUrl, "_blank");
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
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words leading-relaxed">
                      {(() => {
                        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
                        
                        // Show mobile-specific instructions for Tron wallets
                        if (
                          selectedChain === "tron" &&
                          (wallet.id === "tronlink" ||
                            wallet.id === "tokenpocket" ||
                            wallet.id === "trust" ||
                            wallet.id === "metamask-tron" ||
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
