import { Link } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-[var(--shadow-sm)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 text-white">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow duration-300">
            <Shield className="w-4.5 h-4.5 text-accent-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-white">FIUlink</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {["How It Works", "Features", "Security"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="relative text-sm py-1.5 px-4 flex cursor-pointer items-center justify-center gap-1 text-white/60 hover:text-white transition-colors duration-300"
              onMouseEnter={() => setHoveredItem(item)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span className="relative z-10">{item}</span>
              {hoveredItem === item && (
                <motion.div
                  layoutId="nav-hover-bg"
                  className="absolute inset-0 bg-white/10"
                  style={{ borderRadius: 999 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" asChild className="text-white hover:text-white/80">
            <Link to="/auth">Sign In</Link>
          </Button>
          <Button variant="accent" asChild>
            <Link to="/auth?mode=signup">Get Started</Link>
          </Button>
        </div>

        <button
          className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 px-4 pb-5 pt-2 space-y-1 animate-slide-up text-white">
          {["How It Works", "Features", "Security"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
              className="block text-sm text-white/80 py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {item}
            </a>
          ))}
          <div className="flex gap-3 pt-3">
            <Button variant="ghost" asChild className="flex-1">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button variant="accent" asChild className="flex-1">
              <Link to="/auth?mode=signup">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
