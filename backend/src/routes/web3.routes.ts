import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
  verifyEVMTransaction,
  verifySolanaTransaction,
  verifyTronTransaction,
  registerWalletPayment,
  isWalletVerified,
  getContractConfig,
  type Chain
} from "../services/blockchain.service.js";
import { HttpError } from "../lib/http-error.js";
import { signAccessToken } from "../security/jwt.js";
import { walletDb } from "../db/pool.js";

const router = Router();

const verifyPaymentSchema = z.object({
  chain: z.enum(["ethereum", "bsc", "tron", "solana"]),
  txHash: z.string().min(20),
  walletAddress: z.string().min(16)
});

const connectWalletSchema = z.object({
  walletAddress: z.string().min(16),
  chain: z.enum(["ethereum", "bsc", "tron", "solana"]),
  signature: z.string().optional() // Optional for wallet-first flow
});

/**
 * POST /api/web3/connect
 * Connect wallet and create/get user session
 */
router.post("/connect", async (req, res) => {
  const parsed = connectWalletSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const { walletAddress, chain, signature } = parsed.data;
  const normalizedAddress = walletAddress.toLowerCase();

  // Check if wallet is already verified
  const verified = await isWalletVerified(normalizedAddress, chain as Chain);
  
  if (!verified) {
    // Wallet not verified yet - user needs to pay
    res.status(StatusCodes.OK).json({
      verified: false,
      message: "Wallet not verified. Please pay 10 USDT to verify.",
      walletAddress: normalizedAddress,
      chain
    });
    return;
  }

  // Get or create wallet user
  const walletUserResult = await walletDb.query<{ id: string }>(
    `
      INSERT INTO wallet_users (wallet_address, chain, is_verified, verified_at)
      VALUES ($1, $2, TRUE, NOW())
      ON CONFLICT (wallet_address, chain) 
      DO UPDATE SET is_verified = TRUE
      RETURNING id
    `,
    [normalizedAddress, chain]
  );

  const userId = walletUserResult.rows[0].id;

  // Generate JWT token for wallet-based auth
  const token = signAccessToken({
    sub: userId,
    email: `${normalizedAddress}@wallet.${chain}`, // Pseudo-email for wallet users
    role: "user"
  });

  res.status(StatusCodes.OK).json({
    verified: true,
    token,
    walletAddress: normalizedAddress,
    chain,
    user: {
      id: userId,
      walletAddress: normalizedAddress,
      chain
    }
  });
});

/**
 * POST /api/web3/verify-payment
 * Verify payment transaction and register wallet
 */
router.post("/verify-payment", async (req, res) => {
  const parsed = verifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const { chain, txHash, walletAddress } = parsed.data;
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    let verification;

    // Verify transaction based on chain
    switch (chain) {
      case "ethereum":
      case "bsc":
        verification = await verifyEVMTransaction(chain as Chain, txHash, 10);
        break;
      case "solana":
        verification = await verifySolanaTransaction(txHash, 10);
        break;
      case "tron":
        verification = await verifyTronTransaction(txHash, 10);
        break;
      default:
        throw new HttpError(`Unsupported chain: ${chain}`, StatusCodes.BAD_REQUEST);
    }

    // Verify wallet address matches
    if (verification.walletAddress.toLowerCase() !== normalizedAddress) {
      throw new HttpError("Wallet address mismatch in transaction", StatusCodes.BAD_REQUEST);
    }

    // Register the payment
    await registerWalletPayment(verification);

    // Generate JWT token
    const walletUserResult = await walletDb.query<{ id: string }>(
      `
        SELECT id FROM wallet_users
        WHERE wallet_address = $1 AND chain = $2
        LIMIT 1
      `,
      [normalizedAddress, chain]
    );

    const userId = walletUserResult.rows[0]?.id;
    if (!userId) {
      throw new HttpError("Failed to create wallet user", StatusCodes.INTERNAL_SERVER_ERROR);
    }

    const token = signAccessToken({
      sub: userId,
      email: `${normalizedAddress}@wallet.${chain}`,
      role: "user"
    });

    res.status(StatusCodes.OK).json({
      success: true,
      verified: true,
      token,
      walletAddress: normalizedAddress,
      chain,
      txHash: txHash.toLowerCase(),
      message: "Wallet verified and registered successfully"
    });
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(
      `Failed to verify payment: ${error instanceof Error ? error.message : "Unknown error"}`,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * GET /api/web3/status/:walletAddress/:chain
 * Check wallet verification status
 */
router.get("/status/:walletAddress/:chain", async (req, res) => {
  const { walletAddress, chain } = req.params;

  if (!["ethereum", "bsc", "tron", "solana"].includes(chain)) {
    throw new HttpError("Invalid chain", StatusCodes.BAD_REQUEST);
  }

  const verified = await isWalletVerified(walletAddress.toLowerCase(), chain as Chain);

  res.status(StatusCodes.OK).json({
    walletAddress: walletAddress.toLowerCase(),
    chain,
    verified
  });
});

/**
 * GET /api/web3/contract-config/:chain
 * Get contract configuration for a chain
 */
router.get("/contract-config/:chain", async (req, res) => {
  const { chain } = req.params;

  if (!["ethereum", "bsc", "tron", "solana"].includes(chain)) {
    throw new HttpError("Invalid chain", StatusCodes.BAD_REQUEST);
  }

  const config = await getContractConfig(chain as Chain);
  if (!config) {
    throw new HttpError(`Contract configuration not found for chain: ${chain}`, StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    chain: config.chain,
    contractAddress: config.contractAddress,
    usdtTokenAddress: config.usdtTokenAddress,
    networkName: config.networkName
  });
});

export { router as web3Routes };
