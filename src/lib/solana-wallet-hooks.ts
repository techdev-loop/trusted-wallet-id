import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

type SolanaWalletId = 'phantom' | 'solflare';

const WALLET_NAME_BY_ID: Record<SolanaWalletId, string> = {
  phantom: 'Phantom',
  solflare: 'Solflare',
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readInjectedSolanaAddress(): string | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  const candidates = [
    win.phantom?.solana?.publicKey,
    win.solflare?.publicKey,
    win.solana?.publicKey,
  ];
  for (const key of candidates) {
    if (!key) continue;
    const value = typeof key?.toBase58 === 'function' ? key.toBase58() : String(key);
    if (value) return value;
  }
  return null;
}

export function useSolanaWallet() {
  const {
    publicKey,
    connected,
    connecting,
    wallets,
    wallet,
    select,
    connect,
    disconnect,
    signMessage,
  } = useWallet();

  const connectWallet = useCallback(
    async (walletId?: SolanaWalletId): Promise<string> => {
      if (walletId) {
        const targetName = WALLET_NAME_BY_ID[walletId];
        if (!targetName) {
          throw new Error(`Unsupported Solana wallet: ${walletId}`);
        }
        if (wallet?.adapter?.name !== targetName) {
          const targetWallet = wallets.find((item) => item.adapter.name === targetName);
          if (!targetWallet) {
            throw new Error(`${targetName} wallet adapter is not available in this app.`);
          }
          select(targetWallet.adapter.name);
        }
      }

      if (!connected) {
        await connect();
      }

      const address = publicKey?.toBase58() || readInjectedSolanaAddress();
      if (!address) {
        throw new Error('Solana wallet connected, but no address was returned.');
      }

      return address;
    },
    [connected, connect, publicKey, select, wallet?.adapter?.name, wallets]
  );

  const signWalletMessage = useCallback(
    async (message: string): Promise<string> => {
      const liveAddress = publicKey?.toBase58() || readInjectedSolanaAddress();
      if (!liveAddress) {
        throw new Error('Solana wallet is not connected.');
      }
      if (!signMessage) {
        throw new Error('Selected Solana wallet does not support message signing.');
      }

      const encoded = new TextEncoder().encode(message);
      const signature = await signMessage(encoded);
      return toHex(signature);
    },
    [publicKey, signMessage]
  );

  return {
    address: publicKey?.toBase58() ?? null,
    isConnected: connected,
    isConnecting: connecting,
    connectWallet,
    disconnectWallet: disconnect,
    signMessage: signWalletMessage,
  };
}
