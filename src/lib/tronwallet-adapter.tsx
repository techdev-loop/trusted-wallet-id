import { TronLinkAdapter, TokenPocketAdapter, WalletConnectAdapter } from '@tronweb3/tronwallet-adapters';
import type { TronWalletAdapter } from '@tronweb3/tronwallet-abstract-adapter';
import { ReactNode, createContext, useContext, useState, useEffect, useCallback } from 'react';

// TronWallet Adapter Context
interface TronWalletContextType {
  adapter: TronWalletAdapter | null;
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: (adapterType?: 'tronlink' | 'tokenpocket' | 'walletconnect') => Promise<string>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  error: Error | null;
}

const TronWalletContext = createContext<TronWalletContextType | null>(null);

// Available adapters
const adapters: Record<string, () => TronWalletAdapter> = {
  tronlink: () => {
    // TronLinkAdapter - automatically handles connection
    // It will automatically open TronLink app on mobile if needed
    try {
      return new TronLinkAdapter({
        openTronLinkAppOnMobile: true,
        dappName: 'FIU ID',
      } as any); // Type assertion in case options aren't in types
    } catch {
      // Fallback if options aren't supported
      return new TronLinkAdapter();
    }
  },
  tokenpocket: () => new TokenPocketAdapter(),
  walletconnect: () => {
    const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
      ?.VITE_WALLETCONNECT_PROJECT_ID;
    const projectId = rawProjectId?.trim();
    
    if (!projectId) {
      throw new Error('WalletConnect project ID not configured. Set VITE_WALLETCONNECT_PROJECT_ID.');
    }
    
    return new WalletConnectAdapter({
      projectId,
      metadata: {
        name: 'FIU ID',
        description: 'Web3 Identity Wallet Registry',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        icons: [],
      },
    });
  },
};

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

    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts[0] || null);
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

  const connect = useCallback(async (adapterType: 'tronlink' | 'tokenpocket' | 'walletconnect' = 'tronlink'): Promise<string> => {
    try {
      setIsConnecting(true);
      setError(null);

      // Check if already connected with the same adapter
      if (adapter && adapter.name === adapterType && address) {
        return address;
      }

      // Create adapter if not exists or different type
      let currentAdapter = adapter;
      if (!currentAdapter || currentAdapter.name !== adapterType) {
        const createAdapter = adapters[adapterType];
        if (!createAdapter) {
          throw new Error(`Adapter type "${adapterType}" is not supported`);
        }
        currentAdapter = createAdapter();
        setAdapter(currentAdapter);
      }

      // Check if adapter is ready (for TronLink, check if tronWeb is available)
      if (adapterType === 'tronlink') {
        const win = window as any;
        if (!win.tronWeb && !win.tronLink) {
          // On mobile, TronLinkAdapter will handle opening the app
          // On desktop, throw error to show install message
          if (typeof window !== 'undefined' && !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)) {
            throw new Error('TronLink extension not detected. Please install TronLink from https://www.tronlink.org/');
          }
        }
      }

      // Connect - TronLinkAdapter will automatically handle mobile app opening
      await currentAdapter.connect();
      const connectedAddress = currentAdapter.address;
      
      if (!connectedAddress) {
        throw new Error('Failed to get address from wallet');
      }

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
    if (!adapter) {
      throw new Error('Wallet not connected. Please connect a wallet first.');
    }

    if (!address) {
      throw new Error('No address available');
    }

    try {
      // Convert message to hex for Tron
      const messageHex = Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const signature = await adapter.signMessage(messageHex);
      
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
    isConnected: !!address && !!adapter,
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
