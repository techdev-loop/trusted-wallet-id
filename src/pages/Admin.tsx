import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Search,
  Users,
  FileText,
  Clock,
  CheckCircle2,
  Eye,
  ChevronRight,
  LogOut,
  User,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { clearSession, getSession } from "@/lib/session";

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

  const canAccessAdmin = session?.user.role === "admin" || session?.user.role === "compliance";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="px-6 py-4 rounded-2xl border border-border bg-card shadow-lg backdrop-blur-sm">
          <p className="text-sm font-medium tracking-wide text-foreground">
            Loading secure admin controls…
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifying session and fetching latest audit trail.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-500 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow duration-300">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight text-foreground">
              FIUlink
            </span>
            <Badge className="ml-1.5 text-[10px] bg-muted text-foreground border border-border rounded-md px-2 py-0.5">
              Admin
            </Badge>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-1 group"
            >
              User Dashboard
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
            </Link>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted border border-border shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-foreground hidden sm:block">
                {session?.user.email ?? "Unknown admin"}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground border border-transparent hover:border-destructive/30 transition-all duration-150 active:scale-95"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        {!canAccessAdmin && (
          <Card className="glass-card rounded-2xl mb-8 border border-destructive/20 bg-destructive/5 shadow-sm">
            <CardContent className="p-6">
              <p className="text-sm text-destructive">
                Your account role is <strong>{session?.user.role}</strong>. Admin panel access requires
                `admin` or `compliance` privileges.
              </p>
            </CardContent>
          </Card>
        )}

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                  Admin Control Center
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Compliance-grade controls for identity-linked wallet oversight.
                </p>
              </div>
            </div>
            <div className="ml-0 sm:ml-11 flex flex-wrap gap-2 mt-3">
              <Badge className="bg-muted border border-border text-foreground text-[10px] uppercase tracking-wide rounded-full px-3 py-1 flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Secure admin access
              </Badge>
              <Badge className="bg-muted border border-border text-foreground text-[10px] uppercase tracking-wide rounded-full px-3 py-1 flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                Encrypted identity data
              </Badge>
              <Badge className="bg-muted border border-border text-foreground text-[10px] uppercase tracking-wide rounded-full px-3 py-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Continuous audit trail
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-10">
          {[
            { label: "User Records", value: walletLookupResult ? 1 : 0, icon: Users, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
            { label: "Identity Views", value: identityResult ? 1 : 0, icon: CheckCircle2, iconClass: "text-success", accent: "from-success/10 to-success/5" },
            { label: "Pending", value: disclosureRequests.filter((request) => request.status === "pending").length, icon: Clock, iconClass: "text-warning", accent: "from-warning/10 to-warning/5" },
            { label: "Audit Events", value: auditLogs.length, icon: FileText, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
          ].map((card, i) => (
            <motion.div key={card.label} initial="hidden" animate="visible" variants={fadeIn} custom={i + 1}>
              <Card className="stat-card rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-transform duration-200">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {card.label}
                    </span>
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.accent} flex items-center justify-center`}
                    >
                      <card.icon className={`w-5 h-5 ${card.iconClass}`} />
                    </div>
                  </div>
                  <p className="font-display text-3xl font-semibold text-foreground tabular-nums tracking-tight">
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.08 * i }}
                    >
                      {card.value}
                    </motion.span>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-muted p-1.5 rounded-2xl border border-border shadow-sm inline-flex">
              <TabsTrigger
                value="users"
                className="rounded-xl font-medium text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border border border-transparent text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-200 relative overflow-hidden"
              >
                <span className="relative z-10">Users</span>
              </TabsTrigger>
              <TabsTrigger
                value="disclosures"
                className="rounded-xl font-medium text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border border border-transparent text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-200 relative overflow-hidden"
              >
                <span className="relative z-10">Disclosure Requests</span>
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="rounded-xl font-medium text-xs sm:text-sm px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border-border border border-transparent text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-200 relative overflow-hidden"
              >
                <span className="relative z-10">Audit Logs</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-5">
              <div className="relative max-w-lg">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-emerald-100/40 blur-2 opacity-0 peer-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none" />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by wallet address"
                    className="peer pl-11 h-12 rounded-2xl bg-card border border-border focus:bg-background focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground text-sm shadow-sm transition-all duration-200"
                    value={searchWalletAddress}
                    onChange={(event) => setSearchWalletAddress(event.target.value)}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Link a wallet address to quickly inspect the associated identity record.
                </p>
              </div>
              <Button
                variant="accent"
                onClick={() => void handleWalletLookup()}
                disabled={!canAccessAdmin}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-white font-medium px-5 py-2.5 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 border border-emerald-400/60 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                Search Wallet
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
              <div className="space-y-3">
                {walletLookupResult && (
                  <Card
                    key={walletLookupResult.userId}
                    className="glass-card rounded-2xl border border-border bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                  >
                    <CardContent className="p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {walletLookupResult.userId} - {walletLookupResult.email ?? "No email"}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-1">
                            {walletLookupResult.walletAddress} · {walletLookupResult.walletStatus}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`rounded-lg px-2.5 ${
                            identityResult?.verificationStatus === "verified"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {identityResult?.verificationStatus === "verified" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </>
                          )}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-xl h-9 w-9 border border-border bg-muted hover:bg-background hover:border-emerald-400 text-foreground hover:text-emerald-600 transition-all duration-150 active:scale-95"
                          onClick={() => void handleViewIdentity()}
                          disabled={!canAccessAdmin}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!walletLookupResult && (
                  <Card className="glass-card rounded-2xl border border-border bg-card">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-9 h-9 rounded-2xl bg-muted border border-border flex items-center justify-center mb-1">
                        <Search className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        Search for a wallet to begin an identity review.
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Enter a wallet address above to load the linked user and their verification status.
                      </p>
                    </CardContent>
                  </Card>
                )}
                {identityResult && (
                  <Card className="glass-card rounded-2xl border border-emerald-200 bg-card shadow-sm">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          Decrypted Identity Data
                        </p>
                        <span className="text-[10px] uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                          Encrypted at rest
                        </span>
                      </div>
                      <pre className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all bg-muted border border-border rounded-xl p-3 max-h-72 overflow-auto">
                        {JSON.stringify(identityResult.identityData, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-5">
              <h3 className="font-display font-semibold text-xl text-foreground">
                Lawful Disclosure Requests
              </h3>
              <Card className="glass-card rounded-2xl border border-border bg-card shadow-sm">
                <CardContent className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">
                      Capture the legal basis for any identity-linked data disclosure.
                    </p>
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 uppercase tracking-wide">
                      Dual control recommended
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Label
                        htmlFor="disclosureUserId"
                        className="absolute left-3 top-1 text-[11px] font-medium text-muted-foreground pointer-events-none"
                      >
                        User ID
                      </Label>
                      <Input
                        id="disclosureUserId"
                        value={newDisclosureUserId}
                        onChange={(event) => setNewDisclosureUserId(event.target.value)}
                        placeholder="UUID"
                        className="pt-5 text-sm h-12 rounded-2xl bg-card border border-border focus:bg-background focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground shadow-sm transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Label
                        htmlFor="disclosureWallet"
                        className="absolute left-3 top-1 text-[11px] font-medium text-muted-foreground pointer-events-none"
                      >
                        Wallet Address
                      </Label>
                      <Input
                        id="disclosureWallet"
                        value={newDisclosureWallet}
                        onChange={(event) => setNewDisclosureWallet(event.target.value)}
                        placeholder="0x..."
                        className="pt-5 text-sm h-12 rounded-2xl bg-card border border-border focus:bg-background focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground shadow-sm transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="relative">
                      <Label
                        htmlFor="disclosureReference"
                        className="absolute left-3 top-1 text-[11px] font-medium text-muted-foreground pointer-events-none"
                      >
                        Lawful Request Reference
                      </Label>
                      <Input
                        id="disclosureReference"
                        value={newDisclosureReference}
                        onChange={(event) => setNewDisclosureReference(event.target.value)}
                        placeholder="Case / order reference"
                        className="pt-5 text-sm h-12 rounded-2xl bg-card border border-border focus:bg-background focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground shadow-sm transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      variant="accent"
                      onClick={() => void handleCreateDisclosureRequest()}
                      disabled={!canAccessAdmin}
                      className="w-full sm:w-auto rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 text-white font-medium px-5 py-2.5 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-150 border border-emerald-400/60 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      Create Disclosure Request
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card rounded-2xl border border-border bg-card shadow-sm">
                <CardContent className="p-5 grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="relative">
                      <Label
                        htmlFor="approveRequestId"
                        className="absolute left-3 top-1 text-[11px] font-medium text-muted-foreground pointer-events-none"
                      >
                        Disclosure Request ID
                      </Label>
                      <Input
                        id="approveRequestId"
                        value={approveRequestId}
                        onChange={(event) => setApproveRequestId(event.target.value)}
                        placeholder="UUID"
                        className="pt-5 text-sm h-12 rounded-2xl bg-card border border-border focus:bg-background focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/30 placeholder:text-muted-foreground shadow-sm transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <div className="flex items-center gap-2 pb-2">
                      <Checkbox
                        id="approvedByUser"
                        checked={approvedByUser}
                        onCheckedChange={(checked) => setApprovedByUser(Boolean(checked))}
                      />
                      <Label htmlFor="approvedByUser" className="text-xs text-foreground">
                        Prior user consent recorded
                      </Label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleApproveDisclosure()}
                      disabled={!canAccessAdmin}
                      className="w-full sm:w-auto rounded-2xl border-border bg-background text-foreground hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 transition-all duration-150 active:scale-[0.98]"
                    >
                      Approve Disclosure Request
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                {disclosureRequests.map((req) => (
                  <Card
                    key={req.id}
                    className="glass-card rounded-2xl border border-border bg-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-muted border border-border flex items-center justify-center">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{req.id}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              User: {req.userId} · Wallet: {req.walletAddress}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`rounded-lg px-2.5 ${
                            req.status === "pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {req.status === "pending" ? (
                            <>
                              <Clock className="w-3 h-3 mr-1" /> Pending
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Approved
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground ml-[60px] border-t border-border pt-3">
                        {req.lawfulRequestReference}
                      </p>
                    </CardContent>
                  </Card>
                ))}
                {disclosureRequests.length === 0 && (
                  <Card className="glass-card rounded-2xl border border-border bg-card">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-muted border border-border flex items-center justify-center mb-1">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        No disclosure requests created in this session.
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        New lawful requests will appear here as they are recorded through the forms above.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-5">
              <h3 className="font-display font-semibold text-xl text-foreground">
                Audit Logs
              </h3>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <Card
                    key={log.id}
                    className="glass-card rounded-2xl border border-border bg-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                  >
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
                          log.action.includes("DISCLOSURE")
                            ? "bg-amber-50 border-amber-200"
                            : "bg-emerald-50 border-emerald-200"
                        }`}>
                          {log.action.includes("DISCLOSURE")
                            ? <AlertTriangle className="w-5 h-5 text-amber-600" />
                            : <FileText className="w-5 h-5 text-emerald-600" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {log.action.split("_").join(" ")}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {log.actor_role} · {log.actor_user_id} → {log.target_user_id ?? "n/a"} ·{" "}
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
                {auditLogs.length === 0 && (
                  <Card className="glass-card rounded-2xl border border-border bg-card">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-muted border border-border flex items-center justify-center mb-1">
                        <Clock className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        No audit logs available yet.
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        System audit is enabled new admin actions will populate this timeline automatically.
                      </p>
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

export default Admin;
