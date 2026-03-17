import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Web3Wallet = lazy(() => import("./pages/Web3Wallet"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const DataRetention = lazy(() => import("./pages/DataRetention"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Web3Providers = lazy(() => import("./components/Web3Providers"));

const AppLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="inline-flex items-center gap-3 rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-[var(--shadow-sm)]">
      <Loader2 className="w-4 h-4 animate-spin text-accent" />
      <span className="text-sm text-foreground">Loading experience...</span>
    </div>
  </div>
);

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <HashRouter>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/data-retention" element={<DataRetention />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/contact" element={<ContactPage />} />

          <Route element={<Web3Providers />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/web3-wallet" element={<Web3Wallet />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </HashRouter>
  </TooltipProvider>
);

export default App;
