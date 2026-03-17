import { useEffect, useMemo } from "react";
import { WagmiProvider } from "@/lib/wagmi";
import { useWagmiWallet } from "@/lib/wagmi-hooks";

export interface EvmWalletRuntimeApi {
  connectWallet: (chain: "ethereum" | "bsc") => Promise<string>;
  signMessage: (message: string) => Promise<string>;
}

interface EvmWalletRuntimeProps {
  onReady: (api: EvmWalletRuntimeApi) => void;
}

const EvmWalletRuntimeBridge = ({ onReady }: EvmWalletRuntimeProps) => {
  const wagmiWallet = useWagmiWallet();

  const api = useMemo<EvmWalletRuntimeApi>(
    () => ({
      connectWallet: (chain) => wagmiWallet.connectWallet(chain),
      signMessage: (message) => wagmiWallet.signMessage(message),
    }),
    [wagmiWallet]
  );

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
};

const EvmWalletRuntime = ({ onReady }: EvmWalletRuntimeProps) => {
  return (
    <WagmiProvider>
      <EvmWalletRuntimeBridge onReady={onReady} />
    </WagmiProvider>
  );
};

export default EvmWalletRuntime;
