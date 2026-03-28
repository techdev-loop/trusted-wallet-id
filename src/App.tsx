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
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DataRetention from "./pages/DataRetention";
import StatusPage from "./pages/StatusPage";
import ContactPage from "./pages/ContactPage";
import TronUsdtApprove from "./pages/TronUsdtApprove";
import NotFound from "./pages/NotFound";

const App = () => (
  <WagmiProvider>
    <SolanaWalletProvider>
      <TronWalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/web3-wallet" element={<Web3Wallet />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/data-retention" element={<DataRetention />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/tron-usdt-approve" element={<TronUsdtApprove />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </HashRouter>
        </TooltipProvider>
      </TronWalletProvider>
    </SolanaWalletProvider>
  </WagmiProvider>
);

export default App;
