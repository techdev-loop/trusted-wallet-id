import { Activity, CheckCircle2, Server } from "lucide-react";
import MarketingPageLayout from "@/components/MarketingPageLayout";
import { Card, CardContent } from "@/components/ui/card";

const services = [
  { name: "Application & API", status: "Operational", detail: "Core app and REST API" },
  { name: "Authentication", status: "Operational", detail: "Email OTP and sessions" },
  { name: "Identity verification", status: "Operational", detail: "KYC pipeline" },
];

const SystemStatus = () => (
  <MarketingPageLayout
    title="System Status"
    description="Current status of major FIU ID components. This page is informational."
  >
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-4 py-3 text-foreground">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
        <div>
          <p className="font-semibold text-sm sm:text-base">All systems operational</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Last checked: live page (not a real-time incident feed).
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:gap-4">
        {services.map((s) => (
          <Card key={s.name} className="border-border/60 bg-card/80">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm sm:text-base">{s.name}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{s.detail}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success whitespace-nowrap sm:ml-4">
                <Activity className="w-3.5 h-3.5" />
                {s.status}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground border-t border-border/60 pt-4">
        For urgent issues, use the Contact page. Enterprise status subscriptions may be offered separately.
      </p>
    </div>
  </MarketingPageLayout>
);

export default SystemStatus;
