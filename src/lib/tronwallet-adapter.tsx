import {
  BitKeepAdapter,
  MetaMaskAdapter,
  OkxWalletAdapter,
  TokenPocketAdapter,
  TronLinkAdapter,
  TrustAdapter,
  WalletConnectAdapter,
} from '@tronweb3/tronwallet-adapters';
import { WalletReadyState, type Adapter as TronWalletAdapter } from '@tronweb3/tronwallet-abstract-adapter';
import { ReactNode, createContext, useContext, useState, useEffect, useCallback } from 'react';

// TronWallet Adapter Context
export type TronAdapterType =
  | 'auto'
  | 'tronlink'
  | 'tokenpocket'
  | 'metamask'
  | 'bitkeep'
  | 'okxwallet'
  | 'trust'
  | 'walletconnect';

interface TronWalletContextType {
  adapter: TronWalletAdapter | null;
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: (adapterType?: TronAdapterType) => Promise<string>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  error: Error | null;
}

const TronWalletContext = createContext<TronWalletContextType | null>(null);

// Available adapters
const adapters: Record<Exclude<TronAdapterType, 'auto'>, () => TronWalletAdapter> = {
  tronlink: () => {
    // Keep auto flow non-intrusive (no forced app/browser opens when not installed)
    try {
      return new TronLinkAdapter({
        openTronLinkAppOnMobile: false,
        openUrlWhenWalletNotFound: false,
        dappName: 'FIU ID',
      } as any); // Type assertion in case options aren't in types
    } catch {
      // Fallback if options aren't supported
      return new TronLinkAdapter();
    }
  },
  tokenpocket: () => new TokenPocketAdapter({
    openAppWithDeeplink: false,
    openUrlWhenWalletNotFound: false,
  }),
  metamask: () => new MetaMaskAdapter(),
  bitkeep: () => new BitKeepAdapter({
    openAppWithDeeplink: false,
    openUrlWhenWalletNotFound: false,
  }),
  okxwallet: () => new OkxWalletAdapter({
    openAppWithDeeplink: false,
    openUrlWhenWalletNotFound: false,
  }),
  trust: () => new TrustAdapter({
    openAppWithDeeplink: false,
    openUrlWhenWalletNotFound: false,
  }),
  walletconnect: () => {
    const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_WALLETCONNECT_PROJECT_ID;
    const projectId = rawProjectId?.trim();
    
    if (!projectId) {
      throw new Error('WalletConnect project ID not configured. Set VITE_WALLETCONNECT_PROJECT_ID.');
    }
    
    return new WalletConnectAdapter({
      network: 'Mainnet',
      options: {
        projectId,
        metadata: {
          name: 'FIU ID',
          description: 'Web3 Identity Wallet Registry',
          url: typeof window !== 'undefined' ? window.location.origin : '',
          icons: []
        }
      }
    });
  },
};

const AUTO_ADAPTER_PRIORITY: Exclude<TronAdapterType, 'auto' | 'walletconnect'>[] = [
  'tronlink',
  'tokenpocket',
  'bitkeep',
  'okxwallet',
  'trust',
];

type InjectedTronWeb = {
  ready?: boolean;
  defaultAddress?: { base58?: string; hex?: string };
  address?: { fromHex?: (hex: string) => string };
  trx?: {
    signMessageV2?: (messageHex: string) => Promise<string>;
    signMessage?: (messageHex: string) => Promise<string>;
    sign?: (payload: string) => Promise<string>;
  };
};

type InjectedTronRequestSource = {
  request?: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
  tronWeb?: InjectedTronWeb;
};

type InjectedWindowLike = {
  tronWeb?: InjectedTronWeb & { request?: (payload: { method: string; params?: unknown[] }) => Promise<unknown> };
  tronLink?: InjectedTronRequestSource;
  trustwallet?: {
    tronLink?: InjectedTronRequestSource;
    tron?: InjectedTronRequestSource;
    request?: (payload: { method: string }) => Promise<unknown>;
  };
  okxwallet?: { tronLink?: InjectedTronRequestSource };
  tron?: InjectedTronRequestSource;
};

function getInjectedTronWeb(): InjectedTronWeb | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as InjectedWindowLike;
  return (
    win.tronWeb ??
    win.tronLink?.tronWeb ??
    win.trustwallet?.tronLink?.tronWeb ??
    win.okxwallet?.tronLink?.tronWeb ??
    null
  );
}

function getInjectedTronAddress(requireReady = true): string | null {
  const tronWeb = getInjectedTronWeb();
  if (!tronWeb) return null;
  if (requireReady && !tronWeb.ready) return null;
  const base58 = tronWeb.defaultAddress?.base58;
  if (base58) return base58;
  const hex = tronWeb.defaultAddress?.hex;
  if (hex && tronWeb.address?.fromHex) {
    try {
      return tronWeb.address.fromHex(hex);
    } catch {
      return null;
    }
  }
  return null;
}

async function requestInjectedTronAccess(): Promise<void> {
  if (typeof window === 'undefined') return;
  const win = window as unknown as InjectedWindowLike;

  const requestSources: InjectedTronRequestSource[] = [
    win.tronWeb,
    win.tronLink,
    win.trustwallet?.tronLink,
    win.trustwallet?.tron,
    win.trustwallet ? { request: win.trustwallet.request } : undefined,
    win.okxwallet?.tronLink,
    win.tron,
  ].filter((source): source is InjectedTronRequestSource => Boolean(source?.request));

  const requestWithTimeout = async (
    source: InjectedTronRequestSource,
    payload: { method: string; params?: unknown[] },
    timeoutMs = 2500
  ): Promise<void> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Request timeout: ${payload.method}`));
      }, timeoutMs);
    });
    await Promise.race([source.request?.(payload) as Promise<unknown>, timeoutPromise]);
  };

  for (const source of requestSources) {
    try {
      await requestWithTimeout(source, { method: 'tron_requestAccounts', params: [] });
      return;
    } catch {
      // Try alternative methods and request sources.
    }
    try {
      await requestWithTimeout(source, { method: 'tron_requestAccountsV2', params: [] });
      return;
    } catch {
      // Try next fallback method.
    }
    try {
      await requestWithTimeout(source, { method: 'requestAccounts', params: [] });
      return;
    } catch {
      // Try next fallback method.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectInjectedTronDirect(timeoutMs = 12000): Promise<string | null> {
  const immediate = getInjectedTronAddress(false);
  if (immediate) return immediate;

  await requestInjectedTronAccess();

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const address = getInjectedTronAddress(false);
    if (address) return address;
    await sleep(300);
  }

  return getInjectedTronAddress(false);
}

// TronWallet Provider component
export function TronWalletProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<TronWalletAdapter | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Auto-detect and connect to available adapter
  useEffect(() => {
    const detectAndConnect = async () => {
      // Check for TronLink first (most common)
      if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.tronWeb || win.tronLink) {
          try {
            const tronLinkAdapter = adapters.tronlink();
            await tronLinkAdapter.connect();
            setAdapter(tronLinkAdapter);
            setAddress(tronLinkAdapter.address || null);
          } catch (err) {
            // Silent fail - user may not be ready to connect
            console.debug('TronLink auto-connect failed:', err);
          }
        }
      }
    };

    detectAndConnect();
  }, []);

  // Listen for adapter events
  useEffect(() => {
    if (!adapter) return;

    const handleAccountsChanged = (nextAddress: string) => {
      setAddress(nextAddress || null);
    };

    const handleDisconnect = () => {
      setAddress(null);
      setAdapter(null);
    };

    adapter.on('accountsChanged', handleAccountsChanged);
    adapter.on('disconnect', handleDisconnect);

    return () => {
      adapter.off('accountsChanged', handleAccountsChanged);
      adapter.off('disconnect', handleDisconnect);
    };
  }, [adapter]);

  const connect = useCallback(async (adapterType: TronAdapterType = 'auto'): Promise<string> => {
    try {
      setIsConnecting(true);
      setError(null);

      // Reuse existing connection if available.
      if (adapter && address) {
        return address;
      }

      // Direct injected connection first (especially important for Trust Wallet mobile).
      if (adapterType === 'auto' || adapterType === 'trust') {
        const directAddress = await connectInjectedTronDirect();
        if (directAddress) {
          setAddress(directAddress);
          return directAddress;
        }
      }

      // Auto mode: try detected browser/app wallets first (no QR flow).
      if (adapterType === 'auto') {
        let lastAutoError: Error | null = null;

        for (const candidateType of AUTO_ADAPTER_PRIORITY) {
          const candidate = adapters[candidateType]();

          if (candidate.readyState === WalletReadyState.NotFound) {
            continue;
          }

          try {
            await candidate.connect();
            if (candidate.address) {
              setAdapter(candidate);
              setAddress(candidate.address);
              return candidate.address;
            }
          } catch (err) {
            lastAutoError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (lastAutoError) {
          const injectedAddress = await connectInjectedTronDirect();
          if (injectedAddress) {
            setAddress(injectedAddress);
            return injectedAddress;
          }
          throw lastAutoError;
        }

        const injectedAddress = await connectInjectedTronDirect();
        if (injectedAddress) {
          setAddress(injectedAddress);
          return injectedAddress;
        }

        throw new Error("No Tron wallet detected. Open this site in your wallet app browser and enable Tron account access.");
      }

      const createAdapter = adapters[adapterType];
      if (!createAdapter) {
        throw new Error(`Adapter type "${adapterType}" is not supported`);
      }

      const currentAdapter = createAdapter();
      try {
        await currentAdapter.connect();
      } catch (adapterError) {
        // Some wallets expose a generic Tron provider while a specific adapter cannot bind.
        // Fall back to auto-detection so users can still connect without QR flow.
        const adapterErrorMessage =
          adapterError instanceof Error ? adapterError.message.toLowerCase() : String(adapterError).toLowerCase();
        const shouldFallbackToAuto =
          adapterType !== 'walletconnect' &&
          (adapterErrorMessage.includes('not found') || adapterErrorMessage.includes('wallet not found'));

        if (shouldFallbackToAuto) {
          for (const candidateType of AUTO_ADAPTER_PRIORITY) {
            const candidate = adapters[candidateType]();
            if (candidate.readyState === WalletReadyState.NotFound) {
              continue;
            }
            try {
              await candidate.connect();
              if (candidate.address) {
                setAdapter(candidate);
                setAddress(candidate.address);
                return candidate.address;
              }
            } catch {
              // Keep trying remaining detected adapters.
            }
          }
          const injectedAddress = await connectInjectedTronDirect();
          if (injectedAddress) {
            setAddress(injectedAddress);
            return injectedAddress;
          }
        }

        throw adapterError;
      }
      const connectedAddress = currentAdapter.address;
      
      if (!connectedAddress) {
        throw new Error('Failed to get address from wallet');
      }

      setAdapter(currentAdapter);
      setAddress(connectedAddress);
      return connectedAddress;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      if (error.message.includes('User rejected') || error.message.includes('USER_CANCEL')) {
        throw new Error('User rejected the connection request');
      }
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [adapter, address]);

  const disconnect = useCallback(async () => {
    if (adapter) {
      try {
        await adapter.disconnect();
      } catch (err) {
        console.error('Error disconnecting:', err);
      }
      setAdapter(null);
      setAddress(null);
    }
  }, [adapter]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!address) {
      throw new Error('No address available');
    }

    try {
      // Convert message to hex for Tron
      const messageHex = Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      let signature = '';
      if (adapter) {
        signature = await adapter.signMessage(messageHex);
      } else {
        const tronWeb = getInjectedTronWeb();
        if (!tronWeb?.trx) {
          throw new Error('Wallet not connected. Please connect a wallet first.');
        }
        if (typeof tronWeb.trx.signMessageV2 === 'function') {
          signature = await tronWeb.trx.signMessageV2(messageHex);
        } else if (typeof tronWeb.trx.signMessage === 'function') {
          signature = await tronWeb.trx.signMessage(messageHex);
        } else if (typeof tronWeb.trx.sign === 'function') {
          signature = await tronWeb.trx.sign(messageHex);
        } else {
          throw new Error('Injected Tron wallet does not support message signing.');
        }
      }
      
      if (!signature || signature.length < 16) {
        throw new Error('Invalid signature received from wallet');
      }

      return signature;
    } catch (err: any) {
      if (err?.message?.includes('User rejected') || err?.message?.includes('USER_CANCEL')) {
        throw new Error('User rejected the signature request');
      }
      throw new Error(err?.message || 'Failed to sign message');
    }
  }, [adapter, address]);

  const value: TronWalletContextType = {
    adapter,
    address,
    isConnected: !!address,
    isConnecting,
    connect,
    disconnect,
    signMessage,
    error,
  };

  return (
    <TronWalletContext.Provider value={value}>
      {children}
    </TronWalletContext.Provider>
  );
}

// Hook to use TronWallet
export function useTronWallet() {
  const context = useContext(TronWalletContext);
  if (!context) {
    throw new Error('useTronWallet must be used within TronWalletProvider');
  }
  return context;
}
