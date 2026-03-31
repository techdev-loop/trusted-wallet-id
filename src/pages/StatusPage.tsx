import { Activity, CheckCircle2, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import InfoPageLayout from "@/components/InfoPageLayout";

const services = [
  { name: "Authentication API", status: "Operational", icon: CheckCircle2, tone: "text-success" },
  { name: "KYC Provider Gateway", status: "Operational", icon: CheckCircle2, tone: "text-success" },
  { name: "Wallet Verification", status: "Operational", icon: CheckCircle2, tone: "text-success" },
  { name: "Compliance Audit Logs", status: "Monitoring", icon: Clock3, tone: "text-warning" },
];

const StatusPage = () => {
  return (
    <InfoPageLayout
      eyebrow="Platform"
      title="System Status"
      description="Live operational overview for FIU ID core services."
      updatedAt={new Date().toLocaleString()}
    >
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 flex items-start gap-3">
          <Activity className="w-5 h-5 text-accent mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Overall status: Healthy</p>
            <p className="text-sm text-muted-foreground mt-1">
              Core services are currently available. Minor monitoring alerts may appear during provider-side maintenance windows.
            </p>
          </div>
        </CardContent>
      </Card>

      {services.map((service) => (
        <Card key={service.name} className="app-section-card app-list-card rounded-2xl">
          <CardContent className="p-6 flex items-center justify-between gap-3">
            <p className="font-medium text-foreground">{service.name}</p>
            <div className={`inline-flex items-center gap-2 text-sm ${service.tone}`}>
              <service.icon className="w-4 h-4" />
              {service.status}
            </div>
          </CardContent>
        </Card>
      ))}
    </InfoPageLayout>
  );
};

export default StatusPage;
