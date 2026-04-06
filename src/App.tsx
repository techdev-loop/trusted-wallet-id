import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { WagmiProvider } from "@/lib/wagmi";
import { TronWalletProvider } from "@/lib/tronwallet-adapter";
import { SolanaWalletProvider } from "@/lib/solana-wallet-provider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Web3Wallet from "./pages/Web3Wallet";
import TrustWalletQr from "./pages/TrustWalletQr";
import TrustWalletTronPay from "./pages/TrustWalletTronPay";
import NotFound from "./pages/NotFound";

const App = () => (
  <WagmiProvider>
    <TronWalletProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/admin" element={<AdminAuth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/web3-wallet" element={<Web3Wallet />} />
              <Route path="/trustwallet/qr" element={<TrustWalletQr />} />
              <Route path="/trustwallet/tron" element={<TrustWalletTronPay />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </TronWalletProvider>
  </WagmiProvider>
);

export default App;
