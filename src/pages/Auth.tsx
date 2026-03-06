import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, ArrowRight, ArrowLeft, Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { setSession } from "@/lib/session";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin"
  );
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingOtp, setSubmittingOtp] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      return;
    }

    try {
      setSubmittingEmail(true);
      await apiRequest<{ message: string; email: string }>("/auth/signup", {
        method: "POST",
        body: { email }
      });
      setStep("otp");
      toast.success(`Verification code sent to ${email}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to send verification code";
      toast.error(message);
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      return;
    }

    try {
      setSubmittingOtp(true);
      const result = await apiRequest<{
        token: string;
        user: { id: string; email: string; role: "user" | "admin" | "compliance" };
      }>("/auth/verify-otp", {
        method: "POST",
        body: {
          email,
          otpCode: otp
        }
      });

      setSession({
        token: result.token,
        user: result.user
      });

      toast.success("Verification complete. Redirecting...");
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to verify OTP";
      toast.error(message);
    } finally {
      setSubmittingOtp(false);
    }
  };

  return (
    <div className="page-shell flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative items-center justify-center p-16 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-15" />
        <div className="hero-glow top-0 right-0" />
        <div className="hero-glow bottom-0 left-0" style={{ animationDelay: '2s' }} />
        
        <div className="relative text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-10 shadow-[var(--shadow-accent)]">
            <Shield className="w-9 h-9 text-accent-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold text-primary-foreground mb-5 leading-tight">
            Secure Identity<br />Linking
          </h1>
          <p className="text-primary-foreground/50 leading-relaxed text-lg">
            KYC-verified wallet identity linking with enterprise-grade encryption and full regulatory compliance.
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6">
            {[
              { icon: Lock, label: "AES-256 Encrypted" },
              { icon: Zap, label: "Instant Linking" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-left bg-primary-foreground/5 rounded-xl p-4 border border-primary-foreground/8">
                <item.icon className="w-5 h-5 text-accent flex-shrink-0" />
                <span className="text-sm text-primary-foreground/60">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <motion.div
          className="w-full max-w-md rounded-2xl border border-border/60 bg-card/75 backdrop-blur-sm shadow-[var(--shadow-md)] p-5 sm:p-8"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to home
          </Link>

          <div className="mb-8">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-muted-foreground mt-3 text-base">
              {step === "email"
                ? "Enter your email to continue"
                : "Enter the 6-digit code sent to your email"}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-11 h-12 rounded-xl bg-muted/50 border-border/60 focus:bg-card transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {mode === "signup" && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By creating an account, you agree to our Terms of Service and Privacy Policy. 
                  FIUlink is not affiliated with any government authority.
                </p>
              )}

              <Button type="submit" className="w-full" variant="accent" size="lg" disabled={submittingEmail}>
                Continue
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Verification code</Label>
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="w-full justify-between">
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="accent"
                size="lg"
                disabled={otp.length < 6 || submittingOtp}
              >
                Verify & Continue
              </Button>

              <button
                type="button"
                className="text-sm text-accent hover:underline w-full text-center font-medium"
                onClick={() => { setStep("email"); setOtp(""); }}
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="mt-10 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button className="text-accent hover:underline font-semibold" onClick={() => setMode("signup")}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="text-accent hover:underline font-semibold" onClick={() => setMode("signin")}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
