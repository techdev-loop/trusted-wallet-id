import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import {
  isWalletVerified,
  getContractConfig,
  type Chain
} from "../services/blockchain.service.js";
import { HttpError } from "../lib/http-error.js";
import { signAccessToken } from "../security/jwt.js";
import { walletDb } from "../db/pool.js";

const router = Router();

const connectWalletSchema = z.object({
  walletAddress: z.string().min(16),
  chain: z.enum(["ethereum", "bsc", "tron", "solana"])
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

  const { walletAddress, chain } = parsed.data;
  // Normalize address: Tron addresses are base58 (case-sensitive), EVM addresses are hex (lowercase)
  const normalizedAddress = chain === "tron" ? walletAddress : walletAddress.toLowerCase();

  // Get or create wallet user (no payment required)
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
 * Deprecated endpoint retained for backward compatibility
 */
router.post("/verify-payment", async (req, res) => {
  void req;
  void res;
  throw new HttpError("Wallet fee payments are disabled", StatusCodes.GONE);
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

  // Normalize address: Tron addresses are base58 (case-sensitive), EVM addresses are hex (lowercase)
  const normalizedAddress = chain === "tron" ? walletAddress : walletAddress.toLowerCase();
  const verified = await isWalletVerified(normalizedAddress, chain as Chain);

  res.status(StatusCodes.OK).json({
    walletAddress: normalizedAddress,
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
