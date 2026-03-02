import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Wallet, CheckCircle2, XCircle, Clock, ExternalLink,
  Plus, Unlink, FileText, ChevronRight, LogOut, User, LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const mockWallets = [
  { address: "0x1a2b...9f3e", chain: "Ethereum", status: "active" as const, linkedDate: "2025-12-15" },
  { address: "0x4c5d...8a1b", chain: "Polygon", status: "active" as const, linkedDate: "2026-01-20" },
  { address: "0x7e8f...2c4d", chain: "BSC", status: "unlinked" as const, linkedDate: "2025-11-01" },
];

const mockPayments = [
  { hash: "0xabc1...def2", amount: "10 USDT", date: "2025-12-15", status: "confirmed" },
  { hash: "0xghi3...jkl4", amount: "10 USDT", date: "2026-01-20", status: "confirmed" },
];

const mockDisclosures = [
  { id: "DIS-001", requestedBy: "Regulatory Body A", date: "2026-02-10", status: "approved", details: "Lawful disclosure request" },
  { id: "DIS-002", requestedBy: "User-initiated", date: "2026-02-20", status: "pending", details: "Self-disclosure" },
];

const statusConfig = {
  active: { icon: CheckCircle2, label: "Active", className: "bg-success/10 text-success border-success/20" },
  unlinked: { icon: XCircle, label: "Unlinked", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { icon: Clock, label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  confirmed: { icon: CheckCircle2, label: "Confirmed", className: "bg-success/10 text-success border-success/20" },
  approved: { icon: CheckCircle2, label: "Approved", className: "bg-success/10 text-success border-success/20" },
};

const Dashboard = () => {
  const [kycStatus] = useState<"verified" | "pending" | "not_started">("verified");

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">FIUlink</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Admin
            </Link>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">user@example.com</span>
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
            <LayoutDashboard className="w-6 h-6 text-accent" />
            <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          </div>

          {/* Status cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">KYC Status</span>
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <p className="font-display font-semibold text-foreground">
                  {kycStatus === "verified" ? "Verified" : kycStatus === "pending" ? "Pending" : "Not Started"}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Linked Wallets</span>
                  <Wallet className="w-5 h-5 text-accent" />
                </div>
                <p className="font-display font-semibold text-foreground">
                  {mockWallets.filter(w => w.status === "active").length} Active
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Total Payments</span>
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <p className="font-display font-semibold text-foreground">{mockPayments.length} Transactions</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="wallets" className="space-y-6">
            <TabsList className="bg-muted p-1">
              <TabsTrigger value="wallets">Wallets</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="disclosures">Disclosures</TabsTrigger>
            </TabsList>

            <TabsContent value="wallets" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground">Linked Wallets</h3>
                <Button size="sm" onClick={() => toast.info("Wallet connection flow coming soon")}>
                  <Plus className="w-4 h-4 mr-1" /> Connect Wallet
                </Button>
              </div>
              <div className="space-y-3">
                {mockWallets.map((wallet) => {
                  const config = statusConfig[wallet.status];
                  return (
                    <Card key={wallet.address} className="glass-card">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-medium text-foreground">{wallet.address}</p>
                            <p className="text-xs text-muted-foreground">{wallet.chain} · Linked {wallet.linkedDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={config.className}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          {wallet.status === "active" && (
                            <Button variant="ghost" size="sm" onClick={() => toast.info("Unlink flow coming soon")}>
                              <Unlink className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <h3 className="font-display font-semibold text-foreground">Payment History</h3>
              <div className="space-y-3">
                {mockPayments.map((payment) => (
                  <Card key={payment.hash} className="glass-card">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-medium text-foreground">{payment.hash}</p>
                          <p className="text-xs text-muted-foreground">{payment.date} · {payment.amount}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-4">
              <h3 className="font-display font-semibold text-foreground">Disclosure History</h3>
              <div className="space-y-3">
                {mockDisclosures.map((disc) => {
                  const config = statusConfig[disc.status as keyof typeof statusConfig];
                  return (
                    <Card key={disc.id} className="glass-card">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{disc.id} — {disc.details}</p>
                            <p className="text-xs text-muted-foreground">Requested by {disc.requestedBy} · {disc.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={config.className}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
