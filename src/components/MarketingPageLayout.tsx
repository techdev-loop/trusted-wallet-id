import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface MarketingPageLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const MarketingPageLayout = ({ title, description, children }: MarketingPageLayoutProps) => (
  <div className="page-shell flex min-h-screen flex-col">
    <Navbar />
    <main className="flex-1 w-full pt-[calc(4rem+0.75rem)] sm:pt-[calc(4rem+1rem)] pb-10 sm:pb-14 md:pb-16">
      <div className="page-container">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" asChild className="mb-6 sm:mb-8 -ml-2 sm:-ml-3 rounded-xl text-muted-foreground hover:text-foreground">
            <Link to="/" className="inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4 shrink-0" />
              Back to home
            </Link>
          </Button>
          <header className="mb-8 sm:mb-10">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
                {description}
              </p>
            ) : null}
          </header>
          <div className="surface-card rounded-2xl p-5 sm:p-7 md:p-8 text-sm sm:text-base text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);

export default MarketingPageLayout;
