import { useState } from "react";
import { Link } from "react-router-dom";
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
import { toast } from "sonner";

const mockUsers = [
  { id: "USR-001", email: "alice@example.com", wallet: "0x1a2b...9f3e", kycStatus: "verified", wallets: 2 },
  { id: "USR-002", email: "bob@example.com", wallet: "0x4c5d...8a1b", kycStatus: "verified", wallets: 1 },
  { id: "USR-003", email: "carol@example.com", wallet: "0x7e8f...2c4d", kycStatus: "pending", wallets: 0 },
];

const mockAuditLogs = [
  { id: "AUD-001", action: "View Identity Data", admin: "admin@fiulink.com", target: "USR-001", timestamp: "2026-02-28 14:23:05", severity: "info" },
  { id: "AUD-002", action: "Approve Disclosure", admin: "admin@fiulink.com", target: "USR-002", timestamp: "2026-02-27 09:15:30", severity: "warning" },
  { id: "AUD-003", action: "Search User", admin: "admin@fiulink.com", target: "0x1a2b...9f3e", timestamp: "2026-02-26 16:45:12", severity: "info" },
  { id: "AUD-004", action: "Reject Disclosure", admin: "admin@fiulink.com", target: "USR-003", timestamp: "2026-02-25 11:30:00", severity: "info" },
];

const mockDisclosureRequests = [
  { id: "REQ-001", requestor: "Law Enforcement Agency", userId: "USR-001", reason: "Ongoing investigation - Case #2026-A1", status: "pending", date: "2026-02-28" },
  { id: "REQ-002", requestor: "Financial Authority", userId: "USR-002", reason: "Compliance review", status: "approved", date: "2026-02-20" },
  { id: "REQ-003", requestor: "Court Order", userId: "USR-001", reason: "Judicial mandate #JM-456", status: "approved", date: "2026-02-10" },
];

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const Admin = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = mockUsers.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.wallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card/85 backdrop-blur-xl border-b border-border/50 shadow-[var(--shadow-xs)]">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIUlink</span>
            <Badge className="ml-1.5 text-[10px] gradient-accent text-accent-foreground border-0 rounded-md px-2">Admin</Badge>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-flex items-center gap-1">
              User Dashboard <ArrowUpRight className="w-3 h-3" />
            </Link>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/70 border border-border/50">
              <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">admin@fiulink.com</span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" asChild>
              <Link to="/"><LogOut className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 max-w-6xl">
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={0}>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-6 h-6 text-accent" />
              <h1 className="font-display text-3xl font-bold text-foreground">Admin Panel</h1>
            </div>
            <p className="text-muted-foreground ml-9">Manage users, disclosure requests, and audit logs</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-10">
          {[
            { label: "Total Users", value: mockUsers.length, icon: Users, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
            { label: "Verified", value: mockUsers.filter(u => u.kycStatus === "verified").length, icon: CheckCircle2, iconClass: "text-success", accent: "from-success/10 to-success/5" },
            { label: "Pending", value: mockDisclosureRequests.filter(r => r.status === "pending").length, icon: Clock, iconClass: "text-warning", accent: "from-warning/10 to-warning/5" },
            { label: "Audit Events", value: mockAuditLogs.length, icon: FileText, iconClass: "text-accent", accent: "from-accent/10 to-accent/5" },
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
            <TabsList className="bg-muted/70 p-1.5 rounded-xl border border-border/50">
              <TabsTrigger value="users" className="rounded-lg font-medium">Users</TabsTrigger>
              <TabsTrigger value="disclosures" className="rounded-lg font-medium">Disclosure Requests</TabsTrigger>
              <TabsTrigger value="audit" className="rounded-lg font-medium">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-5">
              <div className="relative max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by wallet, email, or user ID..."
                  className="pl-11 h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{user.id} — {user.email}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{user.wallet} · {user.wallets} wallet(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`rounded-lg px-2.5 ${
                            user.kycStatus === "verified"
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-warning/10 text-warning border-warning/20"
                          }`}
                        >
                          {user.kycStatus === "verified" ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                        <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9" onClick={() => toast.info("Identity view restricted - access logged")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Lawful Disclosure Requests</h3>
              <div className="space-y-3">
                {mockDisclosureRequests.map((req) => (
                  <Card key={req.id} className="glass-card rounded-xl">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{req.id} — {req.requestor}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">User: {req.userId} · {req.date}</p>
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
                      <p className="text-sm text-muted-foreground ml-[60px]">{req.reason}</p>
                      {req.status === "pending" && (
                        <div className="flex gap-2 ml-[60px] mt-4">
                          <Button size="sm" variant="accent" onClick={() => toast.success("Disclosure approved - action logged")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toast.info("Disclosure rejected - action logged")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Audit Logs</h3>
              <div className="space-y-3">
                {mockAuditLogs.map((log) => (
                  <Card key={log.id} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${
                          log.severity === "warning"
                            ? "bg-warning/8 border-warning/10"
                            : "bg-accent/8 border-accent/10"
                        }`}>
                          {log.severity === "warning"
                            ? <AlertTriangle className="w-5 h-5 text-warning" />
                            : <FileText className="w-5 h-5 text-accent" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{log.action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {log.admin} → {log.target} · {log.timestamp}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
