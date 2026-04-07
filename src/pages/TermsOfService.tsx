import MarketingPageLayout from "@/components/MarketingPageLayout";

const TermsOfService = () => (
  <MarketingPageLayout
    title="Terms of Service"
    description="Rules and conditions for using the FIU ID platform."
  >
    <div className="space-y-6 text-foreground/90">
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Agreement</h2>
        <p>
          By creating an account or using FIU ID, you agree to these Terms of Service and our Privacy Policy. If you do
          not agree, do not use the service.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Service description</h2>
        <p>
          FIU ID provides identity verification and wallet registry features for Web3 users. Features may change over
          time. We strive for high availability but do not guarantee uninterrupted access.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Accounts & security</h2>
        <p>
          You are responsible for maintaining the confidentiality of your credentials and for activity under your
          account. Notify us promptly of unauthorized use.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Prohibited use</h2>
        <p>
          You may not misuse the platform, attempt unauthorized access, interfere with other users, or use FIU ID to
          violate applicable laws. We may suspend or terminate access for violations.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Disclaimer</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; to the extent permitted by law. FIU ID is not affiliated with any
          government authority unless expressly stated in writing for a specific program.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Contact</h2>
        <p>For questions about these terms, use the Contact page.</p>
      </section>
    </div>
  </MarketingPageLayout>
);

export default TermsOfService;
