import { Link } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const sectionLinks = ["How It Works", "Features", "Security"];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navSurfaceClass = scrolled || !isLandingPage
    ? "bg-card/86 backdrop-blur-xl border-b border-border/55 shadow-[var(--shadow-sm)] before:absolute before:inset-0 before:mesh-overlay before:opacity-80 before:pointer-events-none before:-z-10"
    : "bg-transparent border-b border-transparent";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 relative ${navSurfaceClass}`}>
      <div className="page-container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-all duration-300">
            <Shield className="w-4 h-4 text-accent-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-foreground">FIU ID</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {isLandingPage &&
            sectionLinks.map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-accent after:transition-all after:duration-300 hover:after:w-full"
              >
                {item}
              </a>
            ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" asChild className="h-10 px-4">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button variant="accent" asChild className="h-10 px-5">
            <Link to="/auth?mode=signup">Get Started</Link>
          </Button>
        </div>

        <button
          className="md:hidden text-foreground p-2 hover:bg-muted rounded-lg transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-card/95 backdrop-blur-xl border-b border-border/60 animate-slide-up">
          <div className="page-container pb-5 pt-3 space-y-2">
            {isLandingPage &&
              sectionLinks.map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block text-sm text-muted-foreground py-2.5 px-3 rounded-lg hover:bg-muted/70 hover:text-foreground transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {item}
                </a>
              ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" asChild className="w-full">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button variant="accent" asChild className="w-full">
                <Link to="/auth?mode=signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
