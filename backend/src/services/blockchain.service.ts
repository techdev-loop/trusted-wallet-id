import { ethers } from "ethers";
import { TronWeb } from "tronweb";
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
  const config = await getContractConfig("tron");
  if (!config) {
    throw new HttpError("Contract configuration not found for chain: tron", StatusCodes.BAD_REQUEST);
  }

  // Initialize TronWeb
  const tronWeb = new TronWeb({
    fullHost: config.rpcUrl
  });

  try {
    // Get transaction info
    const tx = await tronWeb.trx.getTransaction(txHash);
    if (!tx) {
      throw new HttpError("Transaction not found on blockchain", StatusCodes.NOT_FOUND);
    }

    // Check if transaction is confirmed
    const txInfo = await tronWeb.trx.getTransactionInfo(txHash);
    if (!txInfo || txInfo.receipt?.result !== "SUCCESS") {
      throw new HttpError("Transaction failed on blockchain", StatusCodes.BAD_REQUEST);
    }

    // Get block info for block number and hash
    const block = await tronWeb.trx.getBlockByNumber(txInfo.blockNumber);
    const blockHash = block?.blockID || "";

    // Parse transaction to find USDT transfer to contract
    // When registerWallet() is called, it triggers a TRC20 transfer from user to contract
    // This appears as an internal transaction in Tron
    let transferFound = false;
    let fromAddress = "";
    let transferAmount = BigInt(0);

    // Check if transaction is calling our contract
    const contractAddressHex = tx.contract_address;
    if (!contractAddressHex) {
      throw new HttpError("Transaction is not a contract call", StatusCodes.BAD_REQUEST);
    }

    const contractAddressBase58 = tronWeb.address.fromHex(contractAddressHex);
    if (contractAddressBase58 !== config.contractAddress) {
      throw new HttpError(
        `Transaction contract address mismatch. Expected ${config.contractAddress}, got ${contractAddressBase58}`,
        StatusCodes.BAD_REQUEST
      );
    }

    // Check internal transactions for TRC20 USDT transfer
    if (txInfo.internal_transactions && txInfo.internal_transactions.length > 0) {
      for (const internalTxRaw of txInfo.internal_transactions) {
        const internalTx = internalTxRaw as unknown as {
          to?: string;
          from?: string;
          amount?: string | number;
          token_info?: { symbol?: string; address?: string };
        };
        // Check if this is a TRC20 token transfer to our contract
        if (
          internalTx.to === config.contractAddress &&
          internalTx.token_info &&
          (internalTx.token_info.symbol === "USDT" || internalTx.token_info.address === config.usdtTokenAddress)
        ) {
          fromAddress = internalTx.from || "";
          // Amount is in sun (smallest unit, 6 decimals for USDT)
          transferAmount = BigInt(internalTx.amount || 0);
          transferFound = true;
          break;
        }
      }
    }

    // If not found in internal transactions, check event logs
    if (!transferFound && txInfo.log && txInfo.log.length > 0) {
      // TRC20 Transfer event signature hash (first 32 bytes)
      const TRANSFER_EVENT_SIGNATURE = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
      
      for (const log of txInfo.log) {
        try {
          // Check if this log is from the USDT token contract
          const logAddress = tronWeb.address.fromHex(log.address);
          if (logAddress !== config.usdtTokenAddress) {
            continue;
          }

          // Check if this is a Transfer event
          if (log.topics && log.topics.length >= 3) {
            const eventSignature = log.topics[0];
            if (eventSignature && eventSignature.toLowerCase().startsWith(TRANSFER_EVENT_SIGNATURE.toLowerCase())) {
              // topics[1] = from address (padded to 32 bytes)
              // topics[2] = to address (padded to 32 bytes)
              // data = amount (uint256)
              
              const fromAddressHex = log.topics[1].slice(-40); // Last 20 bytes (40 hex chars)
              const toAddressHex = log.topics[2].slice(-40);
              const amountHex = log.data;

              // Convert hex addresses to base58
              const toAddress = tronWeb.address.fromHex("41" + toAddressHex); // Add prefix
              const fromAddressBase58 = tronWeb.address.fromHex("41" + fromAddressHex);

              // Check if transfer is to contract address
              if (toAddress === config.contractAddress) {
                // Parse amount (big-endian uint256, remove 0x prefix if present)
                const cleanAmountHex = amountHex.startsWith("0x") ? amountHex.slice(2) : amountHex;
                transferAmount = BigInt("0x" + cleanAmountHex);
                fromAddress = fromAddressBase58;
                transferFound = true;
                break;
              }
            }
          }
        } catch (error) {
          // Not a Transfer event or parsing failed, continue
          continue;
        }
      }
    }

    if (!transferFound) {
      throw new HttpError("USDT transfer to contract not found in transaction", StatusCodes.BAD_REQUEST);
    }

    // Convert amount (USDT on Tron has 6 decimals)
    const expectedAmountSun = BigInt(expectedAmount * 10 ** 6);
    if (transferAmount !== expectedAmountSun) {
      throw new HttpError(
        `Amount mismatch. Expected ${expectedAmount} USDT, got ${Number(transferAmount) / 10 ** 6}`,
        StatusCodes.BAD_REQUEST
      );
    }

    return {
      walletAddress: fromAddress, // Keep Tron address in base58 format (case-sensitive)
      chain: "tron",
      txHash: txHash.toLowerCase(), // Tron tx hashes are hex, can be lowercased
      amount: expectedAmount,
      blockNumber: txInfo.blockNumber,
      blockHash: blockHash
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(
      `Failed to verify Tron transaction: ${error instanceof Error ? error.message : "Unknown error"}`,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Register wallet payment from smart contract
 */
export async function registerWalletPayment(verification: TransactionVerification): Promise<void> {
  const { walletAddress, chain, txHash, amount, blockNumber, blockHash } = verification;

  // Normalize address: Tron addresses are base58 (case-sensitive), EVM addresses are hex (lowercase)
  const normalizedAddress = chain === "tron" ? walletAddress : walletAddress.toLowerCase();

  // Get or create wallet user
  const walletUserResult = await walletDb.query<{ id: string }>(
    `
      INSERT INTO wallet_users (wallet_address, chain, is_verified, verified_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (wallet_address, chain) 
      DO UPDATE SET is_verified = TRUE, verified_at = NOW()
      RETURNING id
    `,
    [normalizedAddress, chain]
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
    [walletUserId, normalizedAddress, chain, config.contractAddress]
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
  const config = await getContractConfig(chain);
  if (!config) {
    return false;
  }

  try {
    if (chain === "tron") {
      // Tron uses TronWeb and base58 addresses (case-sensitive)
      const tronWeb = new TronWeb({
        fullHost: config.rpcUrl
      });

      // Validate Tron address format
      if (!tronWeb.isAddress(walletAddress)) {
        return false;
      }

      // Convert base58 address to hex (with 41 prefix for Tron)
      const addressHex = tronWeb.address.toHex(walletAddress);
      
      // Call isWalletVerified(address) on the contract
      // Note: Tron contract expects the address in hex format (with 41 prefix)
      const contract = await tronWeb.contract().at(config.contractAddress);
      
      // Try calling the contract method
      try {
        const result = await contract.isWalletVerified(addressHex).call();
        return Boolean(result);
      } catch (contractError) {
        // If contract call fails, log and return false
        // This might happen if the contract method doesn't exist or RPC is unavailable
        console.error(`Tron contract call failed for ${walletAddress}:`, contractError);
        return false;
      }
    } else if (chain === "solana") {
      // Solana uses @solana/web3.js
      const { Connection, PublicKey } = await import('@solana/web3.js');
      const { Program, AnchorProvider } = await import("@coral-xyz/anchor");
      
      // Solana program IDL (minimal for isWalletVerified)
      const programIdl = {
        version: "0.1.0",
        name: "wallet_registry",
        instructions: [{
          name: "isWalletVerified",
          discriminator: [71, 205, 152, 64, 83, 250, 31, 161],
          accounts: [
            { name: "registry" },
            { name: "wallet" }
          ],
          args: [],
          returns: "bool"
        }]
      };
      
      const connection = new Connection(config.rpcUrl, 'confirmed');
      const programId = new PublicKey(config.contractAddress);
      const registryPubkey = new PublicKey(config.contractAddress); // Assuming registry address is same as program or provided separately
      const walletPubkey = new PublicKey(walletAddress);
      
      // Create a read-only provider for view calls
      const provider = new AnchorProvider(
        connection,
        { publicKey: PublicKey.default } as any,
        { commitment: "confirmed" }
      );
      
      const program = new (Program as any)(programIdl as any, programId, provider);
      
      try {
        const result = await program.methods
          .isWalletVerified()
          .accounts({
            registry: registryPubkey,
            wallet: walletPubkey,
          })
          .view();
        
        return Boolean(result);
      } catch (error) {
        console.error(`Solana contract call failed for ${walletAddress}:`, error);
        return false;
      }
    } else {
      // EVM chains (Ethereum, BSC)
      const normalizedAddress = walletAddress.toLowerCase();
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(config.contractAddress, WALLET_REGISTRY_ABI, provider);
      const verified = await contract.isWalletVerified(normalizedAddress);
      return Boolean(verified);
    }
  } catch {
    return false;
  }
}
