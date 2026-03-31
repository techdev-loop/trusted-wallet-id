import { Card, CardContent } from "@/components/ui/card";
import InfoPageLayout from "@/components/InfoPageLayout";

const TermsOfService = () => {
  return (
    <InfoPageLayout
      eyebrow="Legal"
      title="Terms of Service"
      description="The terms governing your use of FIU ID services and platform features."
      updatedAt="March 13, 2026"
    >
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">1. Service Scope</h2>
          <p className="text-sm text-muted-foreground">
            FIU ID provides KYC-enabled identity and wallet linkage workflows. We do not provide investment advice or custodial services.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">2. User Responsibilities</h2>
          <p className="text-sm text-muted-foreground">
            You are responsible for accurate submissions, wallet control, and lawful use of the platform. Misrepresentation may result in suspension.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">3. Compliance & Disclosures</h2>
          <p className="text-sm text-muted-foreground">
            Data disclosures may occur under valid legal requests or documented user consent, with all access events logged.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">4. Availability</h2>
          <p className="text-sm text-muted-foreground">
            We aim for high availability but cannot guarantee uninterrupted access due to maintenance, network issues, or external providers.
          </p>
        </CardContent>
      </Card>
    </InfoPageLayout>
  );
};

export default TermsOfService;
