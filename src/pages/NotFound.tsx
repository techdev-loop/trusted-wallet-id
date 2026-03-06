import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="page-shell flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-[var(--shadow-lg)] p-8 text-center">
        <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-accent)]">
          <Shield className="w-6 h-6 text-accent-foreground" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-3">Error 404</p>
        <h1 className="mb-3 text-3xl sm:text-4xl font-display font-bold">Page not found</h1>
        <p className="mb-7 text-base text-muted-foreground">
          The page <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{location.pathname}</span> does not exist.
        </p>
        <Button asChild variant="accent" size="lg" className="w-full sm:w-auto">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            Return to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
