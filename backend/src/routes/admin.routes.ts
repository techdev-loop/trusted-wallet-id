import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { identityDb, walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth.js";
import { decryptText } from "../security/encryption.js";
import { logAdminAudit } from "../services/audit.service.js";

const createDisclosureSchema = z.object({
  userId: z.string().uuid(),
  walletAddress: z.string().min(16),
  lawfulRequestReference: z.string().min(4)
});

const approveDisclosureSchema = z.object({
  approvedByUser: z.boolean().default(false)
});

const paidWalletsQuerySchema = z.object({
  chain: z.enum(["ethereum", "bsc", "tron"]).default("ethereum")
});

const router = Router();

router.use(requireAuth);
router.use(requireRole("admin", "compliance"));

router.get("/users/by-wallet/:walletAddress", async (req: AuthenticatedRequest, res) => {
  const walletAddressParam = req.params.walletAddress;
  if (typeof walletAddressParam !== "string") {
    throw new HttpError("Invalid wallet address parameter", StatusCodes.BAD_REQUEST);
  }
  const normalizedAddress = walletAddressParam.toLowerCase();

  const walletResult = await walletDb.query<{
    user_id: string;
    wallet_address: string;
    link_status: string;
  }>(
    `
      SELECT user_id, wallet_address, link_status
      FROM wallet_links
      WHERE wallet_address = $1
      LIMIT 1
    `,
    [normalizedAddress]
  );

  const walletLink = walletResult.rows[0];
  if (!walletLink) {
    throw new HttpError("Wallet not found", StatusCodes.NOT_FOUND);
  }

  const userResult = await identityDb.query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE id = $1 LIMIT 1`,
    [walletLink.user_id]
  );

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_WALLET_SEARCH",
    targetUserId: walletLink.user_id,
    metadata: { walletAddress: normalizedAddress }
  });

  res.status(StatusCodes.OK).json({
    userId: walletLink.user_id,
    email: userResult.rows[0]?.email ?? null,
    walletAddress: walletLink.wallet_address,
    walletStatus: walletLink.link_status
  });
});

router.get("/identity/:userId", requireRole("compliance"), async (req: AuthenticatedRequest, res) => {
  const userId = req.params.userId;
  if (typeof userId !== "string") {
    throw new HttpError("Invalid user ID parameter", StatusCodes.BAD_REQUEST);
  }

  const kycResult = await identityDb.query<{
    encrypted_identity_json: string;
    verification_status: string;
  }>(
    `
      SELECT encrypted_identity_json, verification_status
      FROM kyc_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  const kycProfile = kycResult.rows[0];
  if (!kycProfile) {
    throw new HttpError("KYC profile not found", StatusCodes.NOT_FOUND);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_VIEW_IDENTITY_DATA",
    targetUserId: userId
  });

  res.status(StatusCodes.OK).json({
    userId,
    verificationStatus: kycProfile.verification_status,
    identityData: JSON.parse(decryptText(kycProfile.encrypted_identity_json))
  });
});

router.post("/disclosures", async (req: AuthenticatedRequest, res) => {
  const parsed = createDisclosureSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const inserted = await walletDb.query<{ id: string }>(
    `
      INSERT INTO disclosure_requests (
        user_id,
        wallet_address,
        lawful_request_reference,
        created_by_admin_user_id
      ) VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [
      parsed.data.userId,
      parsed.data.walletAddress.toLowerCase(),
      parsed.data.lawfulRequestReference,
      req.user.sub
    ]
  );

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_CREATE_DISCLOSURE_REQUEST",
    targetUserId: parsed.data.userId,
    metadata: {
      disclosureRequestId: inserted.rows[0].id,
      lawfulRequestReference: parsed.data.lawfulRequestReference
    }
  });

  res.status(StatusCodes.CREATED).json({
    disclosureRequestId: inserted.rows[0].id,
    status: "pending"
  });
});

router.post("/disclosures/:disclosureRequestId/approve", async (req: AuthenticatedRequest, res) => {
  const parsed = approveDisclosureSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const requestResult = await walletDb.query<{
    id: string;
    user_id: string;
    wallet_address: string;
    lawful_request_reference: string;
    status: string;
  }>(
    `
      SELECT id, user_id, wallet_address, lawful_request_reference, status
      FROM disclosure_requests
      WHERE id = $1
      LIMIT 1
    `,
    [req.params.disclosureRequestId]
  );

  const disclosureRequest = requestResult.rows[0];
  if (!disclosureRequest) {
    throw new HttpError("Disclosure request not found", StatusCodes.NOT_FOUND);
  }

  if (disclosureRequest.status !== "pending") {
    throw new HttpError("Disclosure request already processed", StatusCodes.BAD_REQUEST);
  }

  await walletDb.query(
    `
      UPDATE disclosure_requests
      SET status = 'approved',
          approved_by_user = $2,
          approved_at = NOW()
      WHERE id = $1
    `,
    [disclosureRequest.id, parsed.data.approvedByUser]
  );

  const disclosureLog = await walletDb.query<{ id: string }>(
    `
      INSERT INTO disclosure_logs (
        user_id,
        wallet_address,
        lawful_request_reference,
        approved_by_user,
        created_by_admin_user_id,
        approved_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `,
    [
      disclosureRequest.user_id,
      disclosureRequest.wallet_address,
      disclosureRequest.lawful_request_reference,
      parsed.data.approvedByUser,
      req.user.sub
    ]
  );

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_APPROVE_DISCLOSURE_REQUEST",
    targetUserId: disclosureRequest.user_id,
    metadata: {
      disclosureRequestId: disclosureRequest.id,
      disclosureLogId: disclosureLog.rows[0].id
    }
  });

  res.status(StatusCodes.OK).json({
    disclosureRequestId: disclosureRequest.id,
    disclosureLogId: disclosureLog.rows[0].id,
    status: "approved"
  });
});

router.get("/audit-logs", async (req: AuthenticatedRequest, res) => {
  const limit = Number(req.query.limit ?? 50);
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

  const result = await walletDb.query<{
    id: string;
    actor_user_id: string;
    actor_role: string;
    action: string;
    target_user_id: string | null;
    metadata_json: Record<string, unknown>;
    created_at: Date;
  }>(
    `
      SELECT id, actor_user_id, actor_role, action, target_user_id, metadata_json, created_at
      FROM admin_audit_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [safeLimit]
  );

  res.status(StatusCodes.OK).json({
    entries: result.rows
  });
});

router.get("/paid-wallets", async (req: AuthenticatedRequest, res) => {
  const parsed = paidWalletsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const chain = parsed.data.chain;
  const paymentsResult = await walletDb.query<{
    user_id: string;
    wallet_address: string;
    payment_count: number | null;
    total_paid_usdt: string | null;
    last_paid_at: Date | null;
  }>(
    `
      SELECT
        wl.user_id,
        wl.wallet_address,
        COUNT(fp.id)::int AS payment_count,
        COALESCE(SUM(fp.amount_usdt), 0)::text AS total_paid_usdt,
        MAX(fp.paid_at) AS last_paid_at
      FROM wallet_links wl
      LEFT JOIN fee_payments fp
        ON fp.wallet_link_id = wl.id
      WHERE wl.chain = $1
        AND wl.link_status = 'active'
      GROUP BY wl.user_id, wl.wallet_address
      ORDER BY wl.wallet_address ASC
      LIMIT 500
    `,
    [chain]
  );

  const wallets = paymentsResult.rows.map((row) => ({
    userId: row.user_id,
    walletAddress: row.wallet_address,
    paymentCount: row.payment_count ?? 0,
    totalPaidUsdt: Number(row.total_paid_usdt ?? "0"),
    lastPaidAt: row.last_paid_at,
    usdtBalance: null,
    balanceFetchError: null
  }));

  res.status(StatusCodes.OK).json({
    chain,
    entries: wallets
  });
});

export { router as adminRoutes };
