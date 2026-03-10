import "dotenv/config";
import { walletDb } from "../db/pool.js";

/**
 * Initialize contract configurations for all supported chains
 * Run this after deploying smart contracts
 */
async function initContractConfigs() {
  const configs = [
    {
      chain: "ethereum",
      contractAddress: process.env.ETHEREUM_CONTRACT_ADDRESS || "",
      usdtTokenAddress: process.env.ETHEREUM_NETWORK === "sepolia" 
        ? (process.env.SEPOLIA_USDT_ADDRESS || "0xfd311848ae9dd8ffac8bcd862bc14d38aa77f946")
        : "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      networkName: process.env.ETHEREUM_NETWORK || "mainnet",
      rpcUrl: process.env.ETHEREUM_RPC_URL || process.env.SEPOLIA_RPC_URL || "https://eth.llamarpc.com",
      isActive: true
    },
    {
      chain: "bsc",
      contractAddress: process.env.BSC_CONTRACT_ADDRESS || "",
      usdtTokenAddress: "0x55d398326f99059fF775485246999027B3197955",
      networkName: process.env.BSC_NETWORK || "mainnet",
      rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
      isActive: true
    },
    {
      chain: "tron",
      contractAddress: process.env.TRON_CONTRACT_ADDRESS || (process.env.TRON_NETWORK === "shasta" 
        ? "TMCiUULbCGB2JLBcAxhU15Re8DrSqrCgoF" // Default Shasta testnet contract address
        : ""),
      usdtTokenAddress: process.env.TRON_NETWORK === "shasta"
        ? (process.env.SHASTA_USDT_ADDRESS || "TXYZopYRdj2D9XRtbG411XZZ3kM5VkA00B") // Shasta testnet USDT (example - update with actual)
        : "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // Mainnet USDT
      networkName: process.env.TRON_NETWORK || "shasta",
      rpcUrl: process.env.TRON_RPC_URL || (process.env.TRON_NETWORK === "shasta" 
        ? "https://api.shasta.trongrid.io"
        : "https://api.trongrid.io"),
      isActive: true
    },
    {
      chain: "solana",
      contractAddress: process.env.SOLANA_CONTRACT_ADDRESS || (process.env.SOLANA_NETWORK === "devnet"
        ? "DwrJcymdTGdiuHK9boV8MPtDmUqMTwzfyvDB8hePMNG4" // Default devnet registry account address
        : ""),
      usdtTokenAddress: process.env.SOLANA_NETWORK === "devnet"
        ? (process.env.SOLANA_DEVNET_USDT_ADDRESS || "Ch9MipiMpaZBkCZFPTsArZigDwEH85Yodp2RcPjSmsvr") // Devnet USDT
        : "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // Mainnet USDT
      networkName: process.env.SOLANA_NETWORK || "devnet",
      rpcUrl: process.env.SOLANA_RPC_URL || (process.env.SOLANA_NETWORK === "devnet"
        ? "https://api.devnet.solana.com"
        : "https://api.mainnet-beta.solana.com"),
      isActive: true
    }
  ];

  for (const config of configs) {
      // For Solana, use the registry account address as default if not set
      if (config.chain === "solana" && !config.contractAddress) {
        config.contractAddress = "DwrJcymdTGdiuHK9boV8MPtDmUqMTwzfyvDB8hePMNG4";
        console.log(`Using default Solana devnet registry account: ${config.contractAddress}`);
      }
    
    if (!config.contractAddress) {
      console.warn(`Skipping ${config.chain} - contract address not set`);
      continue;
    }

    await walletDb.query(
      `
        INSERT INTO contract_configs (chain, contract_address, usdt_token_address, network_name, rpc_url, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (chain)
        DO UPDATE SET
          contract_address = EXCLUDED.contract_address,
          usdt_token_address = EXCLUDED.usdt_token_address,
          network_name = EXCLUDED.network_name,
          rpc_url = EXCLUDED.rpc_url,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `,
      [
        config.chain,
        config.contractAddress,
        config.usdtTokenAddress,
        config.networkName,
        config.rpcUrl,
        config.isActive
      ]
    );

    console.log(`✓ Configured ${config.chain} contract`);
  }

  console.log("Contract configurations initialized successfully!");
  process.exit(0);
}

initContractConfigs().catch((error) => {
  console.error("Failed to initialize contract configs:", error);
  process.exit(1);
});
