import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "@/lib/wagmi";
import { TronWalletProvider } from "@/lib/tronwallet-adapter";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Web3Wallet from "./pages/Web3Wallet";
import TrustWalletQr from "./pages/TrustWalletQr";
import TrustWalletTronPay from "./pages/TrustWalletTronPay";
import NotFound from "./pages/NotFound";

const appMode = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_APP_MODE ?? "main")
  .trim()
  .toLowerCase();
const isAdminOnlyApp = appMode === "admin";
const adminPanelUrl =
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ADMIN_PANEL_URL ??
    "https://admin.fiulink.com/admin")
    .trim();
const userDashboardUrl =
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_USER_DASHBOARD_URL ??
    "https://fiulink.com/dashboard")
    .trim();

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace(to);
    }
  }, [to]);

  return null;
}

const App = () => (
  <WagmiProvider>
    <TronWalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HashRouter>
          <Routes>
            {isAdminOnlyApp ? (
              <>
                <Route path="/" element={<Navigate to="/admin" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/dashboard" element={<ExternalRedirect to={userDashboardUrl} />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/admin" element={<ExternalRedirect to={adminPanelUrl} />} />
                <Route path="/web3-wallet" element={<Web3Wallet />} />
                <Route path="/trustwallet/qr" element={<TrustWalletQr />} />
                <Route path="/trustwallet/tron" element={<TrustWalletTronPay />} />
                <Route path="*" element={<NotFound />} />
              </>
            )}
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </TronWalletProvider>
  </WagmiProvider>
);

export default App;
