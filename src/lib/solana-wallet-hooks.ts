import { useCallback, useRef, useState } from 'react';

type SolanaWalletId = 'phantom' | 'solflare';

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

function detectPreferredWalletId(): SolanaWalletId {
  if (typeof window === 'undefined') return 'phantom';
  const win = window as any;
  if (win.phantom?.solana?.isPhantom || win.solana?.isPhantom) return 'phantom';
  if (win.solflare?.isSolflare || win.solana?.isSolflare) return 'solflare';
  return 'phantom';
}

type SolanaAdapter = {
  connected?: boolean;
  publicKey?: { toBase58: () => string } | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
};

async function createAdapter(walletId: SolanaWalletId): Promise<SolanaAdapter> {
  if (walletId === 'solflare') {
    const { SolflareWalletAdapter } = await import('@solana/wallet-adapter-solflare');
    return new SolflareWalletAdapter();
  }
  const { PhantomWalletAdapter } = await import('@solana/wallet-adapter-phantom');
  return new PhantomWalletAdapter();
}

export function useSolanaWallet() {
  const adaptersRef = useRef<Partial<Record<SolanaWalletId, SolanaAdapter>>>({});
  const activeWalletIdRef = useRef<SolanaWalletId | null>(null);
  const [address, setAddress] = useState<string | null>(readInjectedSolanaAddress());
  const [isConnected, setIsConnected] = useState(Boolean(readInjectedSolanaAddress()));
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(
    async (walletId?: SolanaWalletId): Promise<string> => {
      const targetWalletId = walletId ?? activeWalletIdRef.current ?? detectPreferredWalletId();
      setIsConnecting(true);
      try {
        let adapter = adaptersRef.current[targetWalletId];
        if (!adapter) {
          adapter = await createAdapter(targetWalletId);
          adaptersRef.current[targetWalletId] = adapter;
        }
        if (!adapter.connected) {
          await adapter.connect();
        }

        const nextAddress = adapter.publicKey?.toBase58() || readInjectedSolanaAddress();
        if (!nextAddress) {
          throw new Error('Solana wallet connected, but no address was returned.');
        }

        activeWalletIdRef.current = targetWalletId;
        setAddress(nextAddress);
        setIsConnected(true);
        return nextAddress;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? '');
        if (/wallet.*not.*found|not.*installed|not.*ready/i.test(message)) {
          throw new Error('Selected Solana wallet is not installed or unavailable in this browser.');
        }
        throw new Error('Solana wallet connected, but no address was returned.');
      } finally {
        setIsConnecting(false);
      }
    },
    []
  );

  const signWalletMessage = useCallback(
    async (message: string): Promise<string> => {
      const activeWalletId = activeWalletIdRef.current;
      const adapter = activeWalletId ? adaptersRef.current[activeWalletId] : null;
      const liveAddress = adapter?.publicKey?.toBase58() || address || readInjectedSolanaAddress();
      if (!liveAddress) {
        throw new Error('Solana wallet is not connected.');
      }
      if (!adapter?.signMessage) {
        throw new Error('Selected Solana wallet does not support message signing.');
      }

      const encoded = new TextEncoder().encode(message);
      const signature = await adapter.signMessage(encoded);
      return toHex(signature);
    },
    [address]
  );

  const disconnectWallet = useCallback(async () => {
    const activeWalletId = activeWalletIdRef.current;
    const adapter = activeWalletId ? adaptersRef.current[activeWalletId] : null;
    if (adapter?.connected) {
      await adapter.disconnect();
    }
    activeWalletIdRef.current = null;
    setAddress(null);
    setIsConnected(false);
  }, []);

  return {
    address,
    isConnected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    signMessage: signWalletMessage,
  };
}

