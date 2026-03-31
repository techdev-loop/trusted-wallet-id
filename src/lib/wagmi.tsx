import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { WagmiProvider as WagmiProviderBase } from 'wagmi';
import { bsc, mainnet } from 'wagmi/chains';

// Get WalletConnect project ID from environment
const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
  ?.VITE_WALLETCONNECT_PROJECT_ID;
const projectId = rawProjectId?.trim() || '';

const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://trusted-wallet-id.vercel.app';

// RainbowKit builds the Wagmi config for EVM wallet connections.
export const wagmiConfig = getDefaultConfig({
  appName: 'FIU ID',
  projectId: projectId || '00000000000000000000000000000000',
  chains: [mainnet, bsc],
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
            appName: 'FIU ID',
            learnMoreUrl: appUrl,
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProviderBase>
  );
}
