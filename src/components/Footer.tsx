import { useEffect, useState } from "react";
import { Shield, ArrowUpRight, ShieldCheck, Lock, FileCheck, Scale, Mail } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();
  const complianceItems = [
    { icon: ShieldCheck, label: "KYC Verified Workflows" },
    { icon: Lock, label: "AES-256 Protected Data" },
    { icon: FileCheck, label: "Immutable Audit Trails" },
    { icon: Scale, label: "Lawful Disclosure Controls" },
  ];

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

  const handleSectionNav = (sectionId: string) => {
    const scrollToSection = () => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    if (location.pathname !== "/") {
      navigate("/");
      window.setTimeout(scrollToSection, 120);
    } else {
      scrollToSection();
    }
  };

  return (
    <footer className="relative overflow-hidden border-t border-border/60 bg-primary text-primary-foreground">
      <div className="absolute inset-0 grid-pattern opacity-[0.06]" />
      <div className="absolute inset-0 mesh-overlay opacity-30" />
      <div className="page-container py-12 sm:py-14 md:py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 mb-10 md:mb-12">
          <div className="md:col-span-2 lg:col-span-6">
            <Link to="/" className="flex items-center gap-2.5 mb-5 group">
              <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow">
                <Shield className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="font-display font-bold text-xl">FIU ID</span>
            </Link>

            <p className="text-primary-foreground/55 text-sm max-w-lg leading-relaxed mb-6">
              A private Web3 identity wallet registry platform. KYC verification with enterprise-grade encryption and full regulatory compliance.
            </p>

            <div className="grid sm:grid-cols-2 gap-2.5 mb-6 max-w-xl">
              {complianceItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg border border-primary-foreground/12 bg-primary-foreground/[0.06] px-3 py-2.5"
                >
                  <item.icon className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-xs text-primary-foreground/65">{item.label}</span>
                </div>
              ))}
            </div>

            <p className="text-primary-foreground/35 text-xs leading-relaxed">
              {legalNotice?.disclaimer ??
                "FIU ID is not affiliated with any government authority. All data handling complies with applicable regulations."}
            </p>
          </div>

          <div className="md:col-span-1 lg:col-span-3 lg:col-start-8">
            <h4 className="font-display font-semibold text-sm mb-4 text-primary-foreground/85 tracking-wide">Platform</h4>
            <ul className="space-y-3">
              {[
                { label: "How It Works", id: "how-it-works", type: "section" as const },
                { label: "Features", id: "features", type: "section" as const },
                { label: "Security", id: "security", type: "section" as const },
                { label: "Start Verification", href: "/auth?mode=signup", type: "route" as const },
                { label: "Admin access", href: "/auth/admin", type: "route" as const },
              ].map((item) => (
                <li key={item.label}>
                  {item.type === "section" ? (
                    <button
                      type="button"
                      onClick={() => handleSectionNav(item.id)}
                      className="text-sm text-primary-foreground/55 hover:text-primary-foreground transition-colors inline-flex items-center gap-1 group"
                    >
                      {item.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                    </button>
                  ) : (
                    <Link to={item.href} className="text-sm text-primary-foreground/55 hover:text-primary-foreground transition-colors inline-flex items-center gap-1 group">
                      {item.label}
                      <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-1 lg:col-span-2 lg:col-start-11">
            <h4 className="font-display font-semibold text-sm mb-4 text-primary-foreground/85 tracking-wide">Legal</h4>
            <ul className="space-y-3">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                {
                  label: legalNotice
                    ? `Data Retention (${legalNotice.dataRetentionPolicy.retentionDays} days)`
                    : "Data Retention",
                  href: "/data-retention",
                },
              ].map((item) => (
                <li key={item.label}>
                  <Link to={item.href} className="text-sm text-primary-foreground/55 hover:text-primary-foreground transition-colors inline-flex items-center gap-1 group">
                    {item.label}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-lg border border-primary-foreground/12 bg-primary-foreground/[0.06] px-3 py-3">
              <p className="text-[11px] uppercase tracking-wider text-primary-foreground/45 mb-1.5">Support</p>
              <Link to="/contact" className="inline-flex items-center gap-2 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                <Mail className="w-3.5 h-3.5 text-accent" />
                Contact support
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-primary-foreground/35 text-left">
            © {new Date().getFullYear()} FIU ID. All rights reserved.
          </p>
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="text-[11px] rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.06] px-2.5 py-1 text-primary-foreground/55">
              SOC-ready posture
            </span>
            <Link to="/status" className="text-xs text-primary-foreground/35 hover:text-primary-foreground/75 transition-colors">Status</Link>
            <Link to="/contact" className="text-xs text-primary-foreground/35 hover:text-primary-foreground/75 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
