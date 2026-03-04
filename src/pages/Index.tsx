import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Wallet, UserCheck, ArrowRight, Lock, FileCheck, Eye, CheckCircle2, Fingerprint, ShieldCheck, Database, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import heroBg from "@/assets/herobg.png";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";
import { useGsapLandingScroll } from "@/hooks/useGsapLandingScroll";

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
  useGsapLandingScroll();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section
        className="gsap-hero-wrap relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#000000",
        }}
      >
        <div className="relative container mx-auto px-4 pt-32 pb-32 text-center">
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
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 max-w-5xl mx-auto leading-[1.1]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <TextGenerateEffect
              words="Link Your Identity to Web3 Wallets"
              highlightFromWord={4}
            />
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-12 leading-relaxed"
            style={{ marginTop: '-30px' }}
            initial={{ opacity: 0, y: 38 }}
            animate={{ opacity: 1, y: 8 }}
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

      </section>

      {/* How It Works */}
      <section id="how-it-works" className="gsap-section py-28 bg-background relative">
        <div className="container mx-auto px-4">
          <motion.div
            className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-start"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            custom={0}
          >
            {/* Left narrative column */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-5">
                <span className="text-xs font-semibold tracking-wider uppercase text-blue-900">
                  Simple, consent-first flow
                </span>
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-blue-900 leading-tight mb-4">
                A clear path from identity to{" "}
                <span className="text-blue-900">verified wallets</span>
              </h2>
              <p className="mt-3 text-base md:text-lg text-white/80 leading-relaxed bg-blue-900 rounded-2xl px-5 py-4 shadow-md inline-block md:block">
                Every step is designed to feel transparent and secure from KYC
                onboarding to linking and activating your Web3 wallet. No
                clutter, no surprises, just a clean, auditable journey.
              </p>
            </div>

            {/* Right zig-zag process cards */}
            <div className="relative">
              <div className="space-y-10">
                {steps.map((step, index) => {
                  const isEven = index % 2 === 1;
                  const isLast = index === steps.length - 1;
                  return (
                    <motion.div
                      key={step.step}
                      className={`relative flex items-stretch gap-5 md:gap-8 ${
                        isEven ? "md:translate-x-6" : ""
                      }`}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.3 }}
                      variants={fadeUp}
                      custom={index + 1}
                    >
                      {/* Left vertical pill / step label */}
                      <div className="relative flex-shrink-0">
                        <div className="h-full min-h-[104px] w-14 md:w-16 rounded-full bg-blue-900 text-white flex flex-col items-center justify-center text-xs font-medium tracking-wide shadow-lg">
                          <span className="opacity-70 mb-1 uppercase tracking-[0.16em]">
                            Step
                          </span>
                          <span className="text-base md:text-lg font-display">
                            {step.step}
                          </span>
                        </div>
                        {!isLast && (
                          <div className="hidden md:block absolute bottom-[-44px] left-1/2 -translate-x-1/2 h-11 w-px border-l border-dashed border-slate-300" />
                        )}
                      </div>

                      {/* Card */}
                      <div className="relative flex-1">
                        {isEven && (
                          <div className="hidden md:block absolute -top-8 left-[-40px] h-8 w-32 border-t border-dashed border-blue-100 rounded-t-full" />
                        )}
                        {!isEven && index !== 0 && (
                          <div className="hidden md:block absolute -top-8 left-0 h-8 w-32 border-t border-dashed border-blue-100 rounded-t-full" />
                        )}

                        <div className="rounded-3xl border border-blue-100 bg-white shadow-sm px-6 py-6 md:px-8 md:py-7">
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-900/5 text-blue-900">
                              <step.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-display text-lg md:text-xl font-semibold text-blue-900">
                                {step.title}
                              </h3>
                              <p className="mt-2 text-sm text-blue-900/70 leading-relaxed">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bridge strip between flow and features */}
      <section className="gsap-section py-16 bg-slate-50">
        <div className="container mx-auto px-4">
          <motion.div
            className="max-w-5xl mx-auto rounded-3xl border border-blue-100 bg-white px-6 py-7 md:px-10 md:py-8 shadow-sm flex flex-col md:flex-row items-center gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={fadeUp}
            custom={0}
          >
            <div className="flex-1 text-center md:text-left">
              <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-900">
                Identity-linked wallets
              </p>
              <h3 className="mt-3 font-display text-2xl md:text-3xl font-bold text-blue-900">
                From simple steps to bank-grade protection
              </h3>
              <p className="mt-3 text-sm md:text-base text-slate-600 max-w-xl mx-auto md:mx-0">
                Once your wallet is linked, FIUlink keeps the heavy compliance work behind
                the scenes encryption, logging, and lawful disclosure controls so your teams
                only see a clean, auditable registry.
              </p>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="gsap-orbit-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-900/10 text-blue-900">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Single, verified wallet
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    One source of truth across your ecosystem.
                  </p>
                </div>
              </div>
              <div className="gsap-orbit-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Compliance ready
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Built for FIUs, VASPs, and regulated fintechs.
                  </p>
                </div>
              </div>
              <div className="gsap-orbit-card rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    Full audit trail
                  </p>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Every wallet event captured and reportable.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features - trust grid */}
      <section id="features" className="py-28 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4">
          {/* Centered heading */}
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            custom={0}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-4">
              <span className="text-xs font-semibold tracking-wider uppercase text-blue-900">
                Enterprise security
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-blue-900">
              Built for trust, audited for regulators
            </h2>
            <p className="mt-4 text-base md:text-lg text-white/80 max-w-2xl mx-auto bg-blue-900 rounded-2xl px-5 py-4 shadow-md">
              Every layer of FIUlink is engineered with bank-grade controls:
              encryption, segregation of data, and complete auditability for
              every identity and wallet action.
            </p>
          </motion.div>

          {/* Card grid inspired by "Why choose us" layout */}
          <motion.div
            className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)] items-stretch"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            custom={1}
          >
            {/* Left mosaic column */}
            <div className="grid gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)]">
              {/* Left column cards */}
              <div className="grid gap-4">
                {/* Primary stat card */}
                <motion.div
                  className="rounded-3xl bg-blue-900 text-white px-6 py-8 flex flex-col justify-between shadow-lg"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.4 }}
                  variants={fadeUp}
                  custom={1}
                >
                  <div>
                    <p className="text-4xl md:text-5xl font-display font-semibold mb-6">
                      256-bit
                    </p>
                    <p className="text-sm uppercase tracking-[0.18em] text-white/60">
                      Encryption standard
                    </p>
                  </div>
                  <p className="mt-6 text-sm text-white/70 max-w-xs">
                    All identity data encrypted at rest with industry-leading
                    ciphers and hardened key management.
                  </p>
                </motion.div>

                {/* Bottom-left stat pair */}
                <div className="grid grid-cols-2 gap-4">
                  <motion.div
                    className="rounded-3xl border border-blue-100 bg-white px-6 py-6 flex flex-col justify-between"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.4 }}
                    variants={fadeUp}
                    custom={2}
                  >
                    <p className="text-2xl font-display font-semibold text-blue-900 mb-2">
                      99.9%
                    </p>
                    <p className="text-xs font-medium text-blue-900/80">
                      Uptime & availability
                    </p>
                    <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                      Redundant infrastructure keeps FIUlink online for critical
                      compliance operations.
                    </p>
                  </motion.div>

                  <motion.div
                    className="rounded-3xl border border-blue-100 bg-blue-50 px-6 py-6 flex flex-col justify-between"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.4 }}
                    variants={fadeUp}
                    custom={3}
                  >
                    <p className="text-2xl font-display font-semibold text-blue-900 mb-2">
                      24/7
                    </p>
                    <p className="text-xs font-medium text-blue-900/80">
                      Monitoring & alerting
                    </p>
                    <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                      Continuous monitoring across infrastructure and key
                      security controls.
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* Wide narrative card under stats */}
              <motion.div
                className="rounded-3xl border border-blue-100 bg-white px-6 py-7 md:col-span-2 flex flex-col justify-between"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                variants={fadeUp}
                custom={4}
              >
                <p className="text-sm font-display font-semibold text-blue-900 mb-2">
                  Lawful disclosure controls
                </p>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Every disclosure of identity data is tied to a lawful request
                  reference, explicit policy checks, and an immutable audit
                  record so regulators and users can see exactly what happened.
                </p>
                <p className="text-xs text-slate-500">
                  All actions are captured in tamper-evident logs and surfaced
                  in your compliance reports.
                </p>
              </motion.div>
            </div>

            {/* Right column – stack of feature cards */}
            <div className="grid gap-4">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  className="rounded-3xl border border-blue-100 bg-white px-6 py-6 flex items-start gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.4 }}
                  variants={fadeUp}
                  custom={i + 5}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900/5 text-blue-900 flex-shrink-0">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm md:text-base text-blue-900 mb-1.5">
                      {feature.title}
                    </h3>
                    <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="gsap-section py-28 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            className="gsap-cta relative max-w-6xl mx-auto overflow-hidden rounded-[40px] border border-blue-500/30 bg-[radial-gradient(circle_at_top,_#1e293b_0,_#020617_55%,_#000000_100%)] px-6 py-12 md:px-16 md:py-16 shadow-[0_40px_120px_rgba(15,23,42,0.9)]"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeUp}
            custom={0}
          >
            {/* ambient glows */}
            <div className="pointer-events-none absolute inset-0 opacity-70">
              <div className="absolute -left-28 top-0 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl" />
              <div className="absolute right-[-80px] bottom-[-40px] h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl" />
              <div className="absolute inset-8 rounded-[34px] border border-white/5" />
            </div>

            {/* floating web3 orbit icons */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-16 top-10 hidden sm:flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-400/40 bg-blue-500/10 text-blue-200 shadow-lg">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="absolute right-20 top-16 hidden md:flex h-9 w-9 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/10 text-sky-200 shadow-lg">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="absolute right-16 bottom-16 hidden sm:flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/10 text-emerald-200 shadow-lg">
                <Fingerprint className="h-5 w-5" />
              </div>
            </div>

            <div className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
              {/* left: core CTA content */}
              <div className="text-center md:text-left max-w-xl mx-auto md:mx-0">
                <div className="mx-auto md:mx-0 mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 shadow-[0_18px_45px_rgba(56,189,248,0.65)]">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-5">
                  Ready to Link Your Wallet?
                </h2>
                <p className="text-slate-200/80 mb-8 max-w-lg mx-auto md:mx-0 text-lg">
                  Join the secure identity-linked wallet registry. Quick setup, enterprise-grade security.
                </p>
                <div className="inline-flex items-center gap-4 rounded-full bg-slate-950/60 px-2 py-2 ring-1 ring-blue-500/40 backdrop-blur">
                  <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-medium text-slate-100/80">
                      Live verification nodes
                    </span>
                  </div>
                  <Button
                    variant="accent"
                    size="xl"
                    asChild
                    className="rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white shadow-[0_18px_45px_rgba(37,99,235,0.8)] hover:brightness-110"
                  >
                    <Link to="/auth?mode=signup">
                      Start Verification
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* right: interactive wallet preview */}
              <div className="relative mx-auto w-full max-w-md">
                <motion.div
                  className="relative rounded-3xl border border-slate-700/80 bg-slate-900/80 px-5 py-4 backdrop-blur-xl shadow-[0_24px_60px_rgba(15,23,42,0.9)]"
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.6 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Wallet address
                      </p>
                      <p className="mt-1 font-mono text-sm text-slate-50">
                        0xA3…9F2b
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-medium text-emerald-200">
                        Linked
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-gradient-to-br from-sky-500/20 via-sky-500/5 to-transparent px-3 py-3 border border-sky-500/40">
                      <p className="text-[11px] font-medium text-slate-300">
                        Chain
                      </p>
                      <p className="mt-1 text-sm font-semibold text-sky-100">
                        Ethereum
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-500/20 via-indigo-500/5 to-transparent px-3 py-3 border border-indigo-500/40">
                      <p className="text-[11px] font-medium text-slate-300">
                        Status
                      </p>
                      <p className="mt-1 text-sm font-semibold text-indigo-100">
                        KYC-verified
                      </p>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent px-3 py-3 border border-emerald-500/40">
                      <p className="text-[11px] font-medium text-slate-300">
                        Trust
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-100">
                        High
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                    <span>On-chain proof ready</span>
                    <span className="font-mono text-slate-300">
                      block #18,203,991
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
