import { Outlet } from "react-router-dom";
import { TronWalletProvider } from "@/lib/tronwallet-adapter";

const Web3Providers = () => {
  return (
    <TronWalletProvider>
      <Outlet />
    </TronWalletProvider>
  );
};

export default Web3Providers;
