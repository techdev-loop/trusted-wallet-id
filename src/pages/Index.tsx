import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Wallet, UserCheck, ArrowRight, Lock, FileCheck, Eye, CheckCircle2, Fingerprint, ShieldCheck, Database, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import heroBg from "@/assets/hero-bg.jpg";

const steps = [
  {
    icon: UserCheck,
    step: "01",
    title: "Sign Up & Verify",
    description: "Create your account with email verification, then complete KYC identity verification.",
  },
  {
    icon: Wallet,
    step: "02",
    title: "Connect Wallet",
    description: "Link your self-custody wallet and sign a verification message to prove ownership.",
  },
  {
    icon: Shield,
    step: "03",
    title: "Identity Linked",
    description: "Your wallet becomes active once third-party identity verification is approved.",
  },
];

const features = [
  {
    icon: Lock,
    title: "AES-256 Encryption",
    description: "All identity data encrypted at rest with military-grade encryption standards.",
  },
  {
    icon: Fingerprint,
    title: "KYC Verification",
    description: "Comprehensive identity verification linking real-world identity to blockchain wallets.",
  },
  {
    icon: Database,
    title: "Separate Databases",
    description: "Identity data and wallet mappings stored in isolated database instances.",
  },
  {
    icon: ShieldCheck,
    title: "Role-Based Access",
    description: "Strict access controls ensure only authorized personnel view sensitive data.",
  },
  {
    icon: FileCheck,
    title: "Audit Logging",
    description: "Immutable audit trails for every admin action and disclosure request.",
  },
  {
    icon: Eye,
    title: "Lawful Disclosure",
    description: "Data disclosed only upon lawful request or prior user consent.",
  },
];

const stats = [
  { value: "256-bit", label: "Encryption" },
  { value: "99.9%", label: "Uptime" },
  { value: "< 3min", label: "Setup Time" },
  { value: "100%", label: "Compliant" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover scale-105" />
          <div className="absolute inset-0 gradient-hero opacity-90" />
          <div className="absolute inset-0 grid-pattern opacity-30" />
        </div>

        {/* Glow effects */}
        <div className="hero-glow -top-20 -right-40 animate-pulse-slow" />
        <div className="hero-glow -bottom-40 -left-20 animate-pulse-slow" style={{ animationDelay: '2s' }} />

        <div className="relative container mx-auto px-4 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8 backdrop-blur-sm">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span className="text-sm font-medium text-accent">Web3 Identity Registry</span>
            </div>
          </motion.div>

          <motion.h1
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 max-w-5xl mx-auto leading-[1.1]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            Link Your Identity to{" "}
            <span className="text-gradient">Web3 Wallets</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-primary-foreground/60 max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            A private, secure platform for KYC-verified wallet linking. 
            Prove wallet ownership while keeping your identity encrypted and protected.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <Button variant="accent" size="xl" asChild>
              <Link to="/auth?mode=signup">
                Get Started
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <a href="#how-it-works">Learn More</a>
            </Button>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-display text-2xl md:text-3xl font-bold text-primary-foreground">{stat.value}</p>
                <p className="text-xs text-primary-foreground/40 mt-1 uppercase tracking-widest">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-28 bg-background relative">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/8 border border-accent/15 mb-5">
              <span className="text-xs font-semibold text-accent tracking-wider uppercase">Simple Process</span>
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground">
              How It Works
            </h2>
            <p className="text-muted-foreground mt-5 max-w-lg mx-auto text-lg">
              Three simple steps to link your identity to your Web3 wallet securely.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-24 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
            
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                className="glass-card rounded-2xl p-8 text-center group relative"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="text-6xl font-display font-bold text-accent/8 mb-2 select-none">{step.step}</div>
                <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-6 shadow-[var(--shadow-accent)] group-hover:shadow-[var(--shadow-lg)] transition-shadow duration-500">
                  <step.icon className="w-7 h-7 text-accent-foreground" />
                </div>
                <h3 className="font-display font-bold text-xl text-foreground mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-28 bg-muted/40 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="container mx-auto px-4 relative">
          <motion.div
            className="text-center mb-20"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/8 border border-accent/15 mb-5">
              <span className="text-xs font-semibold text-accent tracking-wider uppercase">Enterprise Security</span>
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground">
              Built for Trust
            </h2>
            <p className="text-muted-foreground mt-5 max-w-lg mx-auto text-lg">
              Every layer of FIUlink is designed with security and compliance in mind.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto" id="security">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="glass-card rounded-2xl p-8 group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/8 border border-accent/10 flex items-center justify-center mb-5 group-hover:bg-accent/15 group-hover:border-accent/20 transition-all duration-300">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-bold text-lg text-foreground mb-3">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            className="gradient-hero rounded-3xl p-12 md:p-20 text-center max-w-5xl mx-auto relative overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="hero-glow top-0 right-0" />
            <div className="hero-glow bottom-0 left-0" style={{ animationDelay: '2s' }} />
            <div className="absolute inset-0 grid-pattern opacity-20" />
            
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-8 shadow-[var(--shadow-accent)]">
                <CheckCircle2 className="w-7 h-7 text-accent-foreground" />
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground mb-5">
                Ready to Link Your Wallet?
              </h2>
              <p className="text-primary-foreground/50 mb-10 max-w-lg mx-auto text-lg">
                Join the secure identity-linked wallet registry. Quick setup, enterprise-grade security.
              </p>
              <Button variant="accent" size="xl" asChild>
                <Link to="/auth?mode=signup">
                  Start Verification
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
