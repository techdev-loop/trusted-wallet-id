import { Router } from "express";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { env } from "../config/env.js";
import { identityDb, walletDb } from "../db/pool.js";
import { capabilitiesFromDbRow } from "../lib/admin-capabilities.js";
import {
  generateOpaqueRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt
} from "../lib/refresh-token.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { signAccessToken } from "../security/jwt.js";
import { sendOtpEmail } from "../services/email.service.js";
import type { AppRole } from "../types/auth.js";
import type { AuthTokenPayload } from "../types/auth.js";

const signupSchema = z.object({
  email: z.string().email()
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/)
});

const adminPasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(500)
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(20).max(512)
});

const router = Router();

const BCRYPT_ROUNDS = 12;

interface UserSessionRow {
  id: string;
  email: string;
  role: AppRole;
  admin_capabilities: string[] | null;
}

function buildTokenPayload(user: UserSessionRow): AuthTokenPayload {
  const caps = capabilitiesFromDbRow(user.role, user.admin_capabilities);
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role
  };
  if (user.role === "admin" || user.role === "compliance") {
    payload.adminCaps = caps;
  }
  return payload;
}

function publicUserFromRow(user: UserSessionRow) {
  const caps = capabilitiesFromDbRow(user.role, user.admin_capabilities);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    ...(user.role === "admin" || user.role === "compliance" ? { adminCaps: caps } : {})
  };
}

async function persistIdentityRefresh(userId: string, rawRefreshToken: string): Promise<void> {
  await identityDb.query(
    `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1::uuid, $2, $3)
    `,
    [userId, hashRefreshToken(rawRefreshToken), refreshTokenExpiresAt()]
  );
}

/** Issues access JWT + opaque refresh token (identity / email users). */
async function issueIdentitySession(user: UserSessionRow) {
  const token = signAccessToken(buildTokenPayload(user));
  const refreshToken = generateOpaqueRefreshToken();
  await persistIdentityRefresh(user.id, refreshToken);
  return {
    token,
    refreshToken,
    user: publicUserFromRow(user)
  };
}

async function issueSessionForEmail(email: string) {
  const upsertedUser = await identityDb.query<UserSessionRow>(
    `
      INSERT INTO users (email)
      VALUES ($1)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, role, admin_capabilities
    `,
    [email]
  );

  const user = upsertedUser.rows[0];
  return issueIdentitySession(user);
}

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const email = parsed.data.email.toLowerCase();

  if (!env.OTP_REQUIRED) {
    const session = await issueSessionForEmail(email);
    res.status(StatusCodes.CREATED).json({
      message: "OTP skipped (disabled by environment setting)",
      email,
      otpRequired: false,
      ...session
    });
    return;
  }

  const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await identityDb.query(
    `
      INSERT INTO otp_challenges (email, otp_code, expires_at)
      VALUES ($1, $2, $3)
    `,
    [email, otpCode, expiresAt]
  );

  await sendOtpEmail(email, otpCode);

  const response: Record<string, unknown> = {
    message: "OTP sent successfully",
    email,
    otpRequired: true
  };

  if (env.NODE_ENV !== "production" && env.EMAIL_PROVIDER === "none") {
    response.otpCode = otpCode;
  }

  res.status(StatusCodes.CREATED).json(response);
});

router.post("/verify-otp", async (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!env.OTP_REQUIRED) {
    throw new HttpError("OTP verification is disabled in this environment", StatusCodes.BAD_REQUEST);
  }

  const email = parsed.data.email.toLowerCase();
  const otpResult = await identityDb.query<{
    id: string;
    otp_code: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `
      SELECT id, otp_code, expires_at, consumed_at
      FROM otp_challenges
      WHERE email = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [email]
  );

  const otpRow = otpResult.rows[0];
  if (!otpRow) {
    throw new HttpError("OTP challenge not found", StatusCodes.NOT_FOUND);
  }

  if (otpRow.consumed_at) {
    throw new HttpError("OTP already used", StatusCodes.BAD_REQUEST);
  }

  if (otpRow.expires_at.getTime() < Date.now()) {
    throw new HttpError("OTP expired", StatusCodes.BAD_REQUEST);
  }

  const isDevBypass = env.OTP_BYPASS_CODE != null && parsed.data.otpCode === env.OTP_BYPASS_CODE;
  if (!isDevBypass && otpRow.otp_code !== parsed.data.otpCode) {
    throw new HttpError("Invalid OTP", StatusCodes.BAD_REQUEST);
  }

  await identityDb.query(`UPDATE otp_challenges SET consumed_at = NOW() WHERE id = $1`, [otpRow.id]);

  const session = await issueSessionForEmail(email);

  res.status(StatusCodes.OK).json({
    ...session
  });
});

router.post("/admin/login-password", async (req, res) => {
  const parsed = adminPasswordLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const email = parsed.data.email.toLowerCase();

  const userResult = await identityDb.query<UserSessionRow & { admin_password_hash: string | null }>(
    `
      SELECT id, email, role, admin_capabilities, admin_password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new HttpError("Invalid email or password", StatusCodes.UNAUTHORIZED);
  }

  if (user.role !== "admin" && user.role !== "compliance") {
    throw new HttpError("Invalid email or password", StatusCodes.UNAUTHORIZED);
  }

  if (!user.admin_password_hash) {
    throw new HttpError(
      "Password sign-in is not enabled for this account. Sign in with email OTP or ask a super admin to set a password.",
      StatusCodes.FORBIDDEN
    );
  }

  const ok = await bcrypt.compare(parsed.data.password, user.admin_password_hash);
  if (!ok) {
    throw new HttpError("Invalid email or password", StatusCodes.UNAUTHORIZED);
  }

  const caps = capabilitiesFromDbRow(user.role, user.admin_capabilities);
  if (caps.length === 0) {
    throw new HttpError("Forbidden: no admin capabilities assigned", StatusCodes.FORBIDDEN);
  }

  const { admin_password_hash: _h, ...sessionUser } = user;
  const session = await issueIdentitySession(sessionUser);
  res.status(StatusCodes.OK).json(session);
});

/**
 * Rotate refresh token + issue new access JWT. Accepts a single opaque refresh token (identity or web3 wallet user).
 */
router.post("/refresh", async (req, res) => {
  const parsed = refreshBodySchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const hash = hashRefreshToken(parsed.data.refreshToken);

  const identityDel = await identityDb.query<{ user_id: string }>(
    `
      DELETE FROM refresh_tokens
      WHERE token_hash = $1
        AND expires_at > NOW()
      RETURNING user_id
    `,
    [hash]
  );

  if (identityDel.rows[0]) {
    const userRow = await identityDb.query<UserSessionRow>(
      `
        SELECT id, email, role, admin_capabilities
        FROM users
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [identityDel.rows[0].user_id]
    );
    const user = userRow.rows[0];
    if (!user) {
      throw new HttpError("User not found", StatusCodes.NOT_FOUND);
    }
    const session = await issueIdentitySession(user);
    res.status(StatusCodes.OK).json(session);
    return;
  }

  const walletDel = await walletDb.query<{
    wallet_user_id: string;
    wallet_address: string;
    chain: string;
  }>(
    `
      DELETE FROM web3_refresh_tokens rt
      USING wallet_users w
      WHERE rt.token_hash = $1
        AND rt.expires_at > NOW()
        AND w.id = rt.wallet_user_id
      RETURNING rt.wallet_user_id, w.wallet_address, w.chain
    `,
    [hash]
  );

  const w = walletDel.rows[0];
  if (!w) {
    throw new HttpError("Invalid or expired refresh token", StatusCodes.UNAUTHORIZED);
  }

  const refreshToken = generateOpaqueRefreshToken();
  await walletDb.query(
    `
      INSERT INTO web3_refresh_tokens (wallet_user_id, token_hash, expires_at)
      VALUES ($1::uuid, $2, $3)
    `,
    [w.wallet_user_id, hashRefreshToken(refreshToken), refreshTokenExpiresAt()]
  );

  const token = signAccessToken({
    sub: w.wallet_user_id,
    email: `${w.wallet_address}@wallet.${w.chain}`,
    role: "user"
  });

  res.status(StatusCodes.OK).json({
    token,
    refreshToken,
    verified: true,
    walletAddress: w.wallet_address,
    chain: w.chain,
    user: {
      id: w.wallet_user_id,
      walletAddress: w.wallet_address,
      chain: w.chain,
      role: "user" as const
    }
  });
});

/** Revokes all refresh tokens for the current principal (identity user id or wallet_users id). */
router.post("/logout", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  const sub = req.user.sub;
  await identityDb.query(`DELETE FROM refresh_tokens WHERE user_id = $1::uuid`, [sub]);
  await walletDb.query(`DELETE FROM web3_refresh_tokens WHERE wallet_user_id = $1::uuid`, [sub]);
  res.status(StatusCodes.OK).json({ status: "signed_out" });
});

export { router as authRoutes };
