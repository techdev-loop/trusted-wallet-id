import { Card, CardContent } from "@/components/ui/card";
import InfoPageLayout from "@/components/InfoPageLayout";

const PrivacyPolicy = () => {
  return (
    <InfoPageLayout
      eyebrow="Legal"
      title="Privacy Policy"
      description="How FIU ID collects, processes, and protects personal and wallet-related information."
      updatedAt="March 13, 2026"
    >
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">1. Information We Collect</h2>
          <p className="text-sm text-muted-foreground">
            We collect account information, identity verification inputs, wallet linkage data, and operational security logs
            necessary to provide identity-to-wallet verification services.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">2. How We Use Information</h2>
          <p className="text-sm text-muted-foreground">
            Data is used for KYC processing, wallet ownership validation, compliance workflows, fraud prevention, and auditability.
            We do not sell personal information.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">3. Security & Access Controls</h2>
          <p className="text-sm text-muted-foreground">
            Sensitive data is protected by encryption, strict role-based access, and immutable audit logging for administrative actions.
          </p>
        </CardContent>
      </Card>
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <h2 className="font-display text-xl font-bold text-foreground">4. Contact</h2>
          <p className="text-sm text-muted-foreground">
            For privacy questions or requests, use the Contact page and include your registered email and request details.
          </p>
        </CardContent>
      </Card>
    </InfoPageLayout>
  );
};

export default PrivacyPolicy;
