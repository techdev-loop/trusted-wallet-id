import { Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import InfoPageLayout from "@/components/InfoPageLayout";

const ContactPage = () => {
  return (
    <InfoPageLayout
      eyebrow="Support"
      title="Contact Us"
      description="Reach FIU ID support for onboarding, compliance, and technical assistance."
      updatedAt="March 13, 2026"
    >
      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 sm:p-7 space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-accent mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">General Support</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact our operations team for account issues, verification delays, or dashboard support.
              </p>
            </div>
          </div>
          <Button asChild variant="accent" className="h-11 rounded-xl">
            <a href="mailto:support@fiuid.com">support@fiuid.com</a>
          </Button>
        </CardContent>
      </Card>

      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 sm:p-7 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-accent mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Compliance Requests</p>
              <p className="text-sm text-muted-foreground mt-1">
                For lawful disclosure and compliance communications, include request references and jurisdiction details.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-xl">
            <a href="mailto:compliance@fiuid.com">compliance@fiuid.com</a>
          </Button>
        </CardContent>
      </Card>

      <Card className="app-section-card rounded-2xl">
        <CardContent className="p-6 sm:p-7 flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-accent mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Please avoid sending sensitive identity documents by email unless explicitly requested through secure channels.
          </p>
        </CardContent>
      </Card>
    </InfoPageLayout>
  );
};

export default ContactPage;
