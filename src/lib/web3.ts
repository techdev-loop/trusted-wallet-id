import { ethers } from "ethers";
import walletRegistryEthAbi from './WalletRegistry-Eth.json';
import walletRegistryTronAbi from './WalletRegistry-Tron.json';
import {
  getPhantomProvider,
  getSolanaUSDTBalance,
  registerSolanaWallet,
  transferSolanaUSDT,
  withdrawSolanaUSDTFromContract,
} from "./solana";

export type Chain = "ethereum" | "bsc" | "tron" | "solana";
export type WalletConnectionMethod = "auto" | "injected" | "walletconnect";

export interface ChainConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

type Eip1193Provider = ethers.Eip1193Provider;

let activeEip1193Provider: Eip1193Provider | null = null;
let walletConnectProvider: Eip1193Provider | null = null;

export function setActiveEip1193Provider(provider: Eip1193Provider | null): void {
  activeEip1193Provider = provider;
}

// Chain configurations for MetaMask
// Note: For testnets, the frontend will use the network from backend config
export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  ethereum: {
    // Ethereum Mainnet
    chainId: "0x1", // Mainnet (1)
    chainName: "Ethereum Mainnet",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"]
  },
  bsc: {
    chainId: "0x38",
    chainName: "BNB Smart Chain",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18
    },
    rpcUrls: ["https://bsc-dataseed.binance.org"],
    blockExplorerUrls: ["https://bscscan.com"]
  },
  tron: {
    chainId: "0x2b6653dc",
    chainName: "Tron",
    nativeCurrency: {
      name: "TRX",
      symbol: "TRX",
      decimals: 18
    },
    rpcUrls: ["https://api.trongrid.io"],
    blockExplorerUrls: ["https://tronscan.org"]
  },
  solana: {
    chainId: "0x65",
    chainName: "Solana",
    nativeCurrency: {
      name: "SOL",
      symbol: "SOL",
      decimals: 9
    },
    rpcUrls: ["https://mainnet.helius-rpc.com/?api-key=b28260a5-911d-4c82-be0d-5fee03221b7c"],
    blockExplorerUrls: ["https://explorer.solana.com"]
  }
};

// USDT token addresses per chain (Mainnet)
export const USDT_ADDRESSES: Record<Chain, string> = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // Ethereum Mainnet USDT
  bsc: "0x55d398326f99059fF775485246999027B3197955", // BSC Mainnet USDT
  tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // TRON Mainnet USDT
  solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" // Solana Mainnet USDT
};

export function resolveUSDTAddress(chain: Chain, overrideAddress?: string): string {
  const override = overrideAddress?.trim();
  if (override) return override;
  return USDT_ADDRESSES[chain];
}

// ERC20 ABI for USDT
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)"
];

// Wallet Registry ABIs - use full ABIs from JSON files
export const WALLET_REGISTRY_ABI = walletRegistryEthAbi.abi;
export const WALLET_REGISTRY_TRON_ABI = walletRegistryTronAbi.abi;

function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const ethereum = (window as unknown as Window & { ethereum?: Eip1193Provider }).ethereum;
  return ethereum ?? null;
}

function getInjectedProviders(): Eip1193Provider[] {
  const injected = getInjectedProvider() as (Eip1193Provider & { providers?: Eip1193Provider[] }) | null;
  if (!injected) {
    return [];
  }

  const providerList = injected.providers && injected.providers.length > 0
    ? injected.providers
    : [injected];

  return Array.from(new Set(providerList));
}

function normalizeWalletError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  return new Error("Wallet connection failed");
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  return /android|iphone|ipad|ipod|mobile/i.test(ua);
}

function isUserRejectedError(error: unknown): boolean {
  const err = error as
    | {
        code?: number | string;
        message?: string;
        error?: { code?: number | string; message?: string };
        info?: { error?: { code?: number | string; message?: string } };
      }
    | undefined;

  const codes = [err?.code, err?.error?.code, err?.info?.error?.code].filter(
    (value): value is number | string => value !== undefined
  );
  const lowerMessage = `${err?.message ?? ""} ${err?.error?.message ?? ""} ${err?.info?.error?.message ?? ""}`
    .toLowerCase();
  return (
    codes.includes(4001) ||
    codes.includes("ACTION_REJECTED") ||
    lowerMessage.includes("user rejected") ||
    lowerMessage.includes("rejected the request")
  );
}

function isRecoverableConnectionError(error: unknown): boolean {
  if (isUserRejectedError(error)) {
    return false;
  }
  const err = error as
    | {
        code?: number | string;
        message?: string;
        error?: { code?: number | string; message?: string };
        info?: { error?: { code?: number | string; message?: string } };
      }
    | undefined;
  const message = `${err?.message ?? ""} ${err?.error?.message ?? ""} ${err?.info?.error?.message ?? ""}`.toLowerCase();
  return (
    message.includes("provider") ||
    message.includes("unsupported") ||
    message.includes("disconnected") ||
    message.includes("wallet") ||
    message.includes("chain") ||
    message.includes("network")
  );
}

function isConnectBeforeRequestError(error: unknown): boolean {
  const err = error as
    | {
        message?: string;
        error?: { message?: string };
        info?: { error?: { message?: string } };
      }
    | undefined;
  const message = `${err?.message ?? ""} ${err?.error?.message ?? ""} ${err?.info?.error?.message ?? ""}`.toLowerCase();
  return message.includes("please call connect() before request()");
}

function getInjectedTronWeb(): any | null {
  if (typeof window === "undefined") return null;
  const win = window as any;
  return (
    win.tronWeb ||
    win.tronLink?.tronWeb ||
    win.trustwallet?.tronLink ||
    win.okxwallet?.tronLink ||
    win.bitkeep?.tronWeb ||
    null
  );
}

function requireInjectedTronWeb(): any {
  const tronWeb = getInjectedTronWeb();
  if (!tronWeb) {
    throw new Error("Tron wallet not found. Open this site in a Tron-compatible wallet browser and reconnect.");
  }
  if (!tronWeb.ready) {
    throw new Error("Tron wallet is not ready. Unlock wallet and reconnect.");
  }
  return tronWeb;
}

async function sendTronSmartContractTransaction(
  contractAddress: string,
  functionSelector: string,
  parameters: Array<{ type: string; value: string }>,
  buildErrorMessage: string,
  failurePrefix: string
): Promise<string> {
  const injectedTronWeb = getInjectedTronWeb();
  if (injectedTronWeb?.ready) {
    const tx = await injectedTronWeb.transactionBuilder.triggerSmartContract(
      contractAddress,
      functionSelector,
      {},
      parameters,
      injectedTronWeb.defaultAddress.hex
    );
    if (!tx?.result?.result || !tx.transaction) {
      throw new Error(buildErrorMessage);
    }
    const signedTx = await injectedTronWeb.trx.sign(tx.transaction);
    const broadcastTx = await injectedTronWeb.trx.broadcast(signedTx);
    if (!broadcastTx?.result || !broadcastTx?.txid) {
      throw new Error(`${failurePrefix}: ${broadcastTx?.message || "Unknown error"}`);
    }
    return broadcastTx.txid;
  }

  if (typeof window === "undefined") {
    throw new Error("Tron wallet is not available");
  }

  const win = window as any;
  const wcAdapter = win.__tronSessionAdapter as { signTransaction?: (tx: unknown) => Promise<unknown> } | undefined;
  const wcAddress = (win.__tronSessionAddress as string | undefined)?.trim();
  const adapterType = String(win.__tronSessionAdapterType || "").toLowerCase();
  const isWalletConnectSession = adapterType === "walletconnect";

  if (!isWalletConnectSession || !wcAdapter?.signTransaction || !wcAddress) {
    throw new Error("Tron wallet not found. Open this site in a Tron-compatible wallet browser and reconnect.");
  }

  const { TronWeb } = await import("tronweb");
  const tronWeb = new TronWeb({ fullHost: CHAIN_CONFIGS.tron.rpcUrls[0] });
  const tx = await tronWeb.transactionBuilder.triggerSmartContract(
    contractAddress,
    functionSelector,
    {},
    parameters,
    wcAddress
  );
  if (!tx?.result?.result || !tx.transaction) {
    throw new Error(buildErrorMessage);
  }

  const signedTx = await wcAdapter.signTransaction(tx.transaction);
  const signedTxForBroadcast = signedTx as Parameters<typeof tronWeb.trx.broadcast>[0];
  const broadcastTx = await tronWeb.trx.broadcast(signedTxForBroadcast);
  const txid =
    (broadcastTx?.txid as string | undefined) ||
    (broadcastTx?.transaction as { txID?: string } | undefined)?.txID;
  if (!broadcastTx?.result || !txid) {
    throw new Error(`${failurePrefix}: ${broadcastTx?.message || "Unknown error"}`);
  }
  return txid;
}

/**
 * Connect to TronLink mobile app directly
 * For mobile, users need to open the dapp in TronLink app's in-app browser
 */
async function connectTronLinkMobile(): Promise<string> {
  // First, check if any Tron wallet is already injected in current dApp browser.
  const tronWeb = getInjectedTronWeb();
  if (tronWeb?.ready) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (tronWeb.defaultAddress?.base58) {
      return tronWeb.defaultAddress.base58;
    }
  }
  
  // If TronLink is not injected, throw error (no manual dialogs)
  // The TronWallet adapter should be used instead for automatic connection
  throw new Error(
    "Tron wallet not detected. " +
    "Please open this page in your Tron wallet app browser (Trust/TronLink/OKX), " +
    "or use a desktop browser with a Tron wallet extension. " +
    "For automatic connection, use the TronWallet adapter."
  );
}

async function createTronWalletConnectProvider(): Promise<string> {
  const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_WALLETCONNECT_PROJECT_ID;
  const projectId = rawProjectId?.trim();
  if (!projectId) {
    throw new Error(
      "WalletConnect is not configured. Set VITE_WALLETCONNECT_PROJECT_ID to enable Tron wallet connections."
    );
  }

  const { WalletConnectAdapter } = await import("@tronweb3/tronwallet-adapter-walletconnect");
  const buildAdapter = (network: string) =>
    new WalletConnectAdapter({
      network,
      options: {
        projectId,
        metadata: {
          name: "FIU ID",
          description: "Web3 Identity Wallet Registry",
          url: typeof window !== "undefined" ? window.location.origin : "",
          icons: [],
        },
      },
    });

  let wcAdapter = buildAdapter("Mainnet");
  try {
    await wcAdapter.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    // Some mobile wallets fail namespace parsing with "chains" on symbolic network names.
    if (!message.includes("chains")) {
      throw error;
    }
    wcAdapter = buildAdapter("0x2b6653dc");
    await wcAdapter.connect();
  }

  const address = wcAdapter.address;
  if (!address) {
    throw new Error("WalletConnect Tron connection succeeded but no wallet address was returned.");
  }

  // Preserve adapter for Tron signing path in signTronMessage().
  if (typeof window !== "undefined") {
    (window as unknown as { __tronWalletConnectWallet?: unknown }).__tronWalletConnectWallet = wcAdapter;
  }

  return address;
}

async function createWalletConnectProvider(chain: Chain): Promise<Eip1193Provider> {
  const rawProjectId = (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_WALLETCONNECT_PROJECT_ID;
  const projectId = rawProjectId?.trim();
  if (!projectId) {
    throw new Error(
      "WalletConnect is not configured. Set VITE_WALLETCONNECT_PROJECT_ID to enable Trust Wallet, OKX Wallet, and SafePal connections."
    );
  }
  if (!/^[a-fA-F0-9]{32}$/.test(projectId)) {
    throw new Error("Invalid WalletConnect project ID format. Check VITE_WALLETCONNECT_PROJECT_ID.");
  }

  const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const selectedConfig = CHAIN_CONFIGS[chain];
  const selectedChainId = Number.parseInt(selectedConfig.chainId, 16);

  const provider = (await EthereumProvider.init({
    projectId,
    showQrModal: true,
    chains: [selectedChainId],
    optionalChains: [1, 56], // Ethereum Mainnet (1) and BSC (56)
    rpcMap: {
      1: CHAIN_CONFIGS.ethereum.rpcUrls[0], // Ethereum Mainnet
      56: CHAIN_CONFIGS.bsc.rpcUrls[0], // BSC Mainnet
    },
    methods: [
      "eth_requestAccounts",
      "eth_accounts",
      "eth_sendTransaction",
      "personal_sign",
      "eth_sign",
      "eth_signTypedData",
      "eth_signTypedData_v4",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain"
    ],
    optionalMethods: [
      "eth_requestAccounts",
      "eth_accounts",
      "eth_sendTransaction",
      "personal_sign",
      "eth_sign",
      "eth_signTypedData",
      "eth_signTypedData_v4",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain"
    ],
    optionalEvents: ["accountsChanged", "chainChanged", "disconnect"]
  })) as { enable: () => Promise<unknown> };

  await provider.enable();
  return provider as unknown as Eip1193Provider;
}

async function resetWalletConnectProvider(): Promise<void> {
  if (!walletConnectProvider) return;
  const providerWithDisconnect = walletConnectProvider as Eip1193Provider & {
    disconnect?: () => Promise<unknown>;
  };
  if (typeof providerWithDisconnect.disconnect === "function") {
    try {
      await providerWithDisconnect.disconnect();
    } catch {
      // Ignore stale disconnect errors.
    }
  }
  if (activeEip1193Provider === walletConnectProvider) {
    activeEip1193Provider = null;
  }
  walletConnectProvider = null;
}

async function ensureWalletConnectSession(provider: Eip1193Provider, chain: Chain): Promise<void> {
  const wcProvider = provider as Eip1193Provider & {
    connect?: (args?: unknown) => Promise<unknown>;
    enable?: () => Promise<unknown>;
    session?: unknown;
  };
  if (wcProvider.session) {
    return;
  }

  const config = CHAIN_CONFIGS[chain];
  const chainId = Number.parseInt(config.chainId, 16);

  if (typeof wcProvider.connect === "function") {
    try {
      await wcProvider.connect({
        chains: [chainId],
        optionalChains: [1, 56] // Ethereum Mainnet (1) and BSC (56)
      });
    } catch {
      // If connect() fails, we'll try enable() next.
    }
  }

  if (!wcProvider.session && typeof wcProvider.enable === "function") {
    await wcProvider.enable();
  }
}

/**
 * Get Ethereum provider (MetaMask, etc.)
 */
export function getEthereumProvider(): ethers.BrowserProvider | null {
  const provider = activeEip1193Provider ?? getInjectedProvider();
  if (!provider) return null;
  return new ethers.BrowserProvider(provider);
}

async function connectWithProvider(provider: Eip1193Provider, chain: Chain): Promise<string> {
  activeEip1193Provider = provider;
  const browserProvider = new ethers.BrowserProvider(provider);
  const rawProvider = getRawProvider(browserProvider);
  let requestAccountsError: unknown = null;

  try {
    await browserProvider.send("eth_requestAccounts", []);
  } catch (error) {
    requestAccountsError = error;
    const lowerMessage = `${(error as { message?: string })?.message ?? ""}`.toLowerCase();
    const requiresConnect = isConnectBeforeRequestError(error) || lowerMessage.includes("missing or invalid request()");

    if (requiresConnect) {
      await ensureWalletConnectSession(provider, chain);
      try {
        if (rawProvider?.request) {
          await rawProvider.request({
            method: "eth_requestAccounts",
            params: []
          });
        } else {
          await browserProvider.send("eth_requestAccounts", []);
        }
        requestAccountsError = null;
      } catch (requestError) {
        requestAccountsError = requestError;
        const chainIdHex = CHAIN_CONFIGS[chain].chainId;
        const chainCandidates = getWalletConnectChainCandidates(rawProvider, chainIdHex);
        let universalSuccess = false;
        if (rawProvider?.request) {
          for (const chainId of chainCandidates) {
            try {
              await rawProvider.request({
                chainId,
                request: { method: "eth_requestAccounts", params: [] }
              });
              universalSuccess = true;
              requestAccountsError = null;
              break;
            } catch {
              // try next chain candidate
            }
          }
        }
        if (!universalSuccess) {
          throw requestError;
        }
      }
    } else {
      throw error;
    }
  }

  let address = "";
  try {
    const signer = await browserProvider.getSigner();
    address = await signer.getAddress();
  } catch {
    const accountsResult =
      (await rawProvider?.request?.({
        method: "eth_accounts",
        params: []
      })) ?? [];

    const accounts = Array.isArray(accountsResult) ? accountsResult : [];
    const firstAccount = accounts.find((account): account is string => typeof account === "string");
    if (!firstAccount) {
      throw normalizeWalletError(requestAccountsError ?? new Error("No account returned from wallet"));
    }
    address = firstAccount;
  }

  if (chain === "ethereum" || chain === "bsc") {
    try {
      await switchNetwork(chain, browserProvider);
    } catch (switchErr) {
      const msg = `${(switchErr as Error)?.message ?? ""}`.toLowerCase();
      const isUnsupported =
        msg.includes("missing or invalid") ||
        msg.includes("request()") ||
        msg.includes("wallet_switchethereumchain");
      if (isUnsupported) {
        // WalletConnect/mobile wallets often don't support chain switch in this format.
        // Proceed with connection; user can switch network manually in wallet.
        return address.toLowerCase();
      }
      throw switchErr;
    }
  }

  return address.toLowerCase();
}

/**
 * Connect to wallet and get address
 */
// Helper to connect TronLink
async function connectTronLink(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Tron wallet is not available");
  }

  const tronWeb = requireInjectedTronWeb();

  const address = tronWeb.defaultAddress?.base58;
  if (!address) {
    throw new Error("No Tron address found. Ensure your connected Tron wallet has an active account.");
  }

  return address; // Tron addresses are base58, case-sensitive
}

// Helper to connect Phantom (supports both desktop extension and mobile app)
async function connectPhantom(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Phantom is not available");
  }

  const win = window as any;
  const isMobile = isMobileDevice();

  // Check for desktop extension first
  if (win.phantom?.solana) {
    const provider = win.phantom.solana;
    if (provider.isPhantom) {
      try {
        const response = await provider.connect();
        return response.publicKey.toString();
      } catch (error) {
        if ((error as any)?.code === 4001) {
          throw new Error("User rejected the connection request");
        }
        throw normalizeWalletError(error);
      }
    }
  }

  // On mobile, use deep linking to open Phantom app
  if (isMobile) {
    return await connectPhantomMobile();
  }

  // Desktop but no extension found
  throw new Error("Phantom extension not detected. Please install Phantom from https://phantom.app/");
}

// Connect to Phantom mobile app using deep linking
async function connectPhantomMobile(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if we're returning from Phantom callback
    const urlParams = new URLSearchParams(window.location.search);
    const callbackSessionId = urlParams.get('phantom_connect');
    const callbackPublicKey = urlParams.get('phantom_public_key');
    const callbackError = urlParams.get('phantom_error');
    
    if (callbackSessionId) {
      // We're in the callback - check if session matches
      const storedSessionId = sessionStorage.getItem('phantom_session_id');
      if (storedSessionId === callbackSessionId) {
        // Clean up URL
        const newUrl = window.location.pathname + window.location.search.replace(/[?&]phantom_connect=[^&]*/, '').replace(/[?&]phantom_public_key=[^&]*/, '').replace(/[?&]phantom_error=[^&]*/, '');
        window.history.replaceState({}, '', newUrl);
        
        sessionStorage.removeItem('phantom_session_id');
        const timeoutId = sessionStorage.getItem('phantom_timeout_id');
        if (timeoutId) {
          clearTimeout(parseInt(timeoutId));
          sessionStorage.removeItem('phantom_timeout_id');
        }
        
        if (callbackError) {
          reject(new Error(decodeURIComponent(callbackError)));
          return;
        }
        
        if (callbackPublicKey) {
          resolve(decodeURIComponent(callbackPublicKey));
          return;
        }
        
        reject(new Error('No public key received from Phantom'));
        return;
      }
    }
    
    // Generate a unique session ID for this connection
    const sessionId = `phantom_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Store the session ID in sessionStorage to verify the callback
    sessionStorage.setItem('phantom_session_id', sessionId);
    
    // Create the deep link URL
    const appUrl = encodeURIComponent(window.location.href.split('?')[0]); // Remove existing query params
    const redirectLink = encodeURIComponent(`${window.location.origin}${window.location.pathname}?phantom_connect=${sessionId}`);
    const phantomDeepLink = `https://phantom.app/ul/v1/connect?app_url=${appUrl}&redirect_link=${redirectLink}`;
    
    // Set a timeout to clean up if user doesn't connect
    const timeout = setTimeout(() => {
      sessionStorage.removeItem('phantom_session_id');
      sessionStorage.removeItem('phantom_timeout_id');
      reject(new Error('Connection timeout. Please try again.'));
    }, 60000); // 60 second timeout
    
    // Store timeout ID to clear it if connection succeeds
    sessionStorage.setItem('phantom_timeout_id', timeout.toString());
    
    // Open Phantom app via deep link
    console.log('Opening Phantom app via deep link...');
    window.location.href = phantomDeepLink;
  });
}

export async function connectWallet(
  chain: Chain,
  method: WalletConnectionMethod = "auto"
): Promise<string> {
  // On mobile devices, handle wallet connections appropriately
  if (isMobileDevice()) {
    // For Solana on mobile, allow Phantom deep link connection
    if (chain === "solana") {
      if (method === "injected" || method === "auto") {
        try {
          return await connectPhantom();
        } catch (error) {
          throw error;
        }
      }
      if (method === "walletconnect") {
        throw new Error("WalletConnect QR is not supported for Solana in this app. Please use Phantom.");
      }
      throw new Error("Solana wallet connection method not supported on mobile. Please use Phantom.");
    }
    
    // For Tron on mobile, use Tron-specific WalletConnect provider
    if (chain === "tron") {
      if (method === "injected" || method === "auto") {
        try {
          return await connectTronLinkMobile();
        } catch (error) {
          if (method === "injected") {
            throw error;
          }
          // Fall through to WalletConnect for auto mode
        }
      }
      if (method === "walletconnect" || method === "auto") {
        try {
          return await createTronWalletConnectProvider();
        } catch (error) {
          throw new Error(
            `Failed to connect via WalletConnect: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      throw new Error("Tron wallet connection method not supported on mobile");
    }
    
    // For EVM chains (Ethereum, BSC) on mobile, use WalletConnect
    if (method === "injected") {
      throw new Error(
        "Browser wallet extensions are not available on mobile devices. Please use WalletConnect to connect your mobile wallet."
      );
    }
    if (method === "walletconnect" || method === "auto") {
      const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
      walletConnectProvider = provider;
      return await connectWithProvider(provider, chain);
    }
  }
  
  // Handle Tron with TronLink (desktop only)
  if (chain === "tron") {
    if (method === "injected" || method === "auto") {
      try {
        return await connectTronLink();
      } catch (error) {
        if (method === "injected") {
          throw error;
        }
        // For auto mode on desktop, fall through to WalletConnect if TronLink fails
      }
    }
    if (method === "walletconnect" || method === "auto") {
      try {
        return await createTronWalletConnectProvider();
      } catch (error) {
        throw new Error(
          `Failed to connect via WalletConnect: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    throw new Error("Tron wallet connection method not supported");
  }

  // Handle Solana with Phantom
  if (chain === "solana") {
    if (method === "injected" || method === "auto") {
      try {
        return await connectPhantom();
      } catch (error) {
        throw error;
      }
    }
    if (method === "walletconnect") {
      throw new Error("WalletConnect QR is not supported for Solana in this app. Please use Phantom.");
    }
    throw new Error("Solana wallet connection method not supported. Please use Phantom.");
  }

  // Handle EVM chains (Ethereum, BSC)
  if (method === "injected") {
    const injectedProviders = getInjectedProviders();
    if (injectedProviders.length === 0) {
      throw new Error("No browser wallet detected. Install or enable a wallet extension.");
    }

    let lastError: unknown = null;
    for (const provider of injectedProviders) {
      try {
        return await connectWithProvider(provider, chain);
      } catch (error) {
        lastError = error;
      }
    }
    if (isMobileDevice() && isRecoverableConnectionError(lastError)) {
      const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
      walletConnectProvider = provider;
      return await connectWithProvider(provider, chain);
    }
    throw normalizeWalletError(lastError);
  }

  if (method === "walletconnect") {
    // Force a clean WalletConnect session to avoid stale chain namespace issues on mobile.
    await resetWalletConnectProvider();
    let provider = await createWalletConnectProvider(chain);
    walletConnectProvider = provider;
    try {
      return await connectWithProvider(provider, chain);
    } catch (error) {
      if (!isConnectBeforeRequestError(error)) {
        throw error;
      }
      provider = await createWalletConnectProvider(chain);
      walletConnectProvider = provider;
      return await connectWithProvider(provider, chain);
    }
  }

  const injectedProviders = getInjectedProviders();
  if (injectedProviders.length > 0) {
    let lastInjectedError: unknown = null;
    for (const provider of injectedProviders) {
      try {
        return await connectWithProvider(provider, chain);
      } catch (error) {
        lastInjectedError = error;
      }
    }

    if (isMobileDevice() && isRecoverableConnectionError(lastInjectedError)) {
      await resetWalletConnectProvider();
      let provider = await createWalletConnectProvider(chain);
      walletConnectProvider = provider;
      try {
        return await connectWithProvider(provider, chain);
      } catch (error) {
        if (!isConnectBeforeRequestError(error)) {
          throw error;
        }
        provider = await createWalletConnectProvider(chain);
        walletConnectProvider = provider;
        return await connectWithProvider(provider, chain);
      }
    }

    // If injected wallets are present but all failed, show that explicit error.
    throw normalizeWalletError(lastInjectedError);
  }

  // In auto mode on mobile, prefer a fresh WalletConnect session.
  if (isMobileDevice()) {
    await resetWalletConnectProvider();
  }
  let provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
  walletConnectProvider = provider;
  try {
    return await connectWithProvider(provider, chain);
  } catch (error) {
    if (!isConnectBeforeRequestError(error)) {
      throw error;
    }
    provider = await createWalletConnectProvider(chain);
    walletConnectProvider = provider;
    return await connectWithProvider(provider, chain);
  }
}

// Sign message with TronLink
async function signTronMessage(message: string, address: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("TronLink is not available");
  }

  const win = window as any;
  
  // Check if using WalletConnect Tron wallet (for mobile)
  const walletConnectWallet = win.__tronWalletConnectWallet;
  if (walletConnectWallet) {
    try {
      // Convert message to hex for Tron
      const messageHex = Array.from(new TextEncoder().encode(message))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
      
      // Sign message using WalletConnect wallet
      const signature = await walletConnectWallet.signMessage(messageHex);
      
      if (!signature || signature.length < 16) {
        throw new Error(`WalletConnect signature is invalid (length: ${signature.length})`);
      }
      
      return signature;
    } catch (error: any) {
      if (error?.code === 4001 || error?.message?.includes("User rejected")) {
        throw new Error("User rejected the signature request");
      }
      throw new Error(`WalletConnect Tron signing failed: ${error?.message || String(error)}`);
    }
  }

  // Fallback to injected Tron wallet provider (Trust/TronLink/OKX/etc.)
  const tronWeb = requireInjectedTronWeb();

  const currentAddress = tronWeb.defaultAddress?.base58;
  if (!currentAddress || currentAddress !== address) {
    throw new Error("Connected TronLink address does not match. Please reconnect with the correct address.");
  }

  try {
    // TronLink message signing
    // TronLink's signMessageV2 expects a hex-encoded message
    // Convert message string to hex
    const messageHex = Array.from(new TextEncoder().encode(message))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    let result: unknown = null;
    
    // TronLink uses signMessageV2() method (official API)
    if (tronWeb.trx && typeof tronWeb.trx.signMessageV2 === "function") {
      try {
        // TronLink's signMessageV2 expects hex-encoded message
        result = await tronWeb.trx.signMessageV2(messageHex);
      } catch (signError: any) {
        const errorMsg = signError?.message || String(signError);
        console.error("TronLink trx.signMessageV2 failed:", signError);
        
        // Re-throw with more context if it's a user rejection
        if (errorMsg.includes("USER_CANCEL") || errorMsg.includes("User rejected") || errorMsg.includes("cancel")) {
          throw new Error("User rejected the signature request");
        }
        throw signError;
      }
    } else if (tronWeb.trx && typeof tronWeb.trx.signMessage === "function") {
      // Fallback to signMessage (older versions)
      try {
        result = await tronWeb.trx.signMessage(messageHex);
      } catch (signError: any) {
        const errorMsg = signError?.message || String(signError);
        console.error("TronLink trx.signMessage failed:", signError);
        
        if (errorMsg.includes("USER_CANCEL") || errorMsg.includes("User rejected") || errorMsg.includes("cancel")) {
          throw new Error("User rejected the signature request");
        }
        throw signError;
      }
    } else {
      // Neither method available
      throw new Error(
        "TronLink message signing methods (signMessageV2/signMessage) not available. " +
        "Please ensure TronLink extension is installed and unlocked."
      );
    }
    
    // TronLink returns signature in hex format
    // Handle different response formats and ensure we get a string
    let signature = "";
    
    try {
      if (typeof result === "string") {
        signature = result;
      } else if (result && typeof result === "object") {
        // Check various possible result formats and convert to string safely
        const sigValue = (result as any).signature || (result as any).result || (result as any).message || (result as any).data;
        if (sigValue != null) {
          signature = String(sigValue);
        }
      } else if (result != null) {
        // Fallback: convert anything else to string
        signature = String(result);
      }
    } catch (parseError) {
      console.error("Error parsing TronLink signature result:", parseError, "Result:", result);
      throw new Error("Failed to parse TronLink signature response. Please try again.");
    }
    
    // Clean and validate signature
    signature = signature.trim();
    
    // Validate signature length
    if (!signature || signature.length < 16) {
      const resultStr = result != null ? JSON.stringify(result) : "null";
      throw new Error(
        `TronLink signature is invalid (length: ${signature.length}). ` +
        `Expected at least 16 characters. Result type: ${typeof result}, Value: ${resultStr}`
      );
    }
    
    return signature;
  } catch (error) {
    if ((error as any)?.code === "USER_CANCEL" || (error as any)?.code === 4001) {
      throw new Error("User rejected the signature request");
    }
    if (error instanceof Error) {
      throw error;
    }
    throw normalizeWalletError(error);
  }
}

// Sign message with Phantom
async function signSolanaMessage(message: string, address: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Phantom is not available");
  }

  const win = window as any;
  if (!win.phantom || !win.phantom.solana) {
    throw new Error("Phantom extension not detected. Please install Phantom from https://phantom.app/");
  }

  const provider = win.phantom.solana;
  if (!provider.isPhantom) {
    throw new Error("Phantom wallet not detected");
  }

  try {
    // Convert message to Uint8Array
    const messageBytes = new TextEncoder().encode(message);
    
    // Sign message with Phantom
    const signedMessage = await provider.signMessage(messageBytes, "utf8");
    
    // Phantom returns signature in base58 format
    // Convert to hex for consistency (browser-compatible, no Buffer)
    const signatureArray = Array.from(signedMessage.signature);
    const signatureHex = signatureArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");
    return signatureHex;
  } catch (error) {
    if ((error as any)?.code === 4001) {
      throw new Error("User rejected the signature request");
    }
    throw normalizeWalletError(error);
  }
}

export async function signWalletMessage(
  message: string,
  address: string,
  chain: Chain = "ethereum"
): Promise<string> {
  // Handle Tron message signing
  if (chain === "tron") {
    return await signTronMessage(message, address);
  }

  // Handle Solana message signing
  if (chain === "solana") {
    return await signSolanaMessage(message, address);
  }

  // Handle EVM chains (Ethereum, BSC)
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("Wallet provider not available for signing.");
  }

  const utf8Message = String(message ?? "");
  const expectedAddress = address.toLowerCase();
  const rawProvider = getRawProvider(provider);
  const chainIdHex = CHAIN_CONFIGS[chain]?.chainId ?? CHAIN_CONFIGS.ethereum.chainId;
  const chainCandidates = getWalletConnectChainCandidates(rawProvider, chainIdHex);

  const requestAccountsWithFallback = async (): Promise<void> => {
    try {
      await provider.send("eth_requestAccounts", []);
      return;
    } catch {
      // fall through
    }

    if (!rawProvider?.request) {
      return;
    }

    try {
      await rawProvider.request({
        method: "eth_requestAccounts",
        params: []
      });
      return;
    } catch {
      // fall through
    }

    for (const chainId of chainCandidates) {
      try {
        await rawProvider.request({
          chainId,
          request: { method: "eth_requestAccounts", params: [] }
        });
        return;
      } catch {
        // continue
      }
    }
  };

  const signWithSigner = async (): Promise<string> => {
    const signer = await provider.getSigner();
    const signerAddress = (await signer.getAddress()).toLowerCase();
    if (signerAddress !== expectedAddress) {
      throw new Error("Connected wallet account changed. Please reconnect and try again.");
    }
    return await signer.signMessage(utf8Message);
  };

  try {
    await requestAccountsWithFallback();
    return await signWithSigner();
  } catch (initialError) {
    // Re-establish WalletConnect session then retry signMessage once.
    if (rawProvider?.request) {
      const reconnectError = initialError as { message?: string };
      const lowerMessage = `${reconnectError?.message ?? ""}`.toLowerCase();
      if (isConnectBeforeRequestError(initialError) || lowerMessage.includes("missing or invalid request()")) {
        const activeProvider = activeEip1193Provider;
        if (activeProvider) {
          await ensureWalletConnectSession(activeProvider, chain);
          await requestAccountsWithFallback();
          return await signWithSigner();
        }
      }
    }
    throw initialError;
  }
}

function getRawProvider(provider: ethers.BrowserProvider): {
  request?: (args: unknown) => Promise<unknown>;
  session?: {
    namespaces?: Record<string, { chains?: string[] }>;
    requiredNamespaces?: Record<string, { chains?: string[] }>;
  };
} | null {
  const browserProviderLike = provider as unknown as { provider?: unknown };
  if (!browserProviderLike.provider || typeof browserProviderLike.provider !== "object") {
    return null;
  }
  return browserProviderLike.provider as {
    request?: (args: unknown) => Promise<unknown>;
    session?: {
      namespaces?: Record<string, { chains?: string[] }>;
      requiredNamespaces?: Record<string, { chains?: string[] }>;
    };
  };
}

function getWalletConnectChainCandidates(rawProvider: {
  session?: {
    namespaces?: Record<string, { chains?: string[] }>;
    requiredNamespaces?: Record<string, { chains?: string[] }>;
  };
} | null, targetChainHex: string): string[] {
  const candidates = new Set<string>();
  const decimalChainId = Number.parseInt(targetChainHex, 16);

  if (Number.isFinite(decimalChainId) && decimalChainId > 0) {
    candidates.add(`eip155:${decimalChainId}`);
    candidates.add(String(decimalChainId));
  }
  candidates.add(targetChainHex.toLowerCase());

  const eip155Chains =
    rawProvider?.session?.namespaces?.eip155?.chains ??
    rawProvider?.session?.requiredNamespaces?.eip155?.chains ??
    [];
  for (const chainEntry of eip155Chains) {
    if (typeof chainEntry !== "string") continue;
    candidates.add(chainEntry);
    const parsed = Number.parseInt(chainEntry.replace("eip155:", ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      candidates.add(`eip155:${parsed}`);
      candidates.add(String(parsed));
      candidates.add(`0x${parsed.toString(16)}`);
    }
  }

  return Array.from(candidates);
}

async function sendWalletRpcWithFallback(
  provider: ethers.BrowserProvider,
  method: string,
  params: unknown[],
  targetChainHex: string
): Promise<unknown> {
  try {
    return await provider.send(method, params);
  } catch (primaryError) {
    const rawProvider = getRawProvider(provider);
    if (!rawProvider?.request) {
      throw primaryError;
    }

    try {
      return await rawProvider.request({ method, params });
    } catch {
      // WalletConnect mobile providers may require universal-provider shape:
      // request({ chainId, request: { method, params } })
      const chainCandidates = getWalletConnectChainCandidates(rawProvider, targetChainHex);
      let lastError: unknown = primaryError;

      for (const chainId of chainCandidates) {
        try {
          return await rawProvider.request({
            chainId,
            request: { method, params }
          });
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    }
  }
}

/**
 * Switch to the correct network
 */
export async function switchNetwork(chain: Chain, providerOverride?: ethers.BrowserProvider): Promise<void> {
  const provider = providerOverride ?? getEthereumProvider();
  if (!provider) return;

  const config = CHAIN_CONFIGS[chain];
  if (!config) return;

  try {
    const currentChainId = await provider.send("eth_chainId", []);
    if (typeof currentChainId === "string" && currentChainId.toLowerCase() === config.chainId.toLowerCase()) {
      return;
    }
  } catch {
    // Continue with explicit switch attempts below.
  }

  const needsChainAdd = (error: unknown): boolean => {
    const err = error as
      | {
          code?: number;
          message?: string;
          error?: { code?: number; message?: string };
          info?: { error?: { code?: number; message?: string } };
        }
      | undefined;
    const directCode = err?.code;
    const nestedCode = err?.error?.code ?? err?.info?.error?.code;
    const directMessage = err?.message ?? "";
    const nestedMessage = err?.error?.message ?? err?.info?.error?.message ?? "";
    const allMessage = `${directMessage} ${nestedMessage}`.toLowerCase();
    return (
      directCode === 4902 ||
      nestedCode === 4902 ||
      allMessage.includes("unrecognized chain id") ||
      allMessage.includes("try adding the chain using wallet_addethereumchain")
    );
  };

  try {
    await sendWalletRpcWithFallback(provider, "wallet_switchEthereumChain", [{ chainId: config.chainId }], config.chainId);
  } catch (switchError) {
    if (!needsChainAdd(switchError)) {
      throw switchError;
    }

    try {
      await sendWalletRpcWithFallback(provider, "wallet_addEthereumChain", [
        {
          chainId: config.chainId,
          chainName: config.chainName,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: config.rpcUrls,
          blockExplorerUrls: config.blockExplorerUrls
        }
      ], config.chainId);
      // Some wallets require an explicit second switch after adding the chain.
      await sendWalletRpcWithFallback(provider, "wallet_switchEthereumChain", [{ chainId: config.chainId }], config.chainId);
    } catch {
      try {
        const currentChainId = await provider.send("eth_chainId", []);
        if (typeof currentChainId === "string" && currentChainId.toLowerCase() === config.chainId.toLowerCase()) {
          return;
        }
      } catch {
        // Ignore and throw the user-facing error below.
      }
      throw new Error(`Failed to add/switch to ${chain} network in wallet.`);
    }
  }
}

/**
 * Get USDT token contract
 */
export function getUSDTContract(chain: Chain, contractAddress?: string): ethers.Contract | null {
  const provider = getEthereumProvider();
  if (!provider) return null;

  const usdtAddress = resolveUSDTAddress(chain, contractAddress);
  return new ethers.Contract(usdtAddress, ERC20_ABI, provider);
}

/**
 * Get USDT balance
 */
export async function getUSDTBalance(chain: Chain, address: string): Promise<bigint> {
  if (chain === "solana") {
    return await getSolanaUSDTBalance(address);
  }
  
  if (chain === "tron") {
    throw new Error(`${chain} balance check not yet implemented`);
  }

  const contract = getUSDTContract(chain);
  if (!contract) {
    throw new Error("Failed to get USDT contract. EVM wallet provider is not connected.");
  }

  const provider = getEthereumProvider();
  if (!provider) throw new Error("No provider");

  const signer = await provider.getSigner();
  const contractWithSigner = contract.connect(signer) as unknown as {
    balanceOf: (account: string) => Promise<bigint>;
  };

  return await contractWithSigner.balanceOf(address);
}

/**
 * Read USDT balance directly from chain RPC (no wallet connection required).
 */
export async function getOnchainUSDTBalance(
  chain: Chain,
  walletAddress: string,
  usdtTokenAddress?: string
): Promise<{ rawBalance: bigint; decimals: number; formattedBalance: string }> {
  if (chain === "solana") {
    const rawBalance = await getSolanaUSDTBalance(walletAddress);
    const decimals = 6;
    return {
      rawBalance,
      decimals,
      formattedBalance: ethers.formatUnits(rawBalance, decimals)
    };
  }

  if (chain === "tron") {
    const { TronWeb } = await import("tronweb");
    const tronWeb = new TronWeb({
      fullHost: CHAIN_CONFIGS.tron.rpcUrls[0]
    });

    if (!tronWeb.isAddress(walletAddress)) {
      throw new Error("Invalid Tron wallet address");
    }

    const tokenAddress = resolveUSDTAddress("tron", usdtTokenAddress);

    const constantResult = await tronWeb.transactionBuilder.triggerConstantContract(
      tokenAddress,
      "balanceOf(address)",
      {},
      [{ type: "address", value: walletAddress }],
      walletAddress
    );

    if (!constantResult?.result?.result || !constantResult.constant_result?.[0]) {
      throw new Error("Failed to fetch Tron USDT balance");
    }

    const rawBalance = BigInt(`0x${constantResult.constant_result[0]}`);
    const decimals = 6;
    return {
      rawBalance,
      decimals,
      formattedBalance: ethers.formatUnits(rawBalance, decimals)
    };
  }

  // EVM (Ethereum, BSC)
  const tokenAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const provider = new ethers.JsonRpcProvider(CHAIN_CONFIGS[chain].rpcUrls[0]);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider) as unknown as {
    balanceOf: (account: string) => Promise<bigint>;
    decimals: () => Promise<number>;
  };

  const normalizedAddress = walletAddress.toLowerCase();
  const [rawBalance, decimals] = await Promise.all([
    contract.balanceOf(normalizedAddress),
    contract.decimals().catch(() => 6)
  ]);

  return {
    rawBalance,
    decimals,
    formattedBalance: ethers.formatUnits(rawBalance, decimals)
  };
}

/**
 * Transfer USDT directly from connected wallet.
 */
export async function transferUSDT(
  chain: Chain,
  toAddress: string,
  amountUsdt: string,
  usdtTokenAddress?: string
): Promise<string> {
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }

  if (chain === "tron") {
    if (typeof window === "undefined") {
      throw new Error("Tron wallet is not available");
    }

    const tronWeb = requireInjectedTronWeb();

    const usdtAddress = resolveUSDTAddress("tron", usdtTokenAddress);
    const amountInSun = Math.round(parsedAmount * 10 ** 6).toString();

    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      usdtAddress,
      "transfer(address,uint256)",
      {},
      [
        { type: "address", value: toAddress },
        { type: "uint256", value: amountInSun }
      ],
      tronWeb.defaultAddress.hex
    );

    if (!tx?.result?.result || !tx.transaction) {
      throw new Error("Failed to build Tron transfer transaction");
    }

    const signedTx = await tronWeb.trx.sign(tx.transaction);
    const broadcastTx = await tronWeb.trx.broadcast(signedTx);
    if (!broadcastTx?.result || !broadcastTx?.txid) {
      throw new Error(`Tron transfer failed: ${broadcastTx?.message || "Unknown error"}`);
    }

    return broadcastTx.txid;
  }

  if (chain === "solana") {
    return await transferSolanaUSDT(toAddress, amountUsdt);
  }

  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("EVM wallet is not connected. Connect wallet first.");
  }

  await switchNetwork(chain, provider);

  const signer = await provider.getSigner();
  const usdtAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const contract = new ethers.Contract(usdtAddress, ERC20_ABI, signer) as unknown as {
    decimals: () => Promise<number>;
    transfer: (to: string, value: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  const decimals = await contract.decimals();
  const normalizedAmount = ethers.parseUnits(parsedAmount.toString(), decimals);
  const tx = await contract.transfer(toAddress, normalizedAmount);
  await tx.wait();
  return tx.hash;
}

/**
 * Transfer USDT from a user wallet to destination using transferFrom.
 * Requires the connected wallet to be an approved spender for `fromAddress`.
 */
export async function transferUSDTFromUserWallet(
  chain: Chain,
  fromAddress: string,
  toAddress: string,
  amountUsdt: string,
  usdtTokenAddress?: string
): Promise<string> {
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }

  if (chain === "tron") {
    if (typeof window === "undefined") {
      throw new Error("Tron wallet is not available");
    }

    const tronWeb = requireInjectedTronWeb();

    const usdtAddress = resolveUSDTAddress("tron", usdtTokenAddress);
    const amountInSun = Math.round(parsedAmount * 10 ** 6).toString();

    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      usdtAddress,
      "transferFrom(address,address,uint256)",
      {},
      [
        { type: "address", value: fromAddress },
        { type: "address", value: toAddress },
        { type: "uint256", value: amountInSun }
      ],
      tronWeb.defaultAddress.hex
    );

    if (!tx?.result?.result || !tx.transaction) {
      throw new Error("Failed to build Tron transferFrom transaction");
    }

    const signedTx = await tronWeb.trx.sign(tx.transaction);
    const broadcastTx = await tronWeb.trx.broadcast(signedTx);
    if (!broadcastTx?.result || !broadcastTx?.txid) {
      throw new Error(`Tron transferFrom failed: ${broadcastTx?.message || "Unknown error"}`);
    }

    return broadcastTx.txid;
  }

  if (chain === "solana") {
    throw new Error("transferFrom flow is not supported for Solana.");
  }

  // EVM chains (Ethereum, BSC)
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("EVM wallet is not connected. Connect wallet first.");
  }

  await switchNetwork(chain, provider);

  const signer = await provider.getSigner();
  const usdtAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const contract = new ethers.Contract(usdtAddress, ERC20_ABI, signer) as unknown as {
    decimals: () => Promise<number>;
    transferFrom: (from: string, to: string, value: bigint) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
  };

  const decimals = await contract.decimals();
  const normalizedAmount = ethers.parseUnits(parsedAmount.toString(), decimals);
  const tx = await contract.transferFrom(fromAddress, toAddress, normalizedAmount);
  await tx.wait();
  return tx.hash;
}

/**
 * Approve USDT spending
 */
export async function approveUSDT(
  chain: Chain,
  spenderAddress: string,
  amount?: bigint,
  usdtTokenAddress?: string
): Promise<string> {
  // Handle Tron
  if (chain === "tron") {
    if (typeof window === "undefined") {
      throw new Error("Tron wallet is not available");
    }

    // Get USDT contract address for Tron (use provided address or fallback to default)
    const usdtAddress = resolveUSDTAddress("tron", usdtTokenAddress);
    
    // Convert amount: Tron uses sun (1 TRX = 1,000,000 sun), USDT has 6 decimals
    // If amount not specified, approve max (2^256 - 1 in hex = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    const approvalAmount = amount 
      ? amount.toString() 
      : "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // Max uint256

    try {
      return await sendTronSmartContractTransaction(
        usdtAddress,
        "approve(address,uint256)",
        [
          { type: "address", value: spenderAddress },
          { type: "uint256", value: approvalAmount },
        ],
        "Failed to build approve transaction",
        "Tron USDT approval failed"
      );
    } catch (error: any) {
      if (error?.code === "USER_CANCEL" || error?.message?.includes("User rejected")) {
        throw new Error("User rejected the transaction");
      }
      throw new Error(`Tron USDT approval failed: ${error?.message || String(error)}`);
    }
  }

  if (chain === "solana") {
    // Solana doesn't use approve - tokens are transferred directly in registerWallet
    // This function is kept for compatibility but does nothing for Solana
    console.log(`[approveUSDT] Solana doesn't require approval, skipping...`);
    return "solana-no-approve-needed";
  }

  const contract = getUSDTContract(chain);
  if (!contract) throw new Error("Failed to get USDT contract");

  const provider = getEthereumProvider();
  if (!provider) throw new Error("No provider");

  const signer = await provider.getSigner();
  const contractWithSigner = contract.connect(signer) as unknown as {
    approve: (spender: string, value: bigint) => Promise<{ wait: () => Promise<unknown>; hash: string }>;
  };

  // If amount not specified, approve max (2^256 - 1)
  const approvalAmount = amount || ethers.MaxUint256;

  const tx = await contractWithSigner.approve(spenderAddress, approvalAmount);
  await tx.wait();

  return tx.hash;
}

/**
 * Check USDT allowance
 */
export async function checkUSDTAllowance(
  chain: Chain,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  if (chain === "solana" || chain === "tron") {
    throw new Error(`${chain} allowance check not yet implemented`);
  }

  const contract = getUSDTContract(chain);
  if (!contract) throw new Error("Failed to get USDT contract");

  const allowanceReader = contract as unknown as {
    allowance: (owner: string, spender: string) => Promise<bigint>;
  };

  return await allowanceReader.allowance(ownerAddress, spenderAddress);
}

/**
 * Register wallet via smart contract
 */
export async function registerWalletViaContract(
  chain: Chain,
  contractAddress: string,
  connectedWalletAddress?: string
): Promise<string> {
  // Handle Tron
  if (chain === "tron") {
    if (typeof window === "undefined") {
      throw new Error("Tron wallet is not available");
    }

    try {
      return await sendTronSmartContractTransaction(
        contractAddress,
        "registerWallet()",
        [],
        "Failed to build registerWallet transaction",
        "Tron wallet registration failed"
      );
    } catch (error: any) {
      if (error?.code === "USER_CANCEL" || error?.message?.includes("User rejected")) {
        throw new Error("User rejected the transaction");
      }
      throw new Error(`Tron wallet registration failed: ${error?.message || String(error)}`);
    }
  }

  if (chain === "solana") {
    console.log(`[registerWalletViaContract] Starting Solana wallet registration`, { contractAddress });
    try {
      // Use already connected Solana wallet (Phantom/Solflare/etc.), no forced reconnect/deeplink.
      const injectedProvider = getPhantomProvider();
      const walletAddress =
        connectedWalletAddress?.trim() ||
        (injectedProvider?.publicKey ? injectedProvider.publicKey.toString() : "");
      if (!walletAddress) {
        throw new Error("No connected Solana wallet found. Connect Solflare/Phantom first.");
      }
      console.log(`[registerWalletViaContract] Solana wallet connected:`, walletAddress);
      
      console.log(`[registerWalletViaContract] Calling registerSolanaWallet...`);
      // Get contract config to pass USDT token address
      const { apiRequest } = await import('./api');
      let usdtTokenAddress: string | undefined;
      try {
        const contractConfig = await apiRequest<{ usdtTokenAddress?: string }>(`/web3/contract-config/solana`);
        usdtTokenAddress = contractConfig?.usdtTokenAddress;
        console.log(`[registerWalletViaContract] USDT token address from config:`, usdtTokenAddress);
      } catch (error) {
        console.warn(`[registerWalletViaContract] Failed to fetch contract config, using default:`, error);
      }
      const txHash = await registerSolanaWallet(
        walletAddress, 
        contractAddress,
        usdtTokenAddress
      );
      console.log(`[registerWalletViaContract] Solana registration successful, txHash:`, txHash);
      return txHash;
    } catch (error) {
      console.error(`[registerWalletViaContract] Solana registration error:`, error);
      console.error(`[registerWalletViaContract] Error details:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        contractAddress,
      });
      throw error;
    }
  }

  const provider = getEthereumProvider();
  if (!provider) throw new Error("No provider");

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, WALLET_REGISTRY_ABI, signer) as unknown as {
    registerWallet: () => Promise<{ wait: () => Promise<{ hash?: string } | null>; hash: string }>;
  };

  // Call registerWallet() function (no parameters)
  const tx = await contract.registerWallet();
  
  // Wait for transaction to be mined
  const receipt = await tx.wait();
  
  if (!receipt || !receipt.hash) {
    throw new Error("Transaction receipt not found");
  }

  return receipt.hash;
}

/**
 * Withdraw USDT from WalletRegistry contract (admin function)
 * This calls the withdrawUSDT function on the contract to withdraw from the contract's accumulated balance
 */
export async function withdrawUSDTFromContract(
  chain: Chain,
  contractAddress: string,
  toAddress: string,
  amountUsdt: string,
  usdtTokenAddress?: string
): Promise<string> {
  const parsedAmount = Number.parseFloat(amountUsdt);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Invalid USDT amount");
  }

  if (chain === "tron") {
    if (typeof window === "undefined") {
      throw new Error("Tron wallet is not available");
    }

    const tronWeb = requireInjectedTronWeb();

    const amountInSun = Math.round(parsedAmount * 10 ** 6).toString();

    // Call withdrawUSDT(address to, uint256 amount) on the contract
    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      contractAddress,
      "withdrawUSDT(address,uint256)",
      {},
      [
        { type: "address", value: toAddress },
        { type: "uint256", value: amountInSun }
      ],
      tronWeb.defaultAddress.hex
    );

    if (!tx?.result?.result || !tx.transaction) {
      throw new Error("Failed to build Tron withdrawal transaction");
    }

    const signedTx = await tronWeb.trx.sign(tx.transaction);
    const broadcastTx = await tronWeb.trx.broadcast(signedTx);
    if (!broadcastTx?.result || !broadcastTx?.txid) {
      throw new Error(`Tron withdrawal failed: ${broadcastTx?.message || "Unknown error"}`);
    }

    return broadcastTx.txid;
  }

  if (chain === "solana") {
    return await withdrawSolanaUSDTFromContract(contractAddress, toAddress, amountUsdt);
  }

  // EVM chains (Ethereum, BSC)
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("EVM wallet is not connected. Connect wallet first.");
  }

  await switchNetwork(chain, provider);

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, WALLET_REGISTRY_ABI, signer) as unknown as {
    withdrawUSDT: (to: string, amount: bigint) => Promise<{ wait: () => Promise<{ hash?: string } | null>; hash: string }>;
  };

  // Get USDT decimals to calculate the correct amount
  const usdtAddress = resolveUSDTAddress(chain, usdtTokenAddress);
  const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, signer) as unknown as {
    decimals: () => Promise<number>;
  };
  const decimals = await usdtContract.decimals();
  const normalizedAmount = ethers.parseUnits(parsedAmount.toString(), decimals);

  // Call withdrawUSDT(address to, uint256 amount)
  const tx = await contract.withdrawUSDT(toAddress, normalizedAmount);
  await tx.wait();

  if (!tx.hash) {
    throw new Error("Transaction hash not found");
  }

  return tx.hash;
}
