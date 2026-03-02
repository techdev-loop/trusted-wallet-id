import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Search, Users, FileText, Clock, CheckCircle2,
  Eye, ChevronRight, LogOut, User, ShieldCheck, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIUlink</span>
            <Badge variant="outline" className="ml-2 text-xs">Admin</Badge>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              User Dashboard
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-foreground">admin@fiulink.com</span>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/"><LogOut className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <ShieldCheck className="w-6 h-6 text-accent" />
            <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
          </div>

          {/* Stats */}
          <div className="grid sm:grid-cols-4 gap-4 mb-8">
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Total Users</span>
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{mockUsers.length}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Verified</span>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <p className="font-display text-2xl font-bold text-foreground">
                  {mockUsers.filter(u => u.kycStatus === "verified").length}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Pending Requests</span>
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <p className="font-display text-2xl font-bold text-foreground">
                  {mockDisclosureRequests.filter(r => r.status === "pending").length}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Audit Events</span>
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <p className="font-display text-2xl font-bold text-foreground">{mockAuditLogs.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="bg-muted p-1">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="disclosures">Disclosure Requests</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by wallet, email, or user ID..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <Card key={user.id} className="glass-card">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.id} — {user.email}</p>
                          <p className="text-xs text-muted-foreground font-mono">{user.wallet} · {user.wallets} wallet(s)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={user.kycStatus === "verified"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-warning/10 text-warning border-warning/20"
                          }
                        >
                          {user.kycStatus === "verified" ? (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Verified</>
                          ) : (
                            <><Clock className="w-3 h-3 mr-1" /> Pending</>
                          )}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => toast.info("Identity view restricted - access logged")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-4">
              <h3 className="font-display font-semibold text-foreground">Lawful Disclosure Requests</h3>
              <div className="space-y-3">
                {mockDisclosureRequests.map((req) => (
                  <Card key={req.id} className="glass-card">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{req.id} — {req.requestor}</p>
                            <p className="text-xs text-muted-foreground">User: {req.userId} · {req.date}</p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={req.status === "pending"
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-success/10 text-success border-success/20"
                          }
                        >
                          {req.status === "pending" ? (
                            <><Clock className="w-3 h-3 mr-1" /> Pending</>
                          ) : (
                            <><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground ml-[52px]">{req.reason}</p>
                      {req.status === "pending" && (
                        <div className="flex gap-2 ml-[52px] mt-3">
                          <Button size="sm" onClick={() => toast.success("Disclosure approved - action logged")}>
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

            <TabsContent value="audit" className="space-y-4">
              <h3 className="font-display font-semibold text-foreground">Audit Logs</h3>
              <div className="space-y-3">
                {mockAuditLogs.map((log) => (
                  <Card key={log.id} className="glass-card">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          log.severity === "warning" ? "bg-warning/10" : "bg-accent/10"
                        }`}>
                          {log.severity === "warning"
                            ? <AlertTriangle className="w-5 h-5 text-warning" />
                            : <FileText className="w-5 h-5 text-accent" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{log.action}</p>
                          <p className="text-xs text-muted-foreground">
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
