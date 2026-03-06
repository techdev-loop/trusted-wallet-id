import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { identityDb, walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { isWalletVerified } from "../services/blockchain.service.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const [kycResult, walletResult, disclosureResult] = await Promise.all([
    identityDb.query<{ verification_status: string }>(
      `
        SELECT verification_status
        FROM kyc_profiles
        WHERE user_id = $1
        LIMIT 1
      `,
      [req.user.sub]
    ),
    walletDb.query<{
      id: string;
      wallet_address: string;
      chain: string | null;
      link_status: string;
      linked_at: Date | null;
      unlinked_at: Date | null;
    }>(
      `
        SELECT id, wallet_address, chain, link_status, linked_at, unlinked_at
        FROM wallet_links
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.user.sub]
    ),
    walletDb.query<{
      id: string;
      wallet_address: string;
      lawful_request_reference: string;
      approved_by_user: boolean;
      created_at: Date;
    }>(
      `
        SELECT id, wallet_address, lawful_request_reference, approved_by_user, created_at
        FROM disclosure_logs
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.user.sub]
    )
  ]);

  const walletsWithOnchainStatus = await Promise.all(
    walletResult.rows.map(async (wallet) => {
      const chain = wallet.chain === "bsc" || wallet.chain === "tron" || wallet.chain === "solana" ? wallet.chain : "ethereum";
      const onchainVerified = await isWalletVerified(wallet.wallet_address, chain);
      return {
        ...wallet,
        onchainVerified
      };
    })
  );

  res.status(StatusCodes.OK).json({
    identityVerificationStatus: kycResult.rows[0]?.verification_status ?? "not_started",
    linkedWallets: walletsWithOnchainStatus.map((wallet) => ({
      id: wallet.id,
      walletAddress: wallet.wallet_address,
      status:
        wallet.onchainVerified
          ? "Active"
          : wallet.link_status === "pending_verification" || wallet.link_status === "pending_signature"
            ? "Pending Verification"
            : "Unlinked",
      linkedAt: wallet.linked_at,
      unlinkedAt: wallet.unlinked_at
    })),
    disclosureHistory: disclosureResult.rows.map((disclosure) => ({
      id: disclosure.id,
      walletAddress: disclosure.wallet_address,
      lawfulRequestReference: disclosure.lawful_request_reference,
      approvedByUser: disclosure.approved_by_user,
      createdAt: disclosure.created_at
    }))
  });
});

router.post("/wallets/:walletAddress/unlink", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const walletAddressParam = req.params.walletAddress;
  if (typeof walletAddressParam !== "string") {
    throw new HttpError("Invalid wallet address parameter", StatusCodes.BAD_REQUEST);
  }
  const normalizedAddress = walletAddressParam.toLowerCase();
  const updateResult = await walletDb.query<{ id: string }>(
    `
      UPDATE wallet_links
      SET link_status = 'unlinked',
          unlinked_at = NOW()
      WHERE user_id = $1
        AND wallet_address = $2
        AND link_status IN ('active', 'pending_verification', 'pending_signature')
      RETURNING id
    `,
    [req.user.sub, normalizedAddress]
  );

  if (!updateResult.rows[0]) {
    throw new HttpError("Wallet link not found", StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    walletAddress: normalizedAddress,
    status: "Unlinked"
  });
});

export { router as dashboardRoutes };
