import { Card, CardContent } from "@/components/ui/card";
import InfoPageLayout from "@/components/InfoPageLayout";

const DataRetention = () => {
  return (
    <InfoPageLayout
      eyebrow="Compliance"
      title="Data Retention"
      description="Retention practices for identity records, wallet linkage data, and audit trails."
      updatedAt="March 13, 2026"
    >
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">Retention Windows</h2>
          <p className="text-sm text-muted-foreground">
            Retention duration is based on applicable legal obligations, audit requirements, and operational security needs.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">Data Categories</h2>
          <p className="text-sm text-muted-foreground">
            Identity documents, KYC metadata, wallet linkage records, and admin activity logs are retained under category-specific policies.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">Deletion & Legal Holds</h2>
          <p className="text-sm text-muted-foreground">
            Deletion requests are reviewed against legal hold requirements. Where permitted, data is removed or anonymized according to policy.
          </p>
        </CardContent>
      </Card>
    </InfoPageLayout>
  );
};

export default DataRetention;
