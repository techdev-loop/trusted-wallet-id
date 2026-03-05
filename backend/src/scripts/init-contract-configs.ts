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
      contractAddress: process.env.TRON_CONTRACT_ADDRESS || "",
      usdtTokenAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      networkName: process.env.TRON_NETWORK || "mainnet",
      rpcUrl: process.env.TRON_RPC_URL || "https://api.trongrid.io",
      isActive: true
    },
    {
      chain: "solana",
      contractAddress: process.env.SOLANA_CONTRACT_ADDRESS || "",
      usdtTokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      networkName: process.env.SOLANA_NETWORK || "mainnet-beta",
      rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      isActive: true
    }
  ];

  for (const config of configs) {
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
