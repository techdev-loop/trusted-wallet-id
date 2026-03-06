import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Search, Users, FileText, Clock, CheckCircle2,
  Eye, ChevronRight, LogOut, User, ShieldCheck, AlertTriangle, ArrowUpRight
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
        <p className="text-muted-foreground">Loading admin panel...</p>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="sticky top-0 z-50 bg-card/85 backdrop-blur-xl border-b border-border/50 shadow-[var(--shadow-xs)]">
        <div className="page-container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIUlink</span>
            <Badge className="ml-1.5 text-[10px] gradient-accent text-accent-foreground border-0 rounded-md px-2">Admin</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild className="h-9 rounded-xl">
              <Link to="/dashboard" className="inline-flex items-center gap-1.5">
                <span className="hidden sm:inline">User Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/70 border border-border/50">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">
                {session?.user.email ?? "Unknown admin"}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="page-container py-8 md:py-10 max-w-6xl">
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-6 h-6 text-accent" />
              <h1 className="font-display text-3xl font-bold text-foreground">Admin Panel</h1>
            </div>
            <p className="text-muted-foreground ml-9">Manage users, disclosure requests, and audit logs</p>
          </div>
        </motion.div>

        {!canAccessAdmin && (
          <Card className="glass-card rounded-2xl mb-8">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Your account role is <strong>{session?.user.role}</strong>. Admin panel access requires
                `admin` or `compliance` privileges.
              </p>
            </CardContent>
          </Card>
        )}

        {canAccessAdmin && (
          <>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-10">
          {[
            { label: "User Records", value: walletLookupResult ? 1 : 0, icon: Users, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
            { label: "Identity Views", value: identityResult ? 1 : 0, icon: CheckCircle2, iconClass: "text-success", accent: "from-success/10 to-success/5" },
            { label: "Pending", value: disclosureRequests.filter((request) => request.status === "pending").length, icon: Clock, iconClass: "text-warning", accent: "from-warning/10 to-warning/5" },
            { label: "Audit Events", value: auditLogs.length, icon: FileText, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
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
                  <p className="font-display text-3xl font-bold text-foreground">{card.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={5}>
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-muted/70 p-1.5 rounded-xl border border-border/50 w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="users" className="rounded-lg font-medium shrink-0">Users</TabsTrigger>
              <TabsTrigger value="disclosures" className="rounded-lg font-medium shrink-0">Disclosure Requests</TabsTrigger>
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
              <Button variant="accent" onClick={() => void handleWalletLookup()} disabled={!canAccessAdmin}>
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
                              ? "View identity data"
                              : "Compliance role required to view identity data"
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
                      Search by wallet address to load the linked user.
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
                    <CardContent className="p-4 text-xs text-muted-foreground">
                      Identity details are restricted to the <strong>compliance</strong> role.
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
                          <p className="text-sm font-semibold text-foreground">{log.action.replaceAll("_", " ")}</p>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Admin;
