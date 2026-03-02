import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Wallet, CheckCircle2, XCircle, Clock, ExternalLink,
  Plus, Unlink, FileText, ChevronRight, LogOut, User, LayoutDashboard, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const Dashboard = () => {
  const [kycStatus] = useState<"verified" | "pending" | "not_started">("verified");

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
              <span className="text-sm font-medium text-foreground hidden sm:block">user@example.com</span>
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
              value: kycStatus === "verified" ? "Verified" : kycStatus === "pending" ? "Pending" : "Not Started",
              icon: CheckCircle2,
              iconClass: "text-success",
              accent: "from-success/10 to-success/5",
            },
            {
              label: "Linked Wallets",
              value: `${mockWallets.filter(w => w.status === "active").length} Active`,
              icon: Wallet,
              iconClass: "text-accent",
              accent: "from-accent/10 to-accent/5",
            },
            {
              label: "Total Payments",
              value: `${mockPayments.length} Transactions`,
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

        {/* Tabs */}
        <motion.div initial="hidden" animate="visible" variants={fadeIn} custom={4}>
          <Tabs defaultValue="wallets" className="space-y-6">
            <TabsList className="bg-muted/70 p-1.5 rounded-xl border border-border/50">
              <TabsTrigger value="wallets" className="rounded-lg font-medium">Wallets</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-lg font-medium">Payments</TabsTrigger>
              <TabsTrigger value="disclosures" className="rounded-lg font-medium">Disclosures</TabsTrigger>
            </TabsList>

            <TabsContent value="wallets" className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-foreground">Linked Wallets</h3>
                <Button size="sm" variant="accent" onClick={() => toast.info("Wallet connection flow coming soon")}>
                  <Plus className="w-4 h-4 mr-1.5" /> Connect Wallet
                </Button>
              </div>
              <div className="space-y-3">
                {mockWallets.map((wallet) => {
                  const config = statusConfig[wallet.status];
                  return (
                    <Card key={wallet.address} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-semibold text-foreground">{wallet.address}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{wallet.chain} · Linked {wallet.linkedDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={`${config.className} rounded-lg px-2.5`}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          {wallet.status === "active" && (
                            <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9" onClick={() => toast.info("Unlink flow coming soon")}>
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

            <TabsContent value="payments" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Payment History</h3>
              <div className="space-y-3">
                {mockPayments.map((payment) => (
                  <Card key={payment.hash} className="glass-card rounded-xl">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-success/8 border border-success/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-semibold text-foreground">{payment.hash}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{payment.date} · {payment.amount}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="disclosures" className="space-y-5">
              <h3 className="font-display font-bold text-lg text-foreground">Disclosure History</h3>
              <div className="space-y-3">
                {mockDisclosures.map((disc) => {
                  const config = statusConfig[disc.status as keyof typeof statusConfig];
                  return (
                    <Card key={disc.id} className="glass-card rounded-xl">
                      <CardContent className="p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{disc.id} — {disc.details}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Requested by {disc.requestedBy} · {disc.date}</p>
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
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
