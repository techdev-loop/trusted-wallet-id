import { useEffect, useState } from "react";
import MarketingPageLayout from "@/components/MarketingPageLayout";
import { apiRequest } from "@/lib/api";

interface LegalNoticeResponse {
  dataRetentionPolicy: {
    retentionDays: number;
    statement: string;
  };
}

const DataRetention = () => {
  const [notice, setNotice] = useState<LegalNoticeResponse | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await apiRequest<LegalNoticeResponse>("/legal/notices");
        setNotice(response);
      } catch {
        setNotice(null);
      }
    })();
  }, []);

  const days = notice?.dataRetentionPolicy.retentionDays;
  const statement = notice?.dataRetentionPolicy.statement;

  return (
    <MarketingPageLayout
      title="Data Retention"
      description="How long we keep categories of data and why."
    >
      <div className="space-y-6 text-foreground/90">
        {days != null ? (
          <p className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-foreground">
            <span className="font-semibold">Configured retention window: </span>
            <span className="font-mono">{days}</span> days (from live policy where available).
          </p>
        ) : (
          <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
            Live retention parameters will appear here when connected to the API. Default practices are described below.
          </p>
        )}
        {statement ? (
          <section className="space-y-2">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Policy statement</h2>
            <p className="whitespace-pre-wrap">{statement}</p>
          </section>
        ) : null}
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">General principles</h2>
          <p>
            We retain personal and operational data only as long as necessary to provide the service, meet legal and
            regulatory requirements, resolve disputes, and enforce our agreements. Verification artifacts and audit
            logs may be kept for longer periods where required for compliance.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Deletion</h2>
          <p>
            When retention periods end or when you exercise applicable deletion rights, we delete or anonymize data in
            line with our technical and legal obligations.
          </p>
        </section>
      </div>
    </MarketingPageLayout>
  );
};

export default DataRetention;
