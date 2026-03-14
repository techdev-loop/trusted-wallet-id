import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Search, Users, FileText, Clock, CheckCircle2,
  Eye, ChevronRight, LogOut, User, ShieldCheck, AlertTriangle, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WalletSelectModal } from "@/components/WalletSelectModal";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, getSession } from "@/lib/session";
import { connectWallet, transferUSDT, withdrawUSDTFromContract, type Chain, type WalletConnectionMethod } from "@/lib/web3";

interface WalletLookupResult {
  userId: string;
  email: string | null;
  walletAddress: string;
  walletStatus: string;
}

interface IdentityResult {
  userId: string;
  verificationStatus: string;
  identityData: Record<string, unknown>;
}

interface AuditLogEntry {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  target_user_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
}

interface DisclosureRequestRecord {
  id: string;
  userId: string;
  walletAddress: string;
  lawfulRequestReference: string;
  status: "pending" | "approved";
}

type SupportedChain = Chain;

interface WithdrawalEntry {
  id: string;
  chain: SupportedChain;
  amountUsdt: number;
  destinationAddress: string;
  status: "completed";
  note: string;
  txHash: string;
  createdAt: string;
}

interface PaidWalletEntry {
  userId: string;
  walletAddress: string;
  paymentCount: number;
  totalPaidUsdt: number;
  lastPaidAt: string;
  usdtBalance: string | null;
  balanceFetchError: string | null;
}

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const Admin = () => {
  const navigate = useNavigate();
  const session = getSession();
  const [loading, setLoading] = useState(true);
  const [searchWalletAddress, setSearchWalletAddress] = useState("");
  const [walletLookupResult, setWalletLookupResult] = useState<WalletLookupResult | null>(null);
  const [identityResult, setIdentityResult] = useState<IdentityResult | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [disclosureRequests, setDisclosureRequests] = useState<DisclosureRequestRecord[]>([]);
  const [newDisclosureUserId, setNewDisclosureUserId] = useState("");
  const [newDisclosureWallet, setNewDisclosureWallet] = useState("");
  const [newDisclosureReference, setNewDisclosureReference] = useState("");
  const [approveRequestId, setApproveRequestId] = useState("");
  const [approvedByUser, setApprovedByUser] = useState(false);
  const [selectedChain, setSelectedChain] = useState<SupportedChain>("ethereum");
  const [withdrawalEntries, setWithdrawalEntries] = useState<WithdrawalEntry[]>([]);
  const [withdrawalDestination, setWithdrawalDestination] = useState("");
  const [withdrawalAmountUsdt, setWithdrawalAmountUsdt] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [withdrawalWalletAddress, setWithdrawalWalletAddress] = useState("");
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [manageWalletChain, setManageWalletChain] = useState<SupportedChain>("ethereum");
  const [paidWalletEntries, setPaidWalletEntries] = useState<PaidWalletEntry[]>([]);
  const [isLoadingPaidWalletEntries, setIsLoadingPaidWalletEntries] = useState(false);
  const [isSendUsdtModalOpen, setIsSendUsdtModalOpen] = useState(false);
  const [sendUsdtTarget, setSendUsdtTarget] = useState<PaidWalletEntry | null>(null);
  const [sendUsdtAmount, setSendUsdtAmount] = useState("10");
  const [sendUsdtWalletAddress, setSendUsdtWalletAddress] = useState("");
  const [isConnectingSendUsdtWallet, setIsConnectingSendUsdtWallet] = useState(false);
  const [isSendingUsdt, setIsSendingUsdt] = useState(false);

  const canAccessAdmin = session?.user.role === "admin" || session?.user.role === "compliance";
  const canViewIdentityData = session?.user.role === "compliance";

  const loadAuditLogs = async () => {
    try {
      const response = await apiRequest<{ entries: AuditLogEntry[] }>("/admin/audit-logs?limit=50", {
        auth: true
      });
      setAuditLogs(response.entries);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load audit logs";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPaidWalletEntries = async (chain: SupportedChain) => {
    if (!["ethereum", "bsc", "tron"].includes(chain)) {
      setPaidWalletEntries([]);
      return;
    }

    try {
      setIsLoadingPaidWalletEntries(true);
      const response = await apiRequest<{ chain: string; entries: PaidWalletEntry[] }>(
        `/admin/paid-wallets?chain=${encodeURIComponent(chain)}`,
        { auth: true }
      );
      setPaidWalletEntries(response.entries);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to load paid wallets";
      toast.error(message);
    } finally {
      setIsLoadingPaidWalletEntries(false);
    }
  };

  useEffect(() => {
    if (!session?.token) {
      navigate("/auth");
      return;
    }

    if (!canAccessAdmin) {
      setLoading(false);
      return;
    }

    void loadAuditLogs();
  }, [canAccessAdmin, navigate, session?.token]);

  useEffect(() => {
    if (!session?.token || !canAccessAdmin) {
      return;
    }
    void loadPaidWalletEntries(manageWalletChain);
  }, [canAccessAdmin, manageWalletChain, session?.token]);

  const handleLogout = () => {
    clearSession();
    navigate("/");
  };

  const handleWalletLookup = async () => {
    if (!searchWalletAddress) {
      toast.error("Enter a wallet address to search.");
      return;
    }

    try {
      const response = await apiRequest<WalletLookupResult>(
        `/admin/users/by-wallet/${encodeURIComponent(searchWalletAddress)}`,
        { auth: true }
      );
      setWalletLookupResult(response);
      toast.success("User record loaded.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Wallet lookup failed";
      toast.error(message);
    }
  };

  const handleViewIdentity = async () => {
    if (!walletLookupResult?.userId) {
      toast.error("Search for a user first.");
      return;
    }
    if (!canViewIdentityData) {
      toast.error("Only compliance role can view decrypted identity data.");
      return;
    }

    try {
      const response = await apiRequest<IdentityResult>(`/admin/identity/${walletLookupResult.userId}`, {
        auth: true
      });
      setIdentityResult(response);
      toast.success("Identity view loaded and logged.");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to view identity data";
      toast.error(message);
    }
  };

  const handleCreateDisclosureRequest = async () => {
    if (!newDisclosureUserId || !newDisclosureWallet || !newDisclosureReference) {
      toast.error("Please fill all disclosure request fields.");
      return;
    }

    try {
      const response = await apiRequest<{ disclosureRequestId: string; status: "pending" }>(
        "/admin/disclosures",
        {
          method: "POST",
          auth: true,
          body: {
            userId: newDisclosureUserId,
            walletAddress: newDisclosureWallet,
            lawfulRequestReference: newDisclosureReference
          }
        }
      );

      setDisclosureRequests((current) => [
        {
          id: response.disclosureRequestId,
          userId: newDisclosureUserId,
          walletAddress: newDisclosureWallet,
          lawfulRequestReference: newDisclosureReference,
          status: response.status
        },
        ...current
      ]);

      setNewDisclosureUserId("");
      setNewDisclosureWallet("");
      setNewDisclosureReference("");
      toast.success("Disclosure request created.");
      await loadAuditLogs();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to create disclosure request";
      toast.error(message);
    }
  };

  const handleApproveDisclosure = async () => {
    if (!approveRequestId) {
      toast.error("Enter a disclosure request ID.");
      return;
    }

    try {
      await apiRequest(`/admin/disclosures/${approveRequestId}/approve`, {
        method: "POST",
        auth: true,
        body: { approvedByUser }
      });
      setDisclosureRequests((current) =>
        current.map((request) =>
          request.id === approveRequestId ? { ...request, status: "approved" } : request
        )
      );
      toast.success("Disclosure request approved.");
      await loadAuditLogs();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to approve disclosure request";
      toast.error(message);
    }
  };

  const handleConnectWithdrawalWallet = async (method: WalletConnectionMethod) => {
    try {
      setIsConnectingWallet(true);
      setIsWalletModalOpen(false);
      const address = await connectWallet(selectedChain, method);
      setWithdrawalWalletAddress(address);
      toast.success("Wallet connected for withdrawal.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect wallet";
      toast.error(message);
      setIsWalletModalOpen(true);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleCreateWithdrawalRequest = async () => {
    const parsedAmount = Number.parseFloat(withdrawalAmountUsdt);
    if (!withdrawalDestination || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter destination address and a valid withdrawal amount.");
      return;
    }
    if (!withdrawalWalletAddress) {
      toast.error("Connect an admin wallet first.");
      return;
    }
    try {
      setIsSubmittingWithdrawal(true);
      
      // Get contract config to get the contract address
      const contractConfig = await apiRequest<{ contractAddress: string; usdtTokenAddress?: string }>(
        `/web3/contract-config/${selectedChain}`
      );
      
      if (!contractConfig.contractAddress) {
        throw new Error(`Contract address is not configured for ${selectedChain}.`);
      }

      // Withdraw from the contract using withdrawUSDT function
      const txHash = await withdrawUSDTFromContract(
        selectedChain,
        contractConfig.contractAddress,
        withdrawalDestination,
        withdrawalAmountUsdt,
        contractConfig.usdtTokenAddress
      );
      
      setWithdrawalEntries((current) => [
        {
          id: crypto.randomUUID(),
          chain: selectedChain,
          amountUsdt: parsedAmount,
          destinationAddress: withdrawalDestination,
          status: "completed",
          note: withdrawalNote,
          txHash,
          createdAt: new Date().toISOString()
        },
        ...current
      ]);
      setWithdrawalNote("");
      setWithdrawalAmountUsdt("");
      setWithdrawalDestination("");
      toast.success("Withdrawal transaction submitted successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit withdrawal";
      toast.error(message);
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const handleChainChange = (nextChain: SupportedChain) => {
    setSelectedChain(nextChain);
    if (withdrawalWalletAddress) {
      setWithdrawalWalletAddress("");
      toast.message("Chain changed. Reconnect wallet for this chain.");
    }
  };

  const handleManageWalletChainChange = (nextChain: SupportedChain) => {
    setManageWalletChain(nextChain);
    setSendUsdtWalletAddress("");
  };

  const openSendUsdtModal = (entry: PaidWalletEntry) => {
    setSendUsdtTarget(entry);
    setSendUsdtAmount("10");
    setIsSendUsdtModalOpen(true);
  };

  const handleConnectSendUsdtWallet = async () => {
    try {
      setIsConnectingSendUsdtWallet(true);
      const address = await connectWallet(manageWalletChain, "auto");
      setSendUsdtWalletAddress(address);
      toast.success("Admin wallet connected for user transfer.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect admin wallet";
      toast.error(message);
    } finally {
      setIsConnectingSendUsdtWallet(false);
    }
  };

  const handleSendUsdtToUser = async () => {
    if (!sendUsdtTarget) {
      toast.error("No target wallet selected.");
      return;
    }

    const parsedAmount = Number.parseFloat(sendUsdtAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid USDT amount.");
      return;
    }

    if (!sendUsdtWalletAddress) {
      toast.error("Connect admin wallet first.");
      return;
    }

    try {
      setIsSendingUsdt(true);
      const contractConfig = await apiRequest<{ usdtTokenAddress?: string }>(`/web3/contract-config/${manageWalletChain}`);
      const txHash = await transferUSDT(
        manageWalletChain,
        sendUsdtTarget.walletAddress,
        sendUsdtAmount,
        contractConfig.usdtTokenAddress
      );
      toast.success(`USDT sent successfully. Tx: ${txHash.slice(0, 12)}...`);
      setIsSendUsdtModalOpen(false);
      await loadPaidWalletEntries(manageWalletChain);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send USDT";
      toast.error(message);
    } finally {
      setIsSendingUsdt(false);
    }
  };

  const getTxExplorerBaseUrl = (chain: SupportedChain): string => {
    if (chain === "ethereum") return "https://sepolia.etherscan.io/tx/";
    if (chain === "bsc") return "https://bscscan.com/tx/";
    if (chain === "solana") return "https://explorer.solana.com/tx/";
    return "https://tronscan.org/#/transaction/";
  };

  const getWithdrawalPlaceholder = (chain: SupportedChain): string => {
    if (chain === "tron") return "T...";
    if (chain === "solana") return "Base58 address";
    return "0x...";
  };

  const getConnectedWalletDisplay = (): string => {
    if (!withdrawalWalletAddress) return "Not connected";
    if (withdrawalWalletAddress.length <= 14) return withdrawalWalletAddress;
    return `${withdrawalWalletAddress.slice(0, 8)}...${withdrawalWalletAddress.slice(-6)}`;
  };

  const openWalletModal = () => {
    setIsWalletModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="page-shell">
        <header className="sticky top-0 z-50 bg-card/88 backdrop-blur-xl border-b border-border/55 shadow-[var(--shadow-xs)]">
          <div className="page-container flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
                <Shield className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-lg text-foreground">FIU ID</span>
              <Badge className="ml-1.5 text-[10px] gradient-accent text-accent-foreground border-0 rounded-md px-2">Admin</Badge>
            </Link>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <div className="page-container py-6 sm:py-8 md:py-10 max-w-6xl">
          <Card className="glass-card rounded-2xl mb-8">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Your account role is <strong>{session?.user.role}</strong>. Admin panel access requires
                `admin` or `compliance` privileges.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="sticky top-0 z-50 bg-card/88 backdrop-blur-xl border-b border-border/55 shadow-[var(--shadow-xs)]">
        <div className="page-container flex items-center justify-between h-14 sm:h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIU ID</span>
            <Badge className="ml-1.5 text-[10px] gradient-accent text-accent-foreground border-0 rounded-md px-2">Admin</Badge>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/dashboard"
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              User Dashboard
            </Link>
            <div className="flex items-center gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-muted/70 border border-border/50">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground hidden md:block max-w-[180px] truncate">
                {session?.user.email ?? "Unknown admin"}
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
              <ShieldCheck className="w-6 h-6 text-accent" />
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">Admin Panel</h1>
            </div>
            <p className="text-muted-foreground ml-0 sm:ml-9">Manage users, disclosure requests, and audit logs</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8 sm:mb-10">
          {[
            { label: "User Records", value: walletLookupResult ? 1 : 0, icon: Users, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
            { label: "Identity Views", value: identityResult ? 1 : 0, icon: CheckCircle2, iconClass: "text-success", accent: "from-success/10 to-success/5" },
            { label: "Pending", value: disclosureRequests.filter((request) => request.status === "pending").length, icon: Clock, iconClass: "text-warning", accent: "from-warning/10 to-warning/5" },
            { label: "Audit Events", value: auditLogs.length, icon: FileText, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
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
                  <p className="font-display text-3xl font-bold text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-muted/70 p-1.5 rounded-xl border border-border/50 w-full sm:w-auto overflow-x-auto max-w-full">
              <TabsTrigger value="users" className="rounded-lg font-medium shrink-0">Users</TabsTrigger>
              <TabsTrigger value="disclosures" className="rounded-lg font-medium shrink-0">Disclosure Requests</TabsTrigger>
              <TabsTrigger value="withdrawals" className="rounded-lg font-medium shrink-0">Withdrawals</TabsTrigger>
              <TabsTrigger value="manage-wallets" className="rounded-lg font-medium shrink-0">Manage Users Wallet</TabsTrigger>
              <TabsTrigger value="audit" className="rounded-lg font-medium shrink-0">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-5">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by wallet address..."
                  className="pl-11 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card transition-colors"
                  value={searchWalletAddress}
                  onChange={(event) => setSearchWalletAddress(event.target.value)}
                />
              </div>
              <Button variant="accent" onClick={() => void handleWalletLookup()} disabled={!canAccessAdmin} className="w-full sm:w-auto">
                Search Wallet
              </Button>
              <div className="space-y-3">
                {walletLookupResult && (
                  <Card key={walletLookupResult.userId} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {walletLookupResult.userId} - {walletLookupResult.email ?? "No email"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5 break-all">
                            {walletLookupResult.walletAddress} · {walletLookupResult.walletStatus}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-start sm:self-auto">
                        <Badge
                          variant="outline"
                          className={`rounded-lg px-2.5 ${
                            identityResult?.verificationStatus === "verified"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-warning/10 text-warning border-warning/20"
                          }`}
                        >
                          {identityResult?.verificationStatus === "verified" ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg h-9 w-9"
                          onClick={() => void handleViewIdentity()}
                          disabled={!canViewIdentityData}
                          title={
                            canViewIdentityData
                              ? "View decrypted identity data"
                              : "Only compliance role can view decrypted identity data"
                          }
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!walletLookupResult && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      Search by wallet address to load the matched user.
                    </CardContent>
                  </Card>
                )}
                {identityResult && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 space-y-3">
                      <p className="text-sm font-semibold text-foreground">Decrypted Identity Data</p>
                      <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                        {JSON.stringify(identityResult.identityData, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
                {!canViewIdentityData && walletLookupResult && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      Identity data viewing is restricted to `compliance` role.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Lawful Disclosure Requests</h3>
              <Card className="glass-card rounded-xl">
                <CardContent className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="disclosureUserId">User ID</Label>
                    <Input
                      id="disclosureUserId"
                      value={newDisclosureUserId}
                      onChange={(event) => setNewDisclosureUserId(event.target.value)}
                      placeholder="UUID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disclosureWallet">Wallet Address</Label>
                    <Input
                      id="disclosureWallet"
                      value={newDisclosureWallet}
                      onChange={(event) => setNewDisclosureWallet(event.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="disclosureReference">Lawful Request Reference</Label>
                    <Input
                      id="disclosureReference"
                      value={newDisclosureReference}
                      onChange={(event) => setNewDisclosureReference(event.target.value)}
                      placeholder="Case / order reference"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button variant="accent" onClick={() => void handleCreateDisclosureRequest()} disabled={!canAccessAdmin}>
                      Create Disclosure Request
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-xl">
                <CardContent className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="approveRequestId">Disclosure Request ID</Label>
                    <Input
                      id="approveRequestId"
                      value={approveRequestId}
                      onChange={(event) => setApproveRequestId(event.target.value)}
                      placeholder="UUID"
                    />
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 pb-2">
                      <Checkbox
                        id="approvedByUser"
                        checked={approvedByUser}
                        onCheckedChange={(checked) => setApprovedByUser(Boolean(checked))}
                      />
                      <Label htmlFor="approvedByUser">Prior user consent recorded</Label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Button variant="outline" onClick={() => void handleApproveDisclosure()} disabled={!canAccessAdmin}>
                      Approve Disclosure Request
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {disclosureRequests.map((req) => (
                  <Card key={req.id} className="glass-card rounded-xl">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground break-all">{req.id}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">
                              User: {req.userId} · Wallet: {req.walletAddress}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`rounded-lg px-2.5 ${
                            req.status === "pending"
                              ? "bg-warning/10 text-warning border-warning/20"
                              : "bg-success/10 text-success border-success/20"
                          }`}
                        >
                          {req.status === "pending" ? (
                            <><Clock className="w-3 h-3 mr-1" /> Pending</>
                          ) : (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground sm:ml-[60px] break-words">{req.lawfulRequestReference}</p>
                    </CardContent>
                  </Card>
                ))}
                {disclosureRequests.length === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No disclosure requests created in this session yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="withdrawals" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="font-display font-bold text-lg text-foreground">Chain Withdrawal Management</h3>
                <div className="w-full sm:w-[220px]">
                  <Select value={selectedChain} onValueChange={(value) => handleChainChange(value as SupportedChain)}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-border/60">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="bsc">BSC</SelectItem>
                      <SelectItem value="tron">Tron</SelectItem>
                      <SelectItem value="solana">Solana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-card rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Connected Wallet</p>
                    <p className="text-sm font-semibold text-foreground break-all">{getConnectedWalletDisplay()}</p>
                  </CardContent>
                </Card>
                <Card className="glass-card rounded-xl">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Wallet Connection</p>
                    <Button variant="outline" onClick={openWalletModal} disabled={isConnectingWallet} className="h-9 rounded-lg">
                      {withdrawalWalletAddress ? "Reconnect Wallet" : "Connect Wallet"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card rounded-xl">
                <CardContent className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="withdrawDestination">Destination Wallet</Label>
                    <Input
                      id="withdrawDestination"
                      value={withdrawalDestination}
                      onChange={(event) => setWithdrawalDestination(event.target.value)}
                      placeholder={getWithdrawalPlaceholder(selectedChain)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withdrawAmount">Amount (USDT)</Label>
                    <Input
                      id="withdrawAmount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={withdrawalAmountUsdt}
                      onChange={(event) => setWithdrawalAmountUsdt(event.target.value)}
                      placeholder="10.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="withdrawNote">Note (optional)</Label>
                    <Input
                      id="withdrawNote"
                      value={withdrawalNote}
                      onChange={(event) => setWithdrawalNote(event.target.value)}
                      placeholder="Reason or reference"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      variant="accent"
                      onClick={() => void handleCreateWithdrawalRequest()}
                      disabled={!canAccessAdmin || isSubmittingWithdrawal || isConnectingWallet}
                    >
                      {isSubmittingWithdrawal ? "Submitting..." : "Withdraw With Connected Wallet"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {withdrawalEntries.map((entry) => (
                  <Card key={entry.id} className="glass-card rounded-xl">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground break-all">{entry.id}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 break-all">
                              {entry.chain.toUpperCase()} · {entry.amountUsdt.toFixed(2)} USDT · {entry.destinationAddress}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-lg px-2.5 bg-success/10 text-success border-success/20"
                        >
                          {entry.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground break-words">
                        {entry.note || "No note"} · tx:{" "}
                        <a
                          href={`${getTxExplorerBaseUrl(entry.chain)}${entry.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent hover:underline break-all"
                        >
                          {entry.txHash}
                        </a>
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {withdrawalEntries.length === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No frontend withdrawal transactions in this session yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manage-wallets" className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="font-display font-bold text-lg text-foreground">Manage Users Wallet</h3>
                <div className="w-full sm:w-[220px]">
                  <Select value={manageWalletChain} onValueChange={(value) => handleManageWalletChainChange(value as SupportedChain)}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted/50 border-border/60">
                      <SelectValue placeholder="Select chain" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ethereum">Ethereum</SelectItem>
                      <SelectItem value="bsc">BSC</SelectItem>
                      <SelectItem value="tron">Tron</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoadingPaidWalletEntries ? (
                <Card className="glass-card rounded-xl">
                  <CardContent className="p-5 text-sm text-muted-foreground">
                    Loading paid wallets...
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {paidWalletEntries.map((entry) => (
                    <Card key={`${entry.userId}-${entry.walletAddress}`} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground break-all">{entry.walletAddress}</p>
                            <p className="text-xs text-muted-foreground mt-1 break-all">
                              User: {entry.userId}
                            </p>
                          </div>
                          <Button variant="outline" onClick={() => openSendUsdtModal(entry)}>
                            Send USDT
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground">Payments (10 USDT)</p>
                            <p className="font-medium">{entry.paymentCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Paid</p>
                            <p className="font-medium">{entry.totalPaidUsdt.toFixed(2)} USDT</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">USDT Balance</p>
                            <p className="font-medium">
                              {entry.usdtBalance ? `${entry.usdtBalance} USDT` : "Unavailable"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Last Paid</p>
                            <p className="font-medium">{new Date(entry.lastPaidAt).toLocaleString()}</p>
                          </div>
                        </div>
                        {entry.balanceFetchError && (
                          <p className="text-xs text-warning">Balance fetch issue: {entry.balanceFetchError}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {paidWalletEntries.length === 0 && (
                    <Card className="glass-card rounded-xl">
                      <CardContent className="p-5 text-sm text-muted-foreground">
                        No wallets found with at least one 10 USDT payment on this chain.
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="audit" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Audit Logs</h3>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <Card key={log.id} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
                          log.action.includes("DISCLOSURE")
                            ? "bg-warning/8 border-warning/10"
                            : "bg-accent/8 border-accent/10"
                        }`}>
                          {log.action.includes("DISCLOSURE")
                            ? <AlertTriangle className="w-5 h-5 text-warning" />
                            : <FileText className="w-5 h-5 text-accent" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{log.action.split("_").join(" ")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 break-all">
                            {log.actor_role} · {log.actor_user_id} → {log.target_user_id ?? "n/a"} ·{" "}
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground self-start sm:self-auto" />
                    </CardContent>
                  </Card>
                ))}
                {auditLogs.length === 0 && (
                  <Card className="glass-card rounded-xl">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No audit logs available.
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
        onOpenChange={setIsWalletModalOpen}
        selectedChain={selectedChain}
        onSelectWallet={(method) => {
          void handleConnectWithdrawalWallet(method);
        }}
        isConnecting={isConnectingWallet}
      />
      <Dialog open={isSendUsdtModalOpen} onOpenChange={setIsSendUsdtModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send USDT to User Wallet</DialogTitle>
            <DialogDescription>
              Send USDT on {manageWalletChain.toUpperCase()} to selected user wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Target Wallet</p>
              <p className="text-sm font-medium break-all">{sendUsdtTarget?.walletAddress ?? "N/A"}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sendUsdtAmount">Amount (USDT)</Label>
              <Input
                id="sendUsdtAmount"
                value={sendUsdtAmount}
                onChange={(event) => setSendUsdtAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Connected Admin Wallet</p>
              <p className="text-sm font-medium break-all">
                {sendUsdtWalletAddress || "Not connected"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => void handleConnectSendUsdtWallet()}
                disabled={isConnectingSendUsdtWallet || isSendingUsdt}
              >
                {isConnectingSendUsdtWallet ? "Connecting..." : "Connect Admin Wallet"}
              </Button>
              <Button
                variant="accent"
                onClick={() => void handleSendUsdtToUser()}
                disabled={isSendingUsdt || isConnectingSendUsdtWallet || !sendUsdtTarget}
              >
                {isSendingUsdt ? "Sending..." : "Send USDT"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
