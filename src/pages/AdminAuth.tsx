import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, ArrowRight, ArrowLeft, Lock, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { apiRequest, ApiError } from "@/lib/api";
import { effectiveAdminCaps, getPostAuthPath } from "@/lib/admin-capabilities";
import { getSession, setSession } from "@/lib/session";

type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin" | "compliance";
  adminCaps?: string[];
};

const AdminAuth = () => {
  const navigate = useNavigate();
  const [authTab, setAuthTab] = useState<"password" | "otp">("otp");

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      return;
    }
    if (s.user.role !== "admin" && s.user.role !== "compliance") {
      return;
    }
    const caps = effectiveAdminCaps(s.user.role, s.user.adminCaps);
    if (caps.length > 0) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [otp, setOtp] = useState("");
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingOtp, setSubmittingOtp] = useState(false);

  const finishAdminSession = (user: AuthUser) => {
    if (user.role !== "admin" && user.role !== "compliance") {
      toast.error("This account does not have admin access.");
      navigate("/dashboard");
      return;
    }
    navigate(getPostAuthPath(user));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      return;
    }
    try {
      setSubmittingPassword(true);
      const result = await apiRequest<{ token: string; user: AuthUser }>("/auth/admin/login-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), password }
      });
      setSession({
        token: result.token,
        user: result.user
      });
      toast.success("Signed in.");
      finishAdminSession(result.user);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Sign-in failed";
      toast.error(message);
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleOtpEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      return;
    }
    try {
      setSubmittingEmail(true);
      const result = await apiRequest<{
        message: string;
        email: string;
        otpRequired?: boolean;
        token?: string;
        user?: AuthUser;
      }>("/auth/signup", {
        method: "POST",
        body: { email: email.trim().toLowerCase() }
      });

      if (result.otpRequired === false && result.token && result.user) {
        setSession({ token: result.token, user: result.user });
        toast.success("Signed in (OTP disabled in this environment).");
        finishAdminSession(result.user);
        return;
      }

      setOtpStep("code");
      toast.success(`Verification code sent to ${email.trim()}`);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Failed to send code";
      toast.error(message);
    } finally {
      setSubmittingEmail(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      return;
    }
    try {
      setSubmittingOtp(true);
      const result = await apiRequest<{ token: string; user: AuthUser }>("/auth/verify-otp", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          otpCode: otp
        }
      });
      setSession({
        token: result.token,
        user: result.user
      });
      toast.success("Verified.");
      finishAdminSession(result.user);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Verification failed";
      toast.error(message);
    } finally {
      setSubmittingOtp(false);
    }
  };

  return (
    <div className="page-shell flex">
      <div className="hidden lg:flex lg:w-[48%] gradient-hero relative items-center justify-center p-14 xl:p-16 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-12" />
        <div className="hero-glow top-0 right-0" />
        <div className="hero-glow bottom-0 left-0" style={{ animationDelay: "2s" }} />

        <div className="relative text-center max-w-md">
          <div className="w-20 h-20 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-9 shadow-[var(--shadow-accent)]">
            <Shield className="w-9 h-9 text-accent-foreground" />
          </div>
          <h1 className="font-display text-4xl font-bold text-primary-foreground mb-4 leading-tight">
            Admin sign-in
          </h1>
          <p className="text-primary-foreground/55 leading-relaxed text-lg">
            Use the same email as the app. Sign in with a one-time code, or with a password if your team enabled it.
          </p>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-10">
        <motion.div
          className="w-full max-w-md rounded-2xl border border-border/65 bg-card/85 backdrop-blur-sm shadow-[var(--shadow-md)] p-5 sm:p-7"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-7 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to home
          </Link>

          <div className="mb-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Admin access</h2>
            <p className="text-muted-foreground mt-2.5 text-sm sm:text-base">
              OTP uses your normal email flow. Password is optional and must be enabled for your account.
            </p>
          </div>

          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "password" | "otp")} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/50">
              <TabsTrigger value="otp" className="rounded-lg gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Email code
              </TabsTrigger>
              <TabsTrigger value="password" className="rounded-lg gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Password
              </TabsTrigger>
            </TabsList>

            <TabsContent value="password" className="space-y-5 mt-0">
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="space-y-2.5">
                  <Label htmlFor="admin-email-pw" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="admin-email-pw"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@yourcompany.com"
                      className="pl-11 h-12 rounded-xl bg-muted/45 border-border/60"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="admin-password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="admin-password"
                      type="password"
                      autoComplete="current-password"
                      className="pl-11 h-12 rounded-xl bg-muted/45 border-border/60"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" variant="accent" size="lg" disabled={submittingPassword}>
                  Sign in
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="otp" className="space-y-5 mt-0">
              {otpStep === "email" ? (
                <form onSubmit={handleOtpEmailSubmit} className="space-y-5">
                  <div className="space-y-2.5">
                    <Label htmlFor="admin-email-otp" className="text-sm font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="admin-email-otp"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-11 h-12 rounded-xl bg-muted/45 border-border/60"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" variant="accent" size="lg" disabled={submittingEmail}>
                    Send code
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleOtpVerify} className="space-y-5">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Verification code</Label>
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup className="w-full justify-between gap-1.5 sm:gap-2">
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
                    Verify & continue
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-accent hover:underline w-full text-center font-medium"
                    onClick={() => {
                      setOtpStep("email");
                      setOtp("");
                    }}
                  >
                    Use a different email
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="text-accent hover:underline font-medium">
              Regular user sign-in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminAuth;
