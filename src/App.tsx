import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HashRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "@/lib/wagmi";
import { TronWalletProvider } from "@/lib/tronwallet-adapter";
import { SolanaWalletProvider } from "@/lib/solana-wallet-provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Web3Wallet from "./pages/Web3Wallet";
import TrustWalletQr from "./pages/TrustWalletQr";
import TrustWalletTronPay from "./pages/TrustWalletTronPay";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DataRetention from "./pages/DataRetention";
import StatusPage from "./pages/StatusPage";
import ContactPage from "./pages/ContactPage";
import NotFound from "./pages/NotFound";

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
