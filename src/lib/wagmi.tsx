import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { WagmiProvider as WagmiProviderBase, createConfig, http } from 'wagmi';
import { bsc, mainnet } from 'wagmi/chains';

// Get WalletConnect project ID from environment
const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
  ?.VITE_WALLETCONNECT_PROJECT_ID;
const projectId = rawProjectId?.trim() || '';

const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://trusted-wallet-id.vercel.app';

const appName = 'FIU ID';
const walletConnectProjectId = projectId || '00000000000000000000000000000000';
const chains = [mainnet, bsc] as const;

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [injectedWallet, walletConnectWallet],
    },
  ],
  {
    appName,
    projectId: walletConnectProjectId,
  }
);

// Create a lean Wagmi config with only required wallets/chains.
export const wagmiConfig = createConfig({
  connectors,
  chains,
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
  ssr: false,
});

// Create a query client for Wagmi (shared with app)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Wagmi Provider component
export function WagmiProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          appInfo={{
            appName,
            learnMoreUrl: appUrl,
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProviderBase>
  );
}
