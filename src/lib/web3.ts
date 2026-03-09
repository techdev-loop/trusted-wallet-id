import { ethers } from "ethers";

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

// Chain configurations for MetaMask
// Note: For testnets, the frontend will use the network from backend config
export const CHAIN_CONFIGS: Record<Chain, ChainConfig> = {
  ethereum: {
    // Default to Sepolia testnet (0xaa36a7 = 11155111)
    // Mainnet would be 0x1
    chainId: "0xaa36a7", // Sepolia testnet
    chainName: "Sepolia Testnet",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"]
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
    rpcUrls: ["https://api.mainnet-beta.solana.com"],
    blockExplorerUrls: ["https://explorer.solana.com"]
  }
};

// USDT token addresses per chain
// Note: For testnets, these should be testnet token addresses
export const USDT_ADDRESSES: Record<Chain, string> = {
  ethereum: "0xFD311848AE9dD8ffaC8bCd862bC14D38aA77F946", // Sepolia testnet
  bsc: "0x55d398326f99059fF775485246999027B3197955",
  tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  solana: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" // USDT on Solana
};

// Sepolia testnet USDT (mock/test token)
export const SEPOLIA_USDT_ADDRESS = "0xFD311848AE9dD8ffaC8bCd862bC14D38aA77F946";

// ERC20 ABI for USDT
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

// Wallet Registry ABI
export const WALLET_REGISTRY_ABI = [
  "function registerWallet() external",
  "function isWalletVerified(address wallet) external view returns (bool)",
  "function REGISTRATION_FEE() external view returns (uint256)",
  "event WalletRegistered(address indexed wallet, uint256 amount, uint256 timestamp)"
];

function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const ethereum = (window as Window & { ethereum?: Eip1193Provider }).ethereum;
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
    optionalChains: [11155111, 56, 1],
    rpcMap: {
      11155111: CHAIN_CONFIGS.ethereum.rpcUrls[0],
      56: CHAIN_CONFIGS.bsc.rpcUrls[0],
      1: "https://ethereum-rpc.publicnode.com"
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
        optionalChains: [11155111, 56, 1]
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
    throw new Error("TronLink is not available");
  }

  const win = window as any;
  if (!win.tronWeb && !win.tronLink) {
    throw new Error("TronLink extension not detected. Please install TronLink from https://www.tronlink.org/");
  }

  const tronWeb = win.tronWeb || win.tronLink.tronWeb;
  if (!tronWeb || !tronWeb.ready) {
    throw new Error("TronLink is not ready. Please unlock your TronLink wallet.");
  }

  const address = tronWeb.defaultAddress?.base58;
  if (!address) {
    throw new Error("No Tron address found. Please ensure your TronLink wallet is unlocked and has an account.");
  }

  return address; // Tron addresses are base58, case-sensitive
}

// Helper to connect Phantom
async function connectPhantom(): Promise<string> {
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
    const response = await provider.connect();
    return response.publicKey.toString();
  } catch (error) {
    if ((error as any)?.code === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw normalizeWalletError(error);
  }
}

export async function connectWallet(
  chain: Chain,
  method: WalletConnectionMethod = "auto"
): Promise<string> {
  // Handle Tron with TronLink
  if (chain === "tron") {
    if (method === "injected" || method === "auto") {
      try {
        return await connectTronLink();
      } catch (error) {
        if (method === "injected") {
          throw error;
        }
        // Fall through to WalletConnect for auto mode
      }
    }
    if (method === "walletconnect" || method === "auto") {
      const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
      walletConnectProvider = provider;
      return await connectWithProvider(provider, chain);
    }
    throw new Error("Tron wallet connection method not supported");
  }

  // Handle Solana with Phantom
  if (chain === "solana") {
    if (method === "injected" || method === "auto") {
      try {
        return await connectPhantom();
      } catch (error) {
        if (method === "injected") {
          throw error;
        }
        // Fall through to WalletConnect for auto mode
      }
    }
    if (method === "walletconnect" || method === "auto") {
      const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
      walletConnectProvider = provider;
      return await connectWithProvider(provider, chain);
    }
    throw new Error("Solana wallet connection method not supported");
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
  if (!win.tronWeb && !win.tronLink) {
    throw new Error("TronLink extension not detected. Please install TronLink from https://www.tronlink.org/");
  }

  const tronWeb = win.tronWeb || win.tronLink.tronWeb;
  if (!tronWeb || !tronWeb.ready) {
    throw new Error("TronLink is not ready. Please unlock your TronLink wallet.");
  }

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
    // Convert to hex for consistency (or keep as base58)
    const signatureHex = Buffer.from(signedMessage.signature).toString("hex");
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

  const usdtAddress = contractAddress || USDT_ADDRESSES[chain];
  return new ethers.Contract(usdtAddress, ERC20_ABI, provider);
}

/**
 * Get USDT balance
 */
export async function getUSDTBalance(chain: Chain, address: string): Promise<bigint> {
  if (chain === "solana" || chain === "tron") {
    throw new Error(`${chain} balance check not yet implemented`);
  }

  const contract = getUSDTContract(chain);
  if (!contract) throw new Error("Failed to get USDT contract");

  const provider = getEthereumProvider();
  if (!provider) throw new Error("No provider");

  const signer = await provider.getSigner();
  const contractWithSigner = contract.connect(signer) as unknown as {
    balanceOf: (account: string) => Promise<bigint>;
  };

  return await contractWithSigner.balanceOf(address);
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
      throw new Error("TronLink is not available");
    }

    const win = window as any;
    if (!win.tronWeb && !win.tronLink) {
      throw new Error("TronLink extension not detected. Please install TronLink from https://www.tronlink.org/");
    }

    const tronWeb = win.tronWeb || win.tronLink.tronWeb;
    if (!tronWeb || !tronWeb.ready) {
      throw new Error("TronLink is not ready. Please unlock your TronLink wallet.");
    }

    // Get USDT contract address for Tron (use provided address or fallback to default)
    const usdtAddress = usdtTokenAddress || USDT_ADDRESSES.tron;
    
    // Convert amount: Tron uses sun (1 TRX = 1,000,000 sun), USDT has 6 decimals
    // If amount not specified, approve max (2^256 - 1 in hex = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    const approvalAmount = amount 
      ? amount.toString() 
      : "115792089237316195423570985008687907853269984665640564039457584007913129639935"; // Max uint256

    try {
      // Call TRC20 approve function
      const tx = await tronWeb.transactionBuilder.triggerSmartContract(
        usdtAddress,
        "approve(address,uint256)",
        {},
        [
          { type: "address", value: spenderAddress },
          { type: "uint256", value: approvalAmount }
        ],
        tronWeb.defaultAddress.hex
      );

      if (!tx.result || !tx.result.result) {
        throw new Error("Failed to build approve transaction");
      }

      // Sign and broadcast transaction
      const signedTx = await tronWeb.trx.sign(tx.transaction);
      const broadcastTx = await tronWeb.trx.broadcast(signedTx);

      if (!broadcastTx.result) {
        throw new Error(`Transaction failed: ${broadcastTx.message || "Unknown error"}`);
      }

      return broadcastTx.txid;
    } catch (error: any) {
      if (error?.code === "USER_CANCEL" || error?.message?.includes("User rejected")) {
        throw new Error("User rejected the transaction");
      }
      throw new Error(`Tron USDT approval failed: ${error?.message || String(error)}`);
    }
  }

  if (chain === "solana") {
    throw new Error("solana approval not yet implemented");
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
  contractAddress: string
): Promise<string> {
  // Handle Tron
  if (chain === "tron") {
    if (typeof window === "undefined") {
      throw new Error("TronLink is not available");
    }

    const win = window as any;
    if (!win.tronWeb && !win.tronLink) {
      throw new Error("TronLink extension not detected. Please install TronLink from https://www.tronlink.org/");
    }

    const tronWeb = win.tronWeb || win.tronLink.tronWeb;
    if (!tronWeb || !tronWeb.ready) {
      throw new Error("TronLink is not ready. Please unlock your TronLink wallet.");
    }

    try {
      // Call registerWallet() function (no parameters)
      const tx = await tronWeb.transactionBuilder.triggerSmartContract(
        contractAddress,
        "registerWallet()",
        {},
        [],
        tronWeb.defaultAddress.hex
      );

      if (!tx.result || !tx.result.result) {
        throw new Error("Failed to build registerWallet transaction");
      }

      // Sign and broadcast transaction
      const signedTx = await tronWeb.trx.sign(tx.transaction);
      const broadcastTx = await tronWeb.trx.broadcast(signedTx);

      if (!broadcastTx.result) {
        throw new Error(`Transaction failed: ${broadcastTx.message || "Unknown error"}`);
      }

      return broadcastTx.txid;
    } catch (error: any) {
      if (error?.code === "USER_CANCEL" || error?.message?.includes("User rejected")) {
        throw new Error("User rejected the transaction");
      }
      throw new Error(`Tron wallet registration failed: ${error?.message || String(error)}`);
    }
  }

  if (chain === "solana") {
    throw new Error("solana registration not yet implemented");
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
