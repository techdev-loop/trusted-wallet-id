import { useEffect, useState } from "react";
import { Shield, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "@/lib/api";

interface LegalNoticeResponse {
  disclaimer: string;
  kycConsentRequirement: string;
  dataRetentionPolicy: {
    retentionDays: number;
    statement: string;
  };
  disclosurePolicy: string;
}

const Footer = () => {
  const [legalNotice, setLegalNotice] = useState<LegalNoticeResponse | null>(null);

  useEffect(() => {
    const loadLegalNotice = async () => {
      try {
        const response = await apiRequest<LegalNoticeResponse>("/legal/notices");
        setLegalNotice(response);
      } catch {
        setLegalNotice(null);
      }
    };

    void loadLegalNotice();
  }, []);

  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-primary text-primary-foreground">
      <div className="absolute inset-0 grid-pattern opacity-[0.06]" />
      <div className="page-container py-12 sm:py-14 md:py-16 relative">
        <div className="grid lg:grid-cols-12 gap-10 mb-10 md:mb-12">
          <div className="lg:col-span-5">
            <Link to="/" className="flex items-center gap-2.5 mb-5 group">
              <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
                <Shield className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-xl">FIUlink</span>
            </Link>
            <p className="text-primary-foreground/55 text-sm max-w-sm leading-relaxed mb-6">
              A private Web3 identity-linked wallet registry platform. KYC verification with enterprise-grade encryption and full regulatory compliance.
            </p>
            <p className="text-primary-foreground/35 text-xs leading-relaxed">
              {legalNotice?.disclaimer ??
                "FIUlink is not affiliated with any government authority. All data handling complies with applicable regulations."}
            </p>
          </div>

          <div className="lg:col-span-3 lg:col-start-7">
            <h4 className="font-display font-semibold text-sm mb-4 text-primary-foreground/85 tracking-wide">Platform</h4>
            <ul className="space-y-3">
              {[
                { label: "How It Works", href: "#how-it-works" },
                { label: "Features", href: "#features" },
                { label: "Security", href: "#security" },
              ].map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-sm text-primary-foreground/55 hover:text-primary-foreground transition-colors inline-flex items-center gap-1 group">
                    {item.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h4 className="font-display font-semibold text-sm mb-4 text-primary-foreground/85 tracking-wide">Legal</h4>
            <ul className="space-y-3">
              {[
                "Privacy Policy",
                "Terms of Service",
                legalNotice
                  ? `Data Retention (${legalNotice.dataRetentionPolicy.retentionDays} days)`
                  : "Data Retention"
              ].map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-primary-foreground/55 hover:text-primary-foreground transition-colors inline-flex items-center gap-1 group">
                    {item}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-primary-foreground/35 text-left">
            © {new Date().getFullYear()} FIUlink. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a href="#" className="text-xs text-primary-foreground/35 hover:text-primary-foreground/75 transition-colors">Status</a>
            <a href="#" className="text-xs text-primary-foreground/35 hover:text-primary-foreground/75 transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
