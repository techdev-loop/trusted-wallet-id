import { useAccount, useConnect, useDisconnect, useSwitchChain, useChainId, useSignMessage } from 'wagmi';
import { sepolia, bsc, mainnet } from 'wagmi/chains';
import type { Chain } from './web3';

// Map our Chain type to Wagmi chain IDs
export const CHAIN_TO_WAGMI_ID: Record<Chain, number | null> = {
  ethereum: mainnet.id, // Ethereum Mainnet
  bsc: bsc.id, // BSC Mainnet
  tron: null, // Not supported by Wagmi
  solana: null, // Not supported by Wagmi
};

// Map Wagmi chain IDs to our Chain type
export function getChainFromWagmiId(chainId: number): Chain | null {
  if (chainId === sepolia.id || chainId === mainnet.id) return 'ethereum';
  if (chainId === bsc.id) return 'bsc';
  return null;
}

// Hook to connect wallet using Wagmi for EVM chains
export function useWagmiWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();

  const connectWallet = async (chain: Chain, connectorId?: string): Promise<string> => {
    if (chain === 'tron' || chain === 'solana') {
      throw new Error('Wagmi does not support Tron or Solana. Use native wallet connection methods.');
    }

    const targetChainId = CHAIN_TO_WAGMI_ID[chain];
    if (!targetChainId) {
      throw new Error(`Chain ${chain} is not supported by Wagmi`);
    }

    const isWalletConnectId = (id: string) => {
      const normalized = id.toLowerCase();
      return normalized === 'walletconnect' || normalized === 'walletconnectlegacy' || normalized === 'walletconnectv2';
    };

    const isInjectedPreferredId = (id: string) => {
      const normalized = id.toLowerCase();
      return (
        normalized === 'metamask' ||
        normalized === 'metamasksdk' ||
        normalized === 'injected' ||
        normalized === 'io.metamask' ||
        normalized === 'coinbasewallet' ||
        normalized === 'coinbasewalletsdk'
      );
    };

    // Find the connector to use
    let connector = connectors.find((c) => {
      const id = c.id ?? '';
      if (connectorId === 'injected') {
        return isInjectedPreferredId(id);
      }
      if (connectorId === 'walletconnect' || connectorId === 'walletConnect') {
        return isWalletConnectId(id);
      }
      return id === connectorId;
    });
    
    // If no exact match: for injected request, never silently fall back to WalletConnect.
    if (!connector && connectorId === 'injected') {
      connector = connectors.find((c) => !isWalletConnectId(c.id ?? '')) || undefined;
    }

    if (!connector && connectorId === 'injected') {
      throw new Error('No injected wallet connector available. Please install/open a browser wallet.');
    }

    // If no connector specified, prefer injected wallets, then WalletConnect
    if (!connector) {
      connector = connectors.find((c) => isInjectedPreferredId(c.id ?? '')) || 
                  connectors.find((c) => isWalletConnectId(c.id ?? '')) ||
                  connectors[0];
    }

    if (!connector) {
      throw new Error('No wallet connector available');
    }

    // Connect wallet if not connected
    if (!isConnected || address === undefined) {
      return new Promise((resolve, reject) => {
        connect(
          { 
            connector,
            chainId: targetChainId,
          },
          {
            onSuccess: async (data) => {
              // Switch chain if needed after connection
              if (data.chainId !== targetChainId) {
                try {
                  await switchChain({ chainId: targetChainId });
                } catch (switchError) {
                  // Chain switch failed, but connection succeeded
                  console.warn('Failed to switch chain:', switchError);
                }
              }
              resolve(data.address);
            },
            onError: (err) => {
              reject(new Error(err.message || 'Failed to connect wallet'));
            },
          }
        );
      });
    }

    // Already connected, switch chain if needed
    if (currentChainId !== targetChainId) {
      try {
        await switchChain({ chainId: targetChainId });
      } catch (switchError) {
        throw new Error(`Failed to switch to ${chain} network`);
      }
    }

    return address || '';
  };

  // Message signing hook
  const { signMessage, signMessageAsync } = useSignMessage();

  const signMessageWithWallet = async (message: string): Promise<string> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const signature = await signMessageAsync({ message });
      return signature;
    } catch (error: any) {
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        throw new Error('User rejected the signature request');
      }
      throw new Error(error?.message || 'Failed to sign message');
    }
  };

  return {
    address: address || null,
    isConnected,
    chainId: currentChainId,
    connectWallet,
    disconnect,
    signMessage: signMessageWithWallet,
    connectors,
    isPending,
    error,
  };
}
