import { ethers } from "ethers";
import { walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { StatusCodes } from "http-status-codes";

export type Chain = "ethereum" | "bsc" | "tron" | "solana";

export interface ContractConfig {
  chain: Chain;
  contractAddress: string;
  usdtTokenAddress: string;
  networkName: string;
  rpcUrl: string;
  isActive: boolean;
}

export interface TransactionVerification {
  walletAddress: string;
  chain: Chain;
  txHash: string;
  amount: number;
  blockNumber?: number;
  blockHash?: string;
}

const WALLET_REGISTRY_ABI = ["function isWalletVerified(address wallet) view returns (bool)"];

/**
 * Get contract configuration for a chain
 */
export async function getContractConfig(chain: Chain): Promise<ContractConfig | null> {
  const result = await walletDb.query<ContractConfig>(
    `
      SELECT chain, contract_address as "contractAddress", 
             usdt_token_address as "usdtTokenAddress",
             network_name as "networkName", rpc_url as "rpcUrl", is_active as "isActive"
      FROM contract_configs
      WHERE chain = $1 AND is_active = TRUE
      LIMIT 1
    `,
    [chain]
  );

  return result.rows[0] || null;
}

/**
 * Verify Ethereum/BSC transaction on-chain
 */
export async function verifyEVMTransaction(
  chain: Chain,
  txHash: string,
  expectedAmount: number
): Promise<TransactionVerification> {
  const config = await getContractConfig(chain);
  if (!config) {
    throw new HttpError(`Contract configuration not found for chain: ${chain}`, StatusCodes.BAD_REQUEST);
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    throw new HttpError("Transaction not found on blockchain", StatusCodes.NOT_FOUND);
  }

  if (receipt.status !== 1) {
    throw new HttpError("Transaction failed on blockchain", StatusCodes.BAD_REQUEST);
  }

  // Parse logs to find USDT transfer
  const usdtInterface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 value)"
  ]);

  let transferFound = false;
  let fromAddress = "";
  let transferAmount = BigInt(0);

  for (const log of receipt.logs) {
    try {
      const parsed = usdtInterface.parseLog({
        topics: log.topics as string[],
        data: log.data
      });

      if (parsed && parsed.name === "Transfer") {
        // Check if transfer is to contract address
        if (parsed.args.to.toLowerCase() === config.contractAddress.toLowerCase()) {
          fromAddress = parsed.args.from.toLowerCase();
          transferAmount = parsed.args.value;
          transferFound = true;
          break;
        }
      }
    } catch {
      // Not a USDT transfer log, continue
    }
  }

  if (!transferFound) {
    throw new HttpError("USDT transfer to contract not found in transaction", StatusCodes.BAD_REQUEST);
  }

  // Convert amount (USDT has 6 decimals)
  const expectedAmountWei = BigInt(expectedAmount * 10 ** 6);
  if (transferAmount !== expectedAmountWei) {
    throw new HttpError(
      `Amount mismatch. Expected ${expectedAmount} USDT, got ${Number(transferAmount) / 10 ** 6}`,
      StatusCodes.BAD_REQUEST
    );
  }

  return {
    walletAddress: fromAddress,
    chain,
    txHash: txHash.toLowerCase(),
    amount: expectedAmount,
    blockNumber: Number(receipt.blockNumber),
    blockHash: receipt.blockHash
  };
}

/**
 * Verify Solana transaction
 */
export async function verifySolanaTransaction(
  txHash: string,
  expectedAmount: number
): Promise<TransactionVerification> {
  // Solana verification would use @solana/web3.js
  // This is a placeholder - full implementation would require Solana RPC
  throw new HttpError("Solana verification not yet implemented", StatusCodes.NOT_IMPLEMENTED);
}

/**
 * Verify Tron transaction
 */
export async function verifyTronTransaction(
  txHash: string,
  expectedAmount: number
): Promise<TransactionVerification> {
  // Tron verification would use TronWeb
  // This is a placeholder - full implementation would require Tron RPC
  throw new HttpError("Tron verification not yet implemented", StatusCodes.NOT_IMPLEMENTED);
}

/**
 * Register wallet payment from smart contract
 */
export async function registerWalletPayment(verification: TransactionVerification): Promise<void> {
  const { walletAddress, chain, txHash, amount, blockNumber, blockHash } = verification;

  // Get or create wallet user
  const walletUserResult = await walletDb.query<{ id: string }>(
    `
      INSERT INTO wallet_users (wallet_address, chain, is_verified, verified_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (wallet_address, chain) 
      DO UPDATE SET is_verified = TRUE, verified_at = NOW()
      RETURNING id
    `,
    [walletAddress.toLowerCase(), chain]
  );

  const walletUserId = walletUserResult.rows[0].id;

  // Get contract config for contract address
  const config = await getContractConfig(chain);
  if (!config) {
    throw new HttpError(`Contract configuration not found for chain: ${chain}`, StatusCodes.BAD_REQUEST);
  }

  // Create wallet link if it doesn't exist
  const walletLinkResult = await walletDb.query<{ id: string }>(
    `
      INSERT INTO wallet_links (user_id, wallet_address, message_nonce, link_status, chain, contract_address, registration_method, linked_at)
      VALUES ($1, $2, '', 'active', $3, $4, 'smart_contract', NOW())
      ON CONFLICT (wallet_address)
      DO UPDATE SET 
        link_status = 'active',
        chain = EXCLUDED.chain,
        contract_address = EXCLUDED.contract_address,
        registration_method = 'smart_contract',
        linked_at = NOW(),
        unlinked_at = NULL
      RETURNING id
    `,
    [walletUserId, walletAddress.toLowerCase(), chain, config.contractAddress]
  );

  const walletLinkId = walletLinkResult.rows[0].id;

  // Record payment
  await walletDb.query(
    `
      INSERT INTO fee_payments (wallet_link_id, amount_usdt, tx_hash, chain, contract_address, block_number, block_hash, paid_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (tx_hash) DO NOTHING
    `,
    [walletLinkId, amount, txHash.toLowerCase(), chain, config.contractAddress, blockNumber, blockHash]
  );
}

/**
 * Check if wallet is verified
 */
export async function isWalletVerified(walletAddress: string, chain: Chain): Promise<boolean> {
  const normalizedAddress = walletAddress.toLowerCase();
  const config = await getContractConfig(chain);
  if (!config) {
    return false;
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const contract = new ethers.Contract(config.contractAddress, WALLET_REGISTRY_ABI, provider);
    const verified = await contract.isWalletVerified(normalizedAddress);
    return Boolean(verified);
  } catch {
    return false;
  }
}
