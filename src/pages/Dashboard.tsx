import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Wallet, CheckCircle2, XCircle, Clock, ExternalLink,
  Unlink, FileText, ChevronRight, LogOut, User, LayoutDashboard, ArrowUpRight
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

interface DashboardData {
  identityVerificationStatus: "verified" | "pending" | "not_started";
  linkedWallets: Array<{
    id: string;
    walletAddress: string;
    status: "Active" | "Unlinked";
    linkedAt: string | null;
    unlinkedAt: string | null;
  }>;
  paymentHistory: Array<{
    txHash: string;
    amountUsdt: number;
    walletAddress: string;
    paidAt: string;
  }>;
  disclosureHistory: Array<{
    id: string;
    walletAddress: string;
    lawfulRequestReference: string;
    approvedByUser: boolean;
    createdAt: string;
  }>;
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
  const [legalName, setLegalName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [country, setCountry] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [messageToSign, setMessageToSign] = useState("");
  const [signature, setSignature] = useState("");
  const [paymentTxHash, setPaymentTxHash] = useState("");
  const [walletStep, setWalletStep] = useState<"init" | "sign" | "pay">("init");

  const session = getSession();

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

  useEffect(() => {
    if (!session?.token) {
      navigate("/auth");
      return;
    }

    void loadDashboard();
  }, [navigate, session?.token]);

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
      await apiRequest("/kyc/submit", {
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
      toast.success("KYC verification completed.");
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to submit KYC";
      toast.error(message);
    } finally {
      setSubmittingKyc(false);
    }
  };

  const handleInitiateWallet = async () => {
    if (!walletAddress) {
      toast.error("Enter a wallet address first.");
      return;
    }

    try {
      setProcessingWallet(true);
      const response = await apiRequest<{ messageToSign: string }>("/wallet/link/initiate", {
        method: "POST",
        auth: true,
        body: { walletAddress }
      });
      setMessageToSign(response.messageToSign);
      setWalletStep("sign");
      toast.success("Challenge message generated. Sign it with your wallet.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to initiate wallet linking";
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const handleConfirmSignature = async () => {
    if (!walletAddress || !signature) {
      toast.error("Wallet address and signature are required.");
      return;
    }

    try {
      setProcessingWallet(true);
      await apiRequest("/wallet/link/confirm", {
        method: "POST",
        auth: true,
        body: { walletAddress, signature }
      });
      setWalletStep("pay");
      toast.success("Signature verified. Complete the 10 USDT payment.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Signature verification failed";
      toast.error(message);
    } finally {
      setProcessingWallet(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!walletAddress || !paymentTxHash) {
      toast.error("Wallet address and transaction hash are required.");
      return;
    }

    try {
      setProcessingWallet(true);
      await apiRequest("/payments/confirm", {
        method: "POST",
        auth: true,
        body: {
          walletAddress,
          txHash: paymentTxHash,
          amountUsdt: 10
        }
      });
      toast.success("Wallet is now identity-linked.");
      setWalletAddress("");
      setMessageToSign("");
      setSignature("");
      setPaymentTxHash("");
      setWalletStep("init");
      await loadDashboard();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to confirm payment";
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/85 backdrop-blur-xl border-b border-border/50 shadow-[var(--shadow-xs)]">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIUlink</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-1">
              Admin Panel <ArrowUpRight className="w-3 h-3" />
            </Link>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/70 border border-border/50">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {session?.user.email ?? "Unknown user"}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <LayoutDashboard className="w-6 h-6 text-accent" />
              <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
            </div>
            <p className="text-muted-foreground ml-9">Manage your identity verification and linked wallets</p>
          </div>
        </motion.div>

        {/* Status cards */}
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {[
            {
              label: "KYC Status",
              value:
                dashboardData?.identityVerificationStatus === "verified"
                  ? "Verified"
                  : dashboardData?.identityVerificationStatus === "pending"
                    ? "Pending"
                    : "Not Started",
              icon: CheckCircle2,
              iconClass: "text-success",
              accent: "from-success/10 to-success/5",
            },
            {
              label: "Linked Wallets",
              value: `${activeWalletCount} Active`,
              icon: Wallet,
              iconClass: "text-accent",
              accent: "from-accent/10 to-accent/5",
            },
            {
              label: "Total Payments",
              value: `${dashboardData?.paymentHistory.length ?? 0} Transactions`,
              icon: FileText,
              iconClass: "text-accent",
              accent: "from-accent/10 to-accent/5",
            },
          ].map((card, i) => (
            <motion.div key={card.label} initial="hidden" animate="visible" variants={fadeIn} custom={i + 1}>
              <Card className="stat-card rounded-2xl overflow-hidden">
                <CardContent className="p-6">
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
                  Complete KYC, sign your wallet verification challenge, then confirm 10 USDT payment.
                </p>
              </div>

              {dashboardData?.identityVerificationStatus !== "verified" && (
                <div className="grid md:grid-cols-2 gap-4">
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
                      Submit KYC
                    </Button>
                  </div>
                </div>
              )}

              {dashboardData?.identityVerificationStatus === "verified" && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="walletAddress">Wallet Address</Label>
                      <Input
                        id="walletAddress"
                        value={walletAddress}
                        onChange={(event) => setWalletAddress(event.target.value)}
                        placeholder="0x..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paymentHash">Payment Transaction Hash</Label>
                      <Input
                        id="paymentHash"
                        value={paymentTxHash}
                        onChange={(event) => setPaymentTxHash(event.target.value)}
                        placeholder="0x..."
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

                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={handleInitiateWallet} disabled={processingWallet}>
                      1) Generate Challenge
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleConfirmSignature}
                      disabled={processingWallet || walletStep === "init"}
                    >
                      2) Verify Signature
                    </Button>
                    <Button
                      variant="accent"
                      onClick={handleConfirmPayment}
                      disabled={processingWallet || walletStep !== "pay"}
                    >
                      3) Confirm 10 USDT Payment
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="wallets" className="space-y-6">
            <TabsList className="bg-muted/70 p-1.5 rounded-xl border border-border/50">
              <TabsTrigger value="wallets" className="rounded-lg font-medium">Wallets</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-lg font-medium">Payments</TabsTrigger>
              <TabsTrigger value="disclosures" className="rounded-lg font-medium">Disclosures</TabsTrigger>
            </TabsList>

            <TabsContent value="wallets" className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-foreground">Linked Wallets</h3>
              </div>
              <div className="space-y-3">
                {(dashboardData?.linkedWallets ?? []).map((wallet) => {
                  const walletStatus = wallet.status === "Active" ? "active" : "unlinked";
                  const linkedDateLabel = wallet.linkedAt
                    ? new Date(wallet.linkedAt).toLocaleDateString()
                    : "N/A";
                  const config = statusConfig[walletStatus];
                  return (
                    <Card key={wallet.id} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-semibold text-foreground">{wallet.walletAddress}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Linked {linkedDateLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`${config.className} rounded-lg px-2.5`}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          {walletStatus === "active" && (
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
                      No wallets linked yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Payment History</h3>
              <div className="space-y-3">
                {(dashboardData?.paymentHistory ?? []).map((payment) => (
                  <Card key={payment.txHash} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-success/8 border border-success/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">{payment.txHash}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(payment.paidAt).toLocaleDateString()} · {payment.amountUsdt} USDT
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {(dashboardData?.paymentHistory.length ?? 0) === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No payment records yet.
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
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {disc.id} - {disc.lawfulRequestReference}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Wallet {disc.walletAddress} · {new Date(disc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
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
    </div>
  );
};

export default Dashboard;
