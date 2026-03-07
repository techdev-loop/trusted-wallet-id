import { useEffect, useState } from "react";
import { Shield, ArrowUpRight, Wallet, Database, Zap } from "lucide-react";
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
    <footer className="relative overflow-hidden bg-slate-950 text-slate-50">
      {/* background web3 gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-80px] h-80 w-80 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="absolute right-[-40px] top-0 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
        <div className="absolute left-1/2 bottom-[-120px] h-96 w-96 -translate-x-1/2 rounded-full bg-blue-900/40 blur-3xl" />
        <div className="absolute inset-0 grid-pattern opacity-[0.04]" />
      </div>

      <div className="relative container mx-auto px-4 py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start mb-14">
          {/* brand + description + legal notice */}
          <div className="space-y-7">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-2 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 flex items-center justify-center shadow-[0_18px_40px_rgba(37,99,235,0.7)] group-hover:shadow-[0_22px_55px_rgba(37,99,235,0.9)] transition-shadow">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-display font-semibold text-xl tracking-tight">
                FIUlink
              </span>
            </Link>

            <div className="max-w-md rounded-2xl bg-slate-900/70 border border-slate-700/70 px-5 py-4 backdrop-blur">
              <p className="text-sm text-slate-200 leading-relaxed">
                A private Web3 identity-linked wallet registry platform. KYC verification with enterprise-grade encryption and full regulatory compliance.
              </p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 ring-1 ring-emerald-400/40">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                  Compliance-grade node
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-400 ring-1 ring-slate-700/60">
                <Database className="h-3.5 w-3.5 text-slate-300" />
                <span>
                  {legalNotice?.dataRetentionPolicy.statement ??
                    "Data handling and retention follow your jurisdiction’s regulations."}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 max-w-lg leading-relaxed">
              {legalNotice?.disclaimer ??
                "FIUlink is not affiliated with any government authority. All data handling complies with applicable regulations."}
            </p>
          </div>

          {/* navigation + web3 mini cards */}
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-200 mb-4 tracking-wide uppercase">
                  Platform
                </h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "How It Works", href: "#how-it-works" },
                    { label: "Features", href: "#features" },
                    { label: "Security", href: "#security" },
                  ].map((item) => (
                    <li key={item.label}>
                      <a
                        href={item.href}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors group"
                      >
                        <span>{item.label}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="font-display text-sm font-semibold text-slate-200 mb-4 tracking-wide uppercase">
                  Legal
                </h4>
                <ul className="space-y-2.5">
                  {[
                    "Privacy Policy",
                    "Terms of Service",
                    legalNotice
                      ? `Data Retention (${legalNotice.dataRetentionPolicy.retentionDays} days)`
                      : "Data Retention",
                  ].map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors group"
                      >
                        <span>{item}</span>
                        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-sky-500/30 bg-slate-900/70 px-4 py-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-200">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    Identity-linked wallets
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Registry view stays in sync with on-chain wallet activity.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/70 px-4 py-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    Real-time registry status
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Status and contact endpoints keep teams in the loop.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} FIUlink. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs">
            <a
              href="#"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Status</span>
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>Contact</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
