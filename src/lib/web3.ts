import { ethers } from "ethers";

export type Chain = "ethereum" | "bsc" | "tron" | "solana";

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

/**
 * Get Ethereum provider (MetaMask, etc.)
 */
export function getEthereumProvider(): ethers.BrowserProvider | null {
  if (typeof window === "undefined") return null;
  const ethereum = (window as Window & { ethereum?: ethers.Eip1193Provider }).ethereum;
  if (!ethereum) return null;
  return new ethers.BrowserProvider(ethereum);
}

/**
 * Connect to wallet and get address
 */
export async function connectWallet(chain: Chain): Promise<string> {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("No Ethereum wallet detected. Please install MetaMask.");
  }

  // Request account access
  await provider.send("eth_requestAccounts", []);

  // Get signer
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  // Switch to correct network if needed
  if (chain === "ethereum" || chain === "bsc") {
    await switchNetwork(chain);
  }

  return address.toLowerCase();
}

/**
 * Switch to the correct network
 */
export async function switchNetwork(chain: Chain): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) return;

  const config = CHAIN_CONFIGS[chain];
  if (!config) return;

  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: config.chainId }]);
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await provider.send("wallet_addEthereumChain", [
          {
            chainId: config.chainId,
            chainName: config.chainName,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: config.rpcUrls,
            blockExplorerUrls: config.blockExplorerUrls
          }
        ]);
      } catch (addError) {
        throw new Error(`Failed to add ${chain} network to wallet`);
      }
    } else {
      throw switchError;
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
  const contractWithSigner = contract.connect(signer);

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
  const contractWithSigner = contract.connect(signer);

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

  return await contract.allowance(ownerAddress, spenderAddress);
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
  const contract = new ethers.Contract(contractAddress, WALLET_REGISTRY_ABI, signer);

  // Call registerWallet() function (no parameters)
  const tx = await contract.registerWallet();
  
  // Wait for transaction to be mined
  const receipt = await tx.wait();
  
  if (!receipt || !receipt.hash) {
    throw new Error("Transaction receipt not found");
  }

  return receipt.hash;
}
