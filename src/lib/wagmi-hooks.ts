import { useCallback } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, useSwitchChain, useSignMessage, useConfig } from 'wagmi';
import { bsc, mainnet } from 'wagmi/chains';
import { getAccount } from 'wagmi/actions';
import { setActiveEip1193Provider, type Chain } from './web3';

// Map our Chain type to Wagmi chain IDs
export const CHAIN_TO_WAGMI_ID: Record<Chain, number | null> = {
  ethereum: mainnet.id, // Ethereum Mainnet
  bsc: bsc.id, // BSC Mainnet
  tron: null, // Not supported by Wagmi
  solana: null, // Not supported by Wagmi
};

// Map Wagmi chain IDs to our Chain type
export function getChainFromWagmiId(chainId: number): Chain | null {
  if (chainId === mainnet.id) return 'ethereum';
  if (chainId === bsc.id) return 'bsc';
  return null;
}

// Hook to connect wallet using Wagmi for EVM chains
export function useWagmiWallet() {
  const config = useConfig();
  const { openConnectModal } = useConnectModal();
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  const waitForConnection = useCallback(
    async (timeoutMs: number = 120000): Promise<string> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const state = getAccount(config);
        if (state.isConnected && state.address) {
          return state.address;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error('Wallet connection timed out.');
    },
    [config]
  );

  const syncConnectedProvider = useCallback(async (): Promise<void> => {
    const state = getAccount(config);
    const connector = state.connector;
    if (!connector || typeof connector.getProvider !== 'function') return;

    try {
      const provider = await connector.getProvider();
      if (
        provider &&
        typeof provider === 'object' &&
        'request' in provider &&
        typeof (provider as { request?: unknown }).request === 'function'
      ) {
        setActiveEip1193Provider(provider as unknown as import('ethers').Eip1193Provider);
      }
    } catch {
      // Best effort: some connectors don't expose an EIP-1193 provider directly.
    }
  }, [config]);

  const connectWallet = useCallback(async (chain: Chain): Promise<string> => {
    if (chain === 'tron' || chain === 'solana') {
      throw new Error('RainbowKit only supports EVM chains.');
    }

    const targetChainId = CHAIN_TO_WAGMI_ID[chain];
    if (!targetChainId) {
      throw new Error(`Chain ${chain} is not supported by RainbowKit`);
    }

    let connectedAddress = address ?? '';
    if (!isConnected || !connectedAddress) {
      if (!openConnectModal) {
        throw new Error('RainbowKit connect modal is unavailable.');
      }
      openConnectModal();
      connectedAddress = await waitForConnection();
    }

    await syncConnectedProvider();

    const current = getAccount(config);
    if (current.chainId !== targetChainId) {
      await switchChainAsync({ chainId: targetChainId });
    }

    return connectedAddress;
  }, [address, config, isConnected, openConnectModal, switchChainAsync, syncConnectedProvider, waitForConnection]);

  // Message signing hook
  const { signMessageAsync } = useSignMessage();

  const signMessageWithWallet = useCallback(async (message: string): Promise<string> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const signature = await signMessageAsync({ message });
      return signature;
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string } | undefined;
      if (err?.code === 4001 || err?.message?.includes('User rejected')) {
        throw new Error('User rejected the signature request');
      }
      throw new Error(err?.message || 'Failed to sign message');
    }
  }, [address, isConnected, signMessageAsync]);

  return {
    address: address || null,
    isConnected,
    chainId: chainId ?? null,
    connectWallet,
    disconnect,
    signMessage: signMessageWithWallet,
  };
}
