import MarketingPageLayout from "@/components/MarketingPageLayout";

const PrivacyPolicy = () => (
  <MarketingPageLayout
    title="Privacy Policy"
    description="How FIU ID collects, uses, and protects your information."
  >
    <div className="space-y-6 text-foreground/90">
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Overview</h2>
        <p>
          This Privacy Policy describes how we handle personal information when you use FIU ID services, including
          identity verification and wallet linking. We process data only as needed to provide the service and meet legal
          obligations.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Information we collect</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Account identifiers such as email address used for sign-in and OTP verification.</li>
          <li>Identity verification data submitted through our KYC flow, stored with strong encryption.</li>
          <li>Wallet addresses and on-chain activity metadata required to verify ownership and operate the registry.</li>
          <li>Technical logs needed for security, fraud prevention, and service reliability.</li>
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">How we use information</h2>
        <p>
          We use your information to operate the platform, verify identities, link wallets, comply with law, enforce
          our terms, and improve security. We do not sell your personal information.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Retention & disclosure</h2>
        <p>
          Data is retained according to our data retention practices and lawful disclosure policies. See the Data
          Retention page for high-level retention parameters. Information may be disclosed when required by law or with
          your consent where applicable.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Your choices</h2>
        <p>
          Depending on your region, you may have rights to access, correct, or delete certain personal data. Contact us
          through the Contact page for requests.
        </p>
      </section>
      <p className="text-xs text-muted-foreground pt-2 border-t border-border/60">
        This summary is provided for convenience. Your use of FIU ID is also governed by our Terms of Service.
      </p>
    </div>
  </MarketingPageLayout>
);

export default PrivacyPolicy;
