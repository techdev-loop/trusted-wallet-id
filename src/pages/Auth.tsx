import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, ArrowRight, ArrowLeft, Lock, Zap, Eye, EyeOff } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-[#f7f7fb] flex items-center justify-center px-4 py-10">
      <motion.div
        className="w-full max-w-5xl bg-white/80 rounded-[24px] shadow-[0_18px_60px_rgba(15,23,42,0.16)] overflow-hidden flex flex-col lg:flex-row border border-slate-100 backdrop-blur-sm"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Left panel */}
        <div className="relative hidden lg:flex lg:w-1/2 items-stretch bg-[#0f172a]">
          <div className="relative flex-1 m-4 rounded-[22px] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1f2bff] via-[#6d3bff] to-[#f5f3ff]" />
            <div className="absolute -top-32 -right-24 w-80 h-80 rounded-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.36),_transparent_60%)] blur-2xl" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.32),_transparent_60%)] blur-2xl" />

            {/* Top logo chip */}
            <div className="relative px-8 pt-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-[20px] bg-white/12 backdrop-blur-xl border border-white/30 shadow-[0_18px_40px_rgba(15,23,42,0.55)]">
                <Shield className="w-7 h-7 text-white" />
              </div>
            </div>

            {/* Center content - Secure Identity Linking */}
            <div className="relative flex flex-col items-center justify-center px-8 pt-6 pb-4 text-center text-white">
              <h2 className="font-display text-3xl font-semibold leading-tight mb-3">
                Secure Identity
                <br />
                Linking
              </h2>
              <p className="max-w-sm text-sm text-white/80 leading-relaxed">
                KYC-verified wallet identity linking with enterprise-grade encryption and full regulatory compliance.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-[999px] border border-white/55 bg-white/5 px-5 py-2.5 text-xs font-medium backdrop-blur-xl shadow-[0_14px_34px_rgba(15,23,42,0.35)]">
                  <Lock className="w-4 h-4 text-white" />
                  <span className="text-white/90">AES-256 Encrypted</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-[999px] border border-white/45 bg-white/4 px-5 py-2.5 text-xs font-medium backdrop-blur-xl shadow-[0_14px_34px_rgba(15,23,42,0.3)]">
                  <Zap className="w-4 h-4 text-white" />
                  <span className="text-white/90">Instant Linking</span>
                </div>
              </div>
            </div>

            {/* Bottom text - personal hub */}
            <div className="relative px-8 pb-9 pt-2">
              <p className="text-xs text-white/70 mb-2">You can easily</p>
              <h3 className="font-display text-[20px] leading-snug font-semibold text-white max-w-xs">
                Get access your personal hub for clarity and productivity
              </h3>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 sm:px-10 sm:py-12">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-700 mb-8 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to home
            </Link>

            <div className="mb-8">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">
                {mode === "signin" ? "Welcome back" : "Create an account"}
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-500 mt-2 leading-relaxed">
                Access your tasks, notes, and projects anytime, anywhere and keep everything flowing in one place.
              </p>
            </div>

            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-5">
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="text-xs font-medium text-slate-600">
                    Your email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="password" className="text-xs font-medium text-slate-600">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-10 pr-10 h-11 rounded-xl border-slate-200 bg-slate-50/60 focus:bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all text-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === "signup" && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    By creating an account, you agree to our Terms of Service and Privacy Policy. FIUlink is not
                    affiliated with any government authority.
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-medium shadow-[0_12px_30px_rgba(79,70,229,0.45)] hover:shadow-[0_16px_40px_rgba(79,70,229,0.6)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  variant="ghost"
                  size="lg"
                  disabled={submittingEmail}
                >
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-medium text-slate-600">Verification code</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-[11px] text-slate-400">
                    Enter the 6-digit code we sent to <span className="font-medium text-slate-500">{email}</span>.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-medium shadow-[0_12px_30px_rgba(79,70,229,0.45)] hover:shadow-[0_16px_40px_rgba(79,70,229,0.6)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  variant="ghost"
                  size="lg"
                  disabled={otp.length < 6 || submittingOtp}
                >
                  Verify & Continue
                </Button>

                <button
                  type="button"
                  className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline w-full text-center font-medium transition-colors"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                  }}
                >
                  Use a different email
                </button>
              </form>
            )}

            <div className="mt-8 text-center text-xs text-slate-500">
              {mode === "signin" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    className="text-indigo-500 hover:text-indigo-600 hover:underline font-semibold"
                    onClick={() => setMode("signup")}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    className="text-indigo-500 hover:text-indigo-600 hover:underline font-semibold"
                    onClick={() => setMode("signin")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
