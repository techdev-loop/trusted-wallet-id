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
    methods: [
      "eth_requestAccounts",
      "eth_accounts",
      "eth_sendTransaction",
      "personal_sign",
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain"
    ]
  })) as { enable: () => Promise<unknown> };

  await provider.enable();
  return provider as unknown as Eip1193Provider;
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

  await browserProvider.send("eth_requestAccounts", []);
  const signer = await browserProvider.getSigner();
  const address = await signer.getAddress();

  if (chain === "ethereum" || chain === "bsc") {
    await switchNetwork(chain, browserProvider);
  }

  return address.toLowerCase();
}

/**
 * Connect to wallet and get address
 */
export async function connectWallet(
  chain: Chain,
  method: WalletConnectionMethod = "auto"
): Promise<string> {
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
    const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
    walletConnectProvider = provider;
    return await connectWithProvider(provider, chain);
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
      const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
      walletConnectProvider = provider;
      return await connectWithProvider(provider, chain);
    }

    // If injected wallets are present but all failed, show that explicit error.
    throw normalizeWalletError(lastInjectedError);
  }

  const provider = walletConnectProvider ?? (await createWalletConnectProvider(chain));
  walletConnectProvider = provider;
  return await connectWithProvider(provider, chain);
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
  amount?: bigint
): Promise<string> {
  if (chain === "solana" || chain === "tron") {
    throw new Error(`${chain} approval not yet implemented`);
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
  if (chain === "solana" || chain === "tron") {
    throw new Error(`${chain} registration not yet implemented`);
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
