import { createConfig, http, WagmiProvider as WagmiProviderBase } from 'wagmi';
import { sepolia, bsc, mainnet } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

// Get WalletConnect project ID from environment
const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
  ?.VITE_WALLETCONNECT_PROJECT_ID;
const projectId = rawProjectId?.trim() || '';

// Create Wagmi config with chains and connectors
export const wagmiConfig = createConfig({
  chains: [mainnet, bsc], // Ethereum Mainnet and BSC Mainnet
  connectors: [
    injected({
      target: 'metaMask', // Prioritize MetaMask
    }),
    injected({
      target: 'coinbaseWalletSDK',
    }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
            metadata: {
              name: 'FIUlink',
              description: 'Web3 Identity-linked Wallet Registry',
              url: typeof window !== 'undefined' ? window.location.origin : '',
              icons: [],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
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
// Wagmi v3 requires QueryClientProvider
export function WagmiProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProviderBase config={wagmiConfig}>
        {children}
      </WagmiProviderBase>
    </QueryClientProvider>
  );
}
