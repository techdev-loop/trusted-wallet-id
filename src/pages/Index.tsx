import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Wallet, UserCheck, ArrowRight, Lock, FileCheck, Eye, CheckCircle2, Fingerprint, ShieldCheck, Database } from "lucide-react";
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
    description: "Your wallet is now identity-linked. Pay the one-time 10 USDT fee to activate.",
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

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-primary/80" />
        </div>
        <div className="relative container mx-auto px-4 py-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Web3 Identity Registry</span>
            </div>
          </motion.div>

          <motion.h1
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground mb-6 max-w-4xl mx-auto leading-tight"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Link Your Identity to{" "}
            <span className="text-gradient">Web3 Wallets</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-primary-foreground/70 max-w-2xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            A private, secure platform for KYC-verified wallet linking. 
            Prove wallet ownership while keeping your identity encrypted and protected.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Button size="lg" className="gradient-accent text-accent-foreground border-0 px-8 text-base" asChild>
              <Link to="/auth?mode=signup">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 px-8 text-base" asChild>
              <a href="#how-it-works">Learn More</a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <span className="text-sm font-semibold text-accent tracking-wider uppercase">Simple Process</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-3">
              How It Works
            </h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              Three simple steps to link your identity to your Web3 wallet securely.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                className="glass-card rounded-2xl p-8 text-center group hover:shadow-[var(--shadow-lg)] transition-shadow duration-300"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
              >
                <div className="text-5xl font-display font-bold text-accent/15 mb-4">{step.step}</div>
                <div className="w-14 h-14 rounded-xl gradient-accent flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-6 h-6 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-muted/50">
        <div className="container mx-auto px-4">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <span className="text-sm font-semibold text-accent tracking-wider uppercase">Enterprise Security</span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mt-3">
              Built for Trust
            </h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              Every layer of FIUlink is designed with security and compliance in mind.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto" id="security">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="glass-card rounded-2xl p-7 hover:shadow-[var(--shadow-lg)] transition-all duration-300 group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            className="gradient-hero rounded-3xl p-12 md:p-16 text-center max-w-4xl mx-auto relative overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
            <div className="relative">
              <CheckCircle2 className="w-12 h-12 text-accent mx-auto mb-6" />
              <h2 className="font-display text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Ready to Link Your Wallet?
              </h2>
              <p className="text-primary-foreground/70 mb-8 max-w-lg mx-auto">
                Join the secure identity-linked wallet registry. Quick setup, enterprise-grade security.
              </p>
              <Button size="lg" className="gradient-accent text-accent-foreground border-0 px-10 text-base" asChild>
                <Link to="/auth?mode=signup">
                  Start Verification
                  <ArrowRight className="w-4 h-4 ml-2" />
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
