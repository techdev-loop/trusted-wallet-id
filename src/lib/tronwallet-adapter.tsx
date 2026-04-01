import {
  BitKeepAdapter,
  MetaMaskAdapter,
  OkxWalletAdapter,
  TokenPocketAdapter,
  TronLinkAdapter,
  TrustAdapter,
} from '@tronweb3/tronwallet-adapters';
import { WalletConnectAdapter } from '@tronweb3/tronwallet-adapter-walletconnect';
import { WalletReadyState, type Adapter as TronWalletAdapter } from '@tronweb3/tronwallet-abstract-adapter';
import { ReactNode, createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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
function createTronWalletConnectAdapter(network: string = 'Mainnet'): TronWalletAdapter {
  const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_WALLETCONNECT_PROJECT_ID;
  const projectId = rawProjectId?.trim();
  if (!projectId) {
    throw new Error('WalletConnect project ID not configured. Set VITE_WALLETCONNECT_PROJECT_ID.');
  }

  return new WalletConnectAdapter({
    network,
    options: {
      projectId,
      metadata: {
        name: 'FIU ID',
        description: 'Web3 Identity Wallet Registry',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        icons: [],
      },
    },
  });
}

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
  // Trust Discover can inject tronLink after first paint; default 2s checkTimeout is often too short.
  trust: () =>
    new TrustAdapter({
      openAppWithDeeplink: false,
      openUrlWhenWalletNotFound: false,
      checkTimeout: 20_000,
    } as ConstructorParameters<typeof TrustAdapter>[0]),
  walletconnect: () => createTronWalletConnectAdapter('Mainnet'),
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

let tronDebugTrace: string[] = [];

function addTronDebug(entry: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  tronDebugTrace = [...tronDebugTrace.slice(-19), `${timestamp} ${entry}`];
}

export function getTronProviderDebugSnapshot(): string {
  if (typeof window === 'undefined') {
    return 'tron-debug: no-window';
  }

  const win = window as unknown as InjectedWindowLike & {
    ethereum?: {
      isMetaMask?: boolean;
      isTrust?: boolean;
      providers?: Array<{ isMetaMask?: boolean; isTrust?: boolean }>;
    };
    navigator?: { userAgent?: string };
  };

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : '';
  const tronWeb = getInjectedTronWeb();
  const flags = {
    hasTronWeb: Boolean(win.tronWeb),
    tronWebReady: Boolean(tronWeb?.ready),
    hasBase58: Boolean(tronWeb?.defaultAddress?.base58),
    hasHex: Boolean(tronWeb?.defaultAddress?.hex),
    hasTronLink: Boolean(win.tronLink),
    hasTrustWallet: Boolean(win.trustwallet),
    hasTrustTronLink: Boolean(win.trustwallet?.tronLink),
    hasOkxWallet: Boolean(win.okxwallet),
    hasOkxTronLink: Boolean(win.okxwallet?.tronLink),
    hasEthereum: Boolean(win.ethereum),
    ethereumIsTrust: Boolean(win.ethereum?.isTrust),
    ethereumIsMetaMask: Boolean(win.ethereum?.isMetaMask),
    ethereumProviders: Array.isArray(win.ethereum?.providers) ? win.ethereum?.providers?.length ?? 0 : 0,
    uaHasTrust: /trustwallet|trust wallet/i.test(ua),
  };

  const trace = tronDebugTrace.join(' || ');
  return `tron-debug ${JSON.stringify(flags)} trace=[${trace}]`;
}

function getInjectedTronWeb(): InjectedTronWeb | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as InjectedWindowLike;
  return (
    win.tronWeb ??
    win.tronLink?.tronWeb ??
    win.trustwallet?.tronLink?.tronWeb ??
    win.trustwallet?.tron?.tronWeb ??
    win.okxwallet?.tronLink?.tronWeb ??
    null
  );
}

/** Trust Discover injects tronLink and/or tron; both may carry request + tronWeb. */
function getTrustTronProvider(): InjectedTronRequestSource | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as InjectedWindowLike;
  return win.trustwallet?.tronLink ?? win.trustwallet?.tron ?? null;
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

function extractAddressFromUnknown(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    if (value.startsWith('T')) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractAddressFromUnknown(item);
      if (extracted) return extracted;
    }
    return null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const directCandidates = ['address', 'base58', 'account', 'selectedAddress'];
    for (const key of directCandidates) {
      const extracted = extractAddressFromUnknown(obj[key]);
      if (extracted) return extracted;
    }
    const nestedCandidates = ['data', 'result', 'accounts'];
    for (const key of nestedCandidates) {
      const extracted = extractAddressFromUnknown(obj[key]);
      if (extracted) return extracted;
    }
  }
  return null;
}

async function requestInjectedTronAccess(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
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
  ): Promise<unknown> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Request timeout: ${payload.method}`));
      }, timeoutMs);
    });
    return await Promise.race([source.request?.(payload) as Promise<unknown>, timeoutPromise]);
  };

  const requestMethods: Array<{ method: string; params?: unknown[] }> = [
    { method: 'tron_requestAccounts' },
    { method: 'tron_requestAccounts', params: [] },
    { method: 'tron_requestAccountsV2' },
    { method: 'tron_requestAccountsV2', params: [] },
    { method: 'requestAccounts' },
    { method: 'requestAccounts', params: [] },
    { method: 'tron_accounts' },
    { method: 'tron_accounts', params: [] },
    { method: 'eth_requestAccounts' },
    { method: 'eth_requestAccounts', params: [] },
    { method: 'eth_accounts' },
    { method: 'eth_accounts', params: [] },
  ];

  for (const source of requestSources) {
    for (const methodConfig of requestMethods) {
      try {
        addTronDebug(`request:${methodConfig.method}:start`);
        const result = await requestWithTimeout(source, methodConfig);
        addTronDebug(`request:${methodConfig.method}:ok`);
        const responseAddress = extractAddressFromUnknown(result);
        if (responseAddress) {
          addTronDebug(`request:${methodConfig.method}:addr`);
          return responseAddress;
        }

        const injectedAddress = getInjectedTronAddress(false);
        if (injectedAddress) {
          addTronDebug(`request:${methodConfig.method}:injected-addr`);
          return injectedAddress;
        }
      } catch {
        addTronDebug(`request:${methodConfig.method}:fail`);
        // Try next request method/source.
      }
    }
  }

  addTronDebug('request:all-failed');
  return null;
}

async function waitForTrustProvider(timeoutMs = 15000): Promise<InjectedTronRequestSource | null> {
  const immediate = getTrustTronProvider();
  if (immediate) return immediate;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const provider = getTrustTronProvider();
    if (provider) return provider;
    await sleep(300);
  }
  return getTrustTronProvider();
}

/** Trust's `tron_requestAccounts` returns `{ code }`; address appears on tronWeb shortly after (see TrustAdapter in @tronweb3/tronwallet-adapters). */
async function pollInjectedTronAddress(totalMs: number): Promise<string | null> {
  const deadline = Date.now() + totalMs;
  while (Date.now() < deadline) {
    const addr = getInjectedTronAddress(false);
    if (addr) return addr;
    await sleep(100);
  }
  return getInjectedTronAddress(false);
}

function isTrustRequestRejected(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as { code?: number }).code === 4001;
}

function isTrustDuplicateRequest(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  return (result as { code?: number }).code === 4000;
}

async function connectTrustProviderDirect(timeoutMs = 15000): Promise<string | null> {
  const trustProvider = await waitForTrustProvider(timeoutMs);
  if (!trustProvider) {
    return getInjectedTronAddress(false);
  }
  // Some Trust builds expose tronWeb before request(); don't bail — poll injected address.
  if (!trustProvider.request) {
    const polled = await connectInjectedTronDirect(Math.min(timeoutMs, 12000));
    if (polled) return polled;
    return getInjectedTronAddress(false);
  }

  const requestWithTimeout = async (
    payload: { method: string; params?: unknown[] },
    requestTimeoutMs = 4000
  ): Promise<unknown> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Trust request timeout: ${payload.method}`));
      }, requestTimeoutMs);
    });

    return await Promise.race([trustProvider.request?.(payload) as Promise<unknown>, timeoutPromise]);
  };

  const requestPayloads: Array<{ method: string; params?: unknown[] }> = [
    { method: 'tron_requestAccounts' },
    { method: 'tron_requestAccounts', params: [] },
    { method: 'tron_requestAccountsV2' },
    { method: 'tron_requestAccountsV2', params: [] },
    { method: 'requestAccounts' },
    { method: 'requestAccounts', params: [] },
    { method: 'eth_requestAccounts' },
    { method: 'eth_requestAccounts', params: [] },
  ];

  for (const payload of requestPayloads) {
    try {
      addTronDebug(`trust-provider:${payload.method}:start`);
      const result = await requestWithTimeout(payload);
      addTronDebug(`trust-provider:${payload.method}:ok`);
      if (isTrustRequestRejected(result)) {
        throw new Error('User rejected the connection request');
      }
      const dup = isTrustDuplicateRequest(result);
      if (dup) await sleep(400);
      const polled = await pollInjectedTronAddress(dup ? 5000 : 3500);
      if (polled) {
        addTronDebug(`trust-provider:${payload.method}:polled-addr`);
        return polled;
      }
      const resAddress = extractAddressFromUnknown(result);
      if (resAddress) {
        addTronDebug(`trust-provider:${payload.method}:addr`);
        return resAddress;
      }
      const injectedAddress = getInjectedTronAddress(false);
      if (injectedAddress) {
        addTronDebug(`trust-provider:${payload.method}:injected-addr`);
        return injectedAddress;
      }
    } catch (e) {
      addTronDebug(`trust-provider:${payload.method}:fail`);
      if (e instanceof Error && e.message.includes('User rejected')) {
        throw e;
      }
      // Try next request payload.
    }
  }

  return getInjectedTronAddress(false);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectAdapterWithTimeout(
  candidate: TronWalletAdapter,
  timeoutMs: number
): Promise<string | null> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error('Adapter connect timeout'));
    }, timeoutMs);
  });

  await Promise.race([candidate.connect(), timeoutPromise]);
  return candidate.address ?? null;
}

async function connectWalletConnectWithOptionalOnUri(
  candidate: TronWalletAdapter,
  timeoutMs: number
): Promise<string | null> {
  if (typeof window === 'undefined') {
    return await connectAdapterWithTimeout(candidate, timeoutMs);
  }

  const win = window as any;
  const onUri = win.__tronWalletConnectOnUri as ((uri: string) => void) | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      reject(new Error('Adapter connect timeout'));
    }, timeoutMs);
  });

  const connectPromise = (candidate as any).connect?.(
    onUri ? { onUri } : undefined
  ) as Promise<unknown>;

  await Promise.race([connectPromise, timeoutPromise]);
  return candidate.address ?? null;
}

async function connectInjectedTronDirect(timeoutMs = 12000): Promise<string | null> {
  const immediate = getInjectedTronAddress(false);
  if (immediate) {
    addTronDebug('direct:immediate-address');
    return immediate;
  }

  // requestInjectedTronAccess can take minutes (many sources × methods × 2.5s timeouts).
  // Cap it so connect("trust") / auto-connect cannot hang indefinitely on "Connecting…".
  const requestCapMs = Math.min(8000, Math.max(4000, timeoutMs - 1500));
  let requestedAddress: string | null = null;
  try {
    requestedAddress = await Promise.race([
      requestInjectedTronAccess(),
      sleep(requestCapMs).then(() => Promise.reject(new Error('requestInjectedTronAccess capped'))),
    ]);
  } catch (e) {
    if (e instanceof Error && e.message === 'requestInjectedTronAccess capped') {
      addTronDebug('direct:request-access-capped');
    }
    requestedAddress = null;
  }
  if (requestedAddress) {
    addTronDebug('direct:requested-address');
    return requestedAddress;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const address = getInjectedTronAddress(false);
    if (address) {
      addTronDebug('direct:polled-address');
      return address;
    }
    await sleep(300);
  }

  addTronDebug('direct:timeout');
  return getInjectedTronAddress(false);
}

// TronWallet Provider component
export function TronWalletProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<TronWalletAdapter | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectedAdapterType, setConnectedAdapterType] = useState<TronAdapterType | null>(null);
  const adapterRef = useRef<TronWalletAdapter | null>(null);

  // Expose current Tron wallet session globally for transaction helpers in web3.ts.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as any;
    win.__tronSessionAdapter = adapter ?? null;
    win.__tronSessionAddress = address ?? null;
    win.__tronSessionAdapterType = connectedAdapterType ?? null;
  }, [adapter, address, connectedAdapterType]);

  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  // Auto-detect and connect to available adapter (not on Trust send page — user connects via QR)
  useEffect(() => {
    const detectAndConnect = async () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash ?? '';
        if (hash.includes('trustwallet/tron')) {
          return;
        }
      }
      // Check for TronLink first (most common)
      if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.trustwallet) {
          return;
        }
        if (win.tronWeb || win.tronLink) {
          try {
            const tronLinkAdapter = adapters.tronlink();
            await tronLinkAdapter.connect();
            setAdapter(tronLinkAdapter);
            setAddress(tronLinkAdapter.address || null);
          } catch (err) {
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

      // Reuse existing connection, except when user explicitly requested WalletConnect QR.
      const canReuseCurrentConnection =
        !!adapter &&
        !!address &&
        (adapterType !== 'walletconnect' || connectedAdapterType === 'walletconnect');
      if (canReuseCurrentConnection) {
        return address;
      }

      // Trust Wallet selection: direct injected Trust/Tron flow (no automatic Trust deeplink redirect).
      if (adapterType === 'trust') {
        addTronDebug('connect:trust:start');
        // 1) TrustAdapter first — matches Trust SDK (request + read tronWeb.defaultAddress). Needs long checkTimeout (see adapters.trust).
        if (typeof window !== 'undefined') {
          const w = window as unknown as InjectedWindowLike;
          if (w.trustwallet?.tronLink) {
            try {
              addTronDebug('connect:trust:adapter-trust:first');
              const trustAdapter = adapters.trust();
              const trustAdapterAddress = await connectAdapterWithTimeout(trustAdapter, 18_000);
              if (trustAdapterAddress) {
                addTronDebug('connect:trust:adapter-trust:success');
                setAdapter(trustAdapter);
                setAddress(trustAdapterAddress);
                setConnectedAdapterType('trust');
                return trustAdapterAddress;
              }
            } catch (e) {
              addTronDebug('connect:trust:adapter-trust:fail');
              const msg = e instanceof Error ? e.message : String(e);
              if (/rejected|4001/i.test(msg)) {
                throw new Error('User rejected the connection request');
              }
            }
          }
        }

        const trustDirectAddress = await connectTrustProviderDirect(18000);
        if (trustDirectAddress) {
          addTronDebug('connect:trust:provider-success');
          setAddress(trustDirectAddress);
          setConnectedAdapterType('trust');
          return trustDirectAddress;
        }
        const trustAddress = await connectInjectedTronDirect(15000);
        if (trustAddress) {
          addTronDebug('connect:trust:success');
          setAddress(trustAddress);
          setConnectedAdapterType('trust');
          return trustAddress;
        }

        // Trust may expose TronLink-compatible bridge.
        try {
          addTronDebug('connect:trust:adapter-tronlink:start');
          const tronLinkAdapter = adapters.tronlink();
          const tronLinkAddress = await connectAdapterWithTimeout(tronLinkAdapter, 8000);
          if (tronLinkAddress) {
            addTronDebug('connect:trust:adapter-tronlink:success');
            setAdapter(tronLinkAdapter);
            setAddress(tronLinkAddress);
            setConnectedAdapterType('tronlink');
            return tronLinkAddress;
          }
        } catch {
          addTronDebug('connect:trust:adapter-tronlink:fail');
        }

        // Some Trust mobile builds expose only EVM provider surface for Tron scope.
        try {
          addTronDebug('connect:trust:adapter-metamask-tron:start');
          const metamaskTronAdapter = adapters.metamask();
          const metamaskTronAddress = await connectAdapterWithTimeout(metamaskTronAdapter, 10000);
          if (metamaskTronAddress) {
            addTronDebug('connect:trust:adapter-metamask-tron:success');
            setAdapter(metamaskTronAdapter);
            setAddress(metamaskTronAddress);
            setConnectedAdapterType('metamask');
            return metamaskTronAddress;
          }
        } catch {
          addTronDebug('connect:trust:adapter-metamask-tron:fail');
        }

        addTronDebug('connect:trust:not-available');
        throw new Error('Trust Wallet Tron provider not available. Open this site in Trust Wallet Discover, switch to a Tron account, and allow connection.');
      }

      // Direct injected connection first (especially important on mobile).
      if (adapterType === 'auto') {
        addTronDebug('connect:auto:start');
        const directAddress = await connectInjectedTronDirect();
        if (directAddress) {
          addTronDebug('connect:auto:direct-success');
          setAddress(directAddress);
          setConnectedAdapterType('auto');
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
            const candidateAddress = await connectAdapterWithTimeout(candidate, 8000);
            if (candidateAddress) {
              addTronDebug(`connect:auto:adapter-success:${candidateType}`);
              setAdapter(candidate);
              setAddress(candidateAddress);
              setConnectedAdapterType(candidateType);
              return candidateAddress;
            }
          } catch (err) {
            addTronDebug(`connect:auto:adapter-fail:${candidateType}`);
            lastAutoError = err instanceof Error ? err : new Error(String(err));
          }
        }

        if (lastAutoError) {
          const injectedAddress = await connectInjectedTronDirect();
          if (injectedAddress) {
            setAddress(injectedAddress);
            setConnectedAdapterType('auto');
            return injectedAddress;
          }
          throw lastAutoError;
        }

        const injectedAddress = await connectInjectedTronDirect();
        if (injectedAddress) {
          setAddress(injectedAddress);
          setConnectedAdapterType('auto');
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
        addTronDebug(`connect:adapter:start:${adapterType}`);
        if (adapterType === 'walletconnect') {
          // WalletConnect modal can take longer on mobile.
          await connectWalletConnectWithOptionalOnUri(currentAdapter, 20000);
        } else {
          await connectAdapterWithTimeout(currentAdapter, 10000);
        }
        addTronDebug(`connect:adapter:ok:${adapterType}`);
      } catch (adapterError) {
        addTronDebug(`connect:adapter:fail:${adapterType}`);
        const adapterErrorMessage =
          adapterError instanceof Error ? adapterError.message.toLowerCase() : String(adapterError).toLowerCase();

        if (adapterType === 'walletconnect' && adapterErrorMessage.includes('chains')) {
          // Retry once with explicit chain-id network format.
          try {
            addTronDebug('connect:adapter:walletconnect-retry-chainid:start');
            const wcRetryAdapter = createTronWalletConnectAdapter('0x2b6653dc');
            const retryAddress = await connectAdapterWithTimeout(wcRetryAdapter, 20000);
            if (retryAddress) {
              addTronDebug('connect:adapter:walletconnect-retry-chainid:success');
              setAdapter(wcRetryAdapter);
              setAddress(retryAddress);
              setConnectedAdapterType('walletconnect');
              return retryAddress;
            }
          } catch {
            addTronDebug('connect:adapter:walletconnect-retry-chainid:fail');
          }
        }

        // Some wallets expose a generic Tron provider while a specific adapter cannot bind.
        // Fall back to auto-detection so users can still connect without QR flow.
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
                setConnectedAdapterType(candidateType);
                return candidate.address;
              }
            } catch {
              // Keep trying remaining detected adapters.
            }
          }
          const injectedAddress = await connectInjectedTronDirect();
          if (injectedAddress) {
            setAddress(injectedAddress);
            setConnectedAdapterType('auto');
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
      setConnectedAdapterType(adapterType);
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
      setConnectedAdapterType(null);
    }
  }, [adapter]);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    try {
      // Convert message to hex for Tron
      const messageHex = Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      let signature = '';
      const liveAdapter = adapterRef.current ?? adapter;
      if (liveAdapter) {
        signature = await liveAdapter.signMessage(messageHex);
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
  }, [adapter]);

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
