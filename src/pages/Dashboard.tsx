import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Wallet, CheckCircle2, XCircle, Clock, ExternalLink,
  Unlink, FileText, ChevronRight, LogOut, User, LayoutDashboard, ArrowUpRight, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, getSession } from "@/lib/session";
import {
  approveUSDT,
  connectWallet,
  getEthereumProvider,
  registerWalletViaContract,
  signWalletMessage,
  type WalletConnectionMethod,
  type Chain
} from "@/lib/web3";
import { useWagmiWallet } from "@/lib/wagmi-hooks";
import { useTronWallet } from "@/lib/tronwallet-adapter";
import { WalletSelectModal } from "@/components/WalletSelectModal";

interface DashboardData {
  identityVerificationStatus: "verified" | "pending" | "not_started" | "rejected" | "error";
  linkedWallets: Array<{
    id: string;
    walletAddress: string;
    status: "Active" | "Pending Verification" | "Unlinked";
    linkedAt: string | null;
    unlinkedAt: string | null;
  }>;
  disclosureHistory: Array<{
    id: string;
    walletAddress: string;
    lawfulRequestReference: string;
    approvedByUser: boolean;
    createdAt: string;
  }>;
}

interface KycStatusData {
  verificationStatus: "verified" | "pending" | "not_started" | "rejected" | "error";
  provider?: string | null;
  providerSessionId?: string | null;
  providerStatus?: string | null;
  providerSessionUrl?: string | null;
  reviewRequired?: boolean;
  lastError?: string | null;
}

const statusConfig = {
  active: { icon: CheckCircle2, label: "Active", className: "bg-success/10 text-success border-success/20" },
  unlinked: { icon: XCircle, label: "Unlinked", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { icon: Clock, label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  confirmed: { icon: CheckCircle2, label: "Confirmed", className: "bg-success/10 text-success border-success/20" },
  approved: { icon: CheckCircle2, label: "Approved", className: "bg-success/10 text-success border-success/20" },
};

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [processingWallet, setProcessingWallet] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatusData | null>(null);
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [country, setCountry] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [messageToSign, setMessageToSign] = useState("");
  const [signature, setSignature] = useState("");
  const [paymentReadyToPay, setPaymentReadyToPay] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<Chain>("ethereum");

  const session = getSession();
  const canAccessAdmin = session?.user.role === "admin" || session?.user.role === "compliance";

  const loadDashboard = async () => {
    try {
      const response = await apiRequest<DashboardData>("/dashboard", { auth: true });
      setDashboardData(response);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        navigate("/auth");
        return;
      }
      const message = error instanceof ApiError ? error.message : "Failed to load dashboard";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadKycStatus = async () => {
    try {
      const response = await apiRequest<KycStatusData>("/kyc/status", { auth: true });
      setKycStatus(response);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load KYC status";
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!session?.token) {
      navigate("/auth");
      return;
    }

    void loadDashboard();
    void loadKycStatus();
  }, [navigate, session?.token]);

  useEffect(() => {
    const status = kycStatus?.verificationStatus;
    if (!status || !["pending"].includes(status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadKycStatus();
      void loadDashboard();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [kycStatus?.verificationStatus]);

  const effectiveKycStatus = kycStatus?.verificationStatus ?? dashboardData?.identityVerificationStatus ?? "not_started";

  const activeWalletCount = useMemo(
    () => dashboardData?.linkedWallets.filter((wallet) => wallet.status === "Active").length ?? 0,
    [dashboardData]
  );

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  const handleKycSubmit = async () => {
    if (!consentAccepted) {
      toast.error("You must provide explicit consent before KYC submission.");
      return;
    }

    if (!legalName || !dateOfBirth || !nationalId || !country) {
      toast.error("Please complete all KYC fields.");
      return;
    }

    try {
      setSubmittingKyc(true);
      const submitResponse = await apiRequest<KycStatusData>("/kyc/submit", {
        method: "POST",
        auth: true,
        body: {
          consentAccepted,
          consentVersion: "v1",
          legalName,
          dateOfBirth,
          nationalId,
          country
        }
      });
      // Immediately store the session URL from submit so the button shows right away
      if (submitResponse.providerSessionUrl) {
        setKycStatus((prev) => ({
          ...prev,
          verificationStatus: "pending",
          providerSessionUrl: submitResponse.providerSessionUrl
        } as KycStatusData));
      }
      toast.success("KYC session created. Continue with provider verification.");
      await loadKycStatus();
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to submit KYC";
      toast.error(message);
    } finally {
      setSubmittingKyc(false);
    }
  };

  // Use Wagmi for EVM chains, TronWallet Adapter for Tron, native methods for Solana
  const wagmiWallet = useWagmiWallet();
  const tronWallet = useTronWallet();

  const handleConnectAndSignWallet = async (method: WalletConnectionMethod) => {
    try {
      setProcessingWallet(true);
      setIsWalletModalOpen(false); // Close modal when connecting starts
      
      let normalizedAddress: string;
      
      // Use Wagmi for EVM chains (Ethereum, BSC)
      if (selectedChain === "ethereum" || selectedChain === "bsc") {
        // Map method to connector ID
        const connectorId = method === "walletconnect" ? "walletConnect" : 
                           method === "injected" ? "injected" : undefined;
        normalizedAddress = await wagmiWallet.connectWallet(selectedChain, connectorId);
      } else if (selectedChain === "tron") {
        // Use TronWallet Adapter for Tron - automatically connect to TronLink
        // If already connected, use existing connection
        if (tronWallet.isConnected && tronWallet.address) {
          normalizedAddress = tronWallet.address;
        } else {
          // Auto-select adapter: prefer TronLink, fallback to WalletConnect on mobile
          const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
          const adapterType = (method === "walletconnect" || (isMobile && method === "auto")) 
            ? "walletconnect" 
            : "tronlink";
          normalizedAddress = await tronWallet.connect(adapterType);
        }
      } else {
        // Use native methods for Solana
        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
        const effectiveMethod = (isMobile && method === "auto") 
          ? "walletconnect" 
          : method;
        normalizedAddress = await connectWallet(selectedChain, effectiveMethod);
      }
      
      setWalletAddress(normalizedAddress);

      // For all chains, use message signing flow
      const initiateResponse = await apiRequest<{ messageToSign: string }>("/wallet/link/initiate", {
        method: "POST",
        auth: true,
        body: { 
          walletAddress: normalizedAddress,
          chain: selectedChain
        }
      });

      const challengeMessage = initiateResponse.messageToSign;
      setMessageToSign(challengeMessage);

      // Sign message with the appropriate wallet based on chain
      let signedMessage: string;
      if (selectedChain === "ethereum" || selectedChain === "bsc") {
        // Use Wagmi for EVM chains
        signedMessage = await wagmiWallet.signMessage(challengeMessage);
      } else if (selectedChain === "tron") {
        // Use TronWallet Adapter for Tron
        signedMessage = await tronWallet.signMessage(challengeMessage);
      } else {
        // Use native methods for Solana
        signedMessage = await signWalletMessage(challengeMessage, normalizedAddress, selectedChain);
      }
      setSignature(signedMessage);

      await apiRequest("/wallet/link/confirm", {
        method: "POST",
        auth: true,
        body: { 
          walletAddress: normalizedAddress, 
          signature: signedMessage,
          chain: selectedChain
        }
      });
      setPaymentReadyToPay(true);

      toast.success(
        effectiveKycStatus === "verified"
          ? "Wallet linked and active."
          : "Wallet linked. It will become active once KYC is verified."
      );
      await loadDashboard();
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to connect wallet and sign message";
      toast.error(message);
      // Reopen modal on error so user can try again (unless user rejected)
      if (error instanceof Error && !message.includes("User rejected") && !message.includes("user rejected")) {
        setIsWalletModalOpen(true);
      }
    } finally {
      setProcessingWallet(false);
    }
  };

  const handlePayUsdt = async () => {
    if (!walletAddress) {
      toast.error("Wallet address is required.");
      return;
    }

    if (!selectedChain) {
      toast.error("Please select a blockchain first.");
      return;
    }

    try {
      setProcessingWallet(true);
      toast.info("Preparing contract payment...");
      console.log(`[Payment] Starting payment process for ${selectedChain}`, { walletAddress, selectedChain });

      // Get contract config for the selected chain
      console.log(`[Payment] Fetching contract config for ${selectedChain}...`);
      const contractConfig = await apiRequest<{ contractAddress: string; usdtTokenAddress?: string }>(`/web3/contract-config/${selectedChain}`);
      console.log(`[Payment] Contract config received:`, contractConfig);
      
      if (!contractConfig.contractAddress) {
        const error = new Error(`Contract address is not configured for ${selectedChain}.`);
        console.error(`[Payment] Error:`, error);
        throw error;
      }

      // Step 1: Approve 10 USDT spend for the registry contract.
      console.log(`[Payment] Step 1: Approving USDT for ${selectedChain}...`);
      try {
        await approveUSDT(selectedChain, contractConfig.contractAddress, undefined, contractConfig.usdtTokenAddress);
        console.log(`[Payment] Step 1: USDT approval successful`);
      } catch (approveError) {
        console.error(`[Payment] Step 1: USDT approval failed:`, approveError);
        throw approveError;
      }

      // Step 2: Execute on-chain wallet registration/payment transaction.
      console.log(`[Payment] Step 2: Registering wallet via contract for ${selectedChain}...`);
      let txHash: string;
      try {
        txHash = await registerWalletViaContract(selectedChain, contractConfig.contractAddress);
        console.log(`[Payment] Step 2: Transaction successful, txHash:`, txHash);
      } catch (registerError) {
        console.error(`[Payment] Step 2: Wallet registration failed:`, registerError);
        console.error(`[Payment] Step 2: Error details:`, {
          error: registerError,
          message: registerError instanceof Error ? registerError.message : String(registerError),
          stack: registerError instanceof Error ? registerError.stack : undefined,
        });
        throw registerError;
      }

      // Step 3: Persist payment/activation on backend.
      console.log(`[Payment] Step 3: Confirming payment on backend...`);
      try {
        await apiRequest("/payments/confirm", {
          method: "POST",
          auth: true,
          body: {
            walletAddress,
            txHash,
            amountUsdt: 10,
            chain: selectedChain
          }
        });
        console.log(`[Payment] Step 3: Backend confirmation successful`);
      } catch (confirmError) {
        console.error(`[Payment] Step 3: Backend confirmation failed:`, confirmError);
        throw confirmError;
      }

      toast.success("10 USDT payment completed and wallet activated.");
      setPaymentReadyToPay(false);
      await loadDashboard();
    } catch (error) {
      console.error(`[Payment] Payment process failed:`, error);
      console.error(`[Payment] Error details:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        chain: selectedChain,
        walletAddress,
      });
      
      const message = error instanceof ApiError 
        ? error.message 
        : error instanceof Error 
          ? error.message 
          : "Failed to process 10 USDT payment";
      
      console.error(`[Payment] Showing error to user:`, message);
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const handleUnlinkWallet = async (address: string) => {
    try {
      await apiRequest(`/dashboard/wallets/${address}/unlink`, {
        method: "POST",
        auth: true
      });
      toast.success("Wallet unlinked successfully.");
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to unlink wallet";
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/88 backdrop-blur-xl border-b border-border/55 shadow-[var(--shadow-xs)]">
        <div className="page-container flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIUlink</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {canAccessAdmin && (
              <Link to="/admin" className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                Admin Panel <ArrowUpRight className="w-3 h-3" />
              </Link>
            )}
            <div className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-muted/70 border border-border/50">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground hidden md:block max-w-[180px] truncate">
                {session?.user.email ?? "Unknown user"}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="page-container py-6 sm:py-8 md:py-10 max-w-6xl">
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
          <div className="mb-7 sm:mb-9">
            <div className="flex items-center gap-3 mb-2">
              <LayoutDashboard className="w-6 h-6 text-accent" />
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            </div>
            <p className="text-muted-foreground ml-0 sm:ml-9">Manage your identity verification and linked wallets</p>
          </div>
        </motion.div>

        {/* Status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8 sm:mb-10">
          {[
            {
              label: "KYC Status",
              value:
                effectiveKycStatus === "verified"
                  ? "Verified"
                  : effectiveKycStatus === "pending"
                    ? "Pending"
                    : effectiveKycStatus === "rejected"
                      ? "Rejected"
                      : effectiveKycStatus === "error"
                        ? "Error"
                    : "Not Started",
              icon: CheckCircle2,
              iconClass: "text-success",
              accent: "from-success/10 to-success/5",
            },
            {
              label: "KYC Verified Wallets",
              value: `${activeWalletCount} Active`,
              icon: Wallet,
              iconClass: "text-accent",
              accent: "from-accent/10 to-accent/5",
            },
            {
              label: "Verification Stage",
              value: effectiveKycStatus === "verified" ? "Approved" : effectiveKycStatus === "pending" ? "Pending" : "Open",
              icon: FileText,
              iconClass: "text-accent",
              accent: "from-accent/10 to-accent/5",
            },
          ].map((card, i) => (
            <motion.div key={card.label} initial="hidden" animate="visible" variants={fadeIn} custom={i + 1}>
              <Card className="stat-card rounded-2xl overflow-hidden">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center`}>
                      <card.icon className={`w-5 h-5 ${card.iconClass}`} />
                    </div>
                  </div>
                  <p className="font-display text-xl font-bold text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={4}>
          <Card className="glass-card rounded-2xl mb-8">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">Onboarding Actions</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete KYC and connect wallets. Wallets linked during pending review become active once verified.
                </p>
              </div>

              {effectiveKycStatus === "pending" && (
                <div className="flex flex-col items-start gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20 w-full">
                    <Loader2 className="w-5 h-5 text-warning animate-spin shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Verification in progress</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Your identity is being reviewed. This page will update automatically once verified.
                      </p>
                    </div>
                  </div>
                  {kycStatus?.providerSessionUrl && (
                    <Button asChild variant="outline">
                      <a href={kycStatus.providerSessionUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Continue Verification with Provider
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {(effectiveKycStatus === "not_started" || effectiveKycStatus === "error") && (
                <div className="grid md:grid-cols-2 gap-3.5 sm:gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Name</Label>
                    <Input
                      id="legalName"
                      value={legalName}
                      onChange={(event) => setLegalName(event.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      value={dateOfBirth}
                      onChange={(event) => setDateOfBirth(event.target.value)}
                      placeholder="1990-01-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nationalId">National ID</Label>
                    <Input
                      id="nationalId"
                      value={nationalId}
                      onChange={(event) => setNationalId(event.target.value)}
                      placeholder="ID12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder="Country"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-3">
                    <Checkbox
                      id="consent"
                      checked={consentAccepted}
                      onCheckedChange={(checked) => setConsentAccepted(Boolean(checked))}
                    />
                    <Label htmlFor="consent" className="text-sm text-muted-foreground">
                      I consent to KYC verification and identity-wallet linkage.
                    </Label>
                  </div>
                  <div className="md:col-span-2">
                    <Button variant="accent" onClick={handleKycSubmit} disabled={submittingKyc}>
                      Start KYC Verification
                    </Button>
                  </div>
                  {effectiveKycStatus === "error" && kycStatus?.lastError && (
                    <div className="md:col-span-2 text-sm text-destructive">
                      {kycStatus.lastError}
                    </div>
                  )}
                </div>
              )}

              {effectiveKycStatus === "rejected" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20 w-full">
                  <XCircle className="w-5 h-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Verification rejected</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your identity verification was not approved. Please contact support.
                    </p>
                  </div>
                </div>
              )}

              {(effectiveKycStatus === "pending" || effectiveKycStatus === "verified") && (
                <div className="space-y-4">
                  {/* Chain Selection */}
                  <div className="space-y-2">
                    <Label>Select Blockchain</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(["ethereum", "bsc", "tron", "solana"] as Chain[]).map((chain) => (
                        <Button
                          key={chain}
                          variant={selectedChain === chain ? "accent" : "outline"}
                          className="h-auto py-3"
                          onClick={() => setSelectedChain(chain)}
                          type="button"
                        >
                          <span className="font-semibold capitalize text-sm">
                            {chain === "ethereum" ? "ETH" : chain === "bsc" ? "BSC" : chain.toUpperCase()}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="walletAddress">Wallet Address</Label>
                      <Input
                        id="walletAddress"
                        value={walletAddress}
                        onChange={(event) => setWalletAddress(event.target.value)}
                        placeholder={selectedChain === "tron" ? "T..." : selectedChain === "solana" ? "Base58..." : "0x..."}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="messageToSign">Message To Sign</Label>
                    <Textarea
                      id="messageToSign"
                      value={messageToSign}
                      readOnly
                      placeholder="Generate challenge first, then sign this message in your wallet."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signature">Wallet Signature</Label>
                    <Textarea
                      id="signature"
                      value={signature}
                      onChange={(event) => setSignature(event.target.value)}
                      placeholder="Paste signature here after signing."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                    <Button
                      variant="accent"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
                        
                        // Always show modal to let user choose wallet
                        // This is especially important for Tron on mobile where multiple options exist
                        setIsWalletModalOpen(true);
                      }}
                      disabled={processingWallet}
                      className="w-full sm:w-auto"
                      type="button"
                    >
                      {processingWallet ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 mr-2" />
                          Complete & Verify
                        </>
                      )}
                    </Button>
                    {paymentReadyToPay && (
                      <Button
                        variant="accent"
                        onClick={handlePayUsdt}
                        disabled={processingWallet}
                        className="w-full sm:w-auto"
                      >
                        Pay 10 USDT
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="wallets" className="space-y-6">
            <TabsList className="bg-muted/70 p-1.5 rounded-xl border border-border/50 w-full sm:w-auto overflow-x-auto max-w-full">
              <TabsTrigger value="wallets" className="rounded-lg font-medium shrink-0">Wallets</TabsTrigger>
              <TabsTrigger value="disclosures" className="rounded-lg font-medium shrink-0">Disclosures</TabsTrigger>
            </TabsList>

            <TabsContent value="wallets" className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-foreground">KYC Verified Wallet</h3>
              </div>
              <div className="space-y-3">
                {(dashboardData?.linkedWallets ?? []).map((wallet) => {
                  const walletStatus =
                    wallet.status === "Active"
                      ? "active"
                      : wallet.status === "Pending Verification"
                        ? "pending"
                        : "unlinked";
                  const linkedDateLabel = wallet.linkedAt
                    ? new Date(wallet.linkedAt).toLocaleDateString()
                    : "N/A";
                  const config = statusConfig[walletStatus];
                  return (
                    <Card key={wallet.id} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-semibold text-foreground break-all">{wallet.walletAddress}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Linked {linkedDateLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-start sm:self-auto">
                          <Badge variant="outline" className={`${config.className} rounded-lg px-2.5`}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          {(walletStatus === "active" || walletStatus === "pending") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-lg h-9 w-9"
                              onClick={() => void handleUnlinkWallet(wallet.walletAddress)}
                            >
                              <Unlink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(dashboardData?.linkedWallets.length ?? 0) === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No KYC-verified wallet yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Disclosure History</h3>
              <div className="space-y-3">
                {(dashboardData?.disclosureHistory ?? []).map((disc) => {
                  const disclosureStatus = disc.approvedByUser ? "approved" : "pending";
                  const config = statusConfig[disclosureStatus];
                  return (
                    <Card key={disc.id} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {disc.id} - {disc.lawfulRequestReference}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">
                              Wallet {disc.walletAddress} · {new Date(disc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 self-start sm:self-auto">
                          <Badge variant="outline" className={`${config.className} rounded-lg px-2.5`}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {(dashboardData?.disclosureHistory.length ?? 0) === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No disclosure history available.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <WalletSelectModal
        open={isWalletModalOpen}
        onOpenChange={(open) => {
          if (!processingWallet) {
            setIsWalletModalOpen(open);
          }
        }}
        selectedChain={selectedChain}
        onSelectWallet={handleConnectAndSignWallet}
        isConnecting={processingWallet}
      />
    </div>
  );
};

export default Dashboard;
