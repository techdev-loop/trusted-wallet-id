import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { identityDb, walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const [kycResult, walletResult, paymentResult, disclosureResult] = await Promise.all([
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
      link_status: string;
      linked_at: Date | null;
      unlinked_at: Date | null;
    }>(
      `
        SELECT id, wallet_address, link_status, linked_at, unlinked_at
        FROM wallet_links
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [req.user.sub]
    ),
    walletDb.query<{
      tx_hash: string;
      amount_usdt: string;
      paid_at: Date;
      wallet_address: string;
    }>(
      `
        SELECT p.tx_hash, p.amount_usdt::TEXT, p.paid_at, w.wallet_address
        FROM fee_payments p
        INNER JOIN wallet_links w ON p.wallet_link_id = w.id
        WHERE w.user_id = $1
        ORDER BY p.paid_at DESC
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

  res.status(StatusCodes.OK).json({
    identityVerificationStatus: kycResult.rows[0]?.verification_status ?? "not_started",
    linkedWallets: walletResult.rows.map((wallet) => ({
      id: wallet.id,
      walletAddress: wallet.wallet_address,
      status: wallet.link_status === "active" ? "Active" : "Unlinked",
      linkedAt: wallet.linked_at,
      unlinkedAt: wallet.unlinked_at
    })),
    paymentHistory: paymentResult.rows.map((payment) => ({
      txHash: payment.tx_hash,
      amountUsdt: Number(payment.amount_usdt),
      walletAddress: payment.wallet_address,
      paidAt: payment.paid_at
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
        AND link_status = 'active'
      RETURNING id
    `,
    [req.user.sub, normalizedAddress]
  );

  if (!updateResult.rows[0]) {
    throw new HttpError("Active wallet link not found", StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    walletAddress: normalizedAddress,
    status: "Unlinked"
  });
});

export { router as dashboardRoutes };
