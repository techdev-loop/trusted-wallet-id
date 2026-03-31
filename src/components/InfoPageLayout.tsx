import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface InfoPageLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  updatedAt?: string;
}

const InfoPageLayout = ({ eyebrow, title, description, children, updatedAt }: InfoPageLayoutProps) => {
  return (
    <div className="page-shell">
      <Navbar />
      <main className="page-container pt-24 sm:pt-28 pb-10 sm:pb-12 max-w-5xl">
        <div className="app-page-intro mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</span>
          </div>
          <h1 className="section-title text-3xl sm:text-4xl">{title}</h1>
          <p className="section-subtitle mt-3 max-w-3xl">{description}</p>
          {updatedAt ? (
            <p className="text-xs text-muted-foreground mt-3">Last updated: {updatedAt}</p>
          ) : null}
        </div>

        <div className="space-y-4 sm:space-y-5 mb-8">
          {children}
        </div>

        <Button asChild variant="outline" className="h-11 rounded-xl">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
};

export default InfoPageLayout;
