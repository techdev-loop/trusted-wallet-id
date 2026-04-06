import { Router } from "express";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { env } from "../config/env.js";
import { identityDb } from "../db/pool.js";
import { capabilitiesFromDbRow } from "../lib/admin-capabilities.js";
import { HttpError } from "../lib/http-error.js";
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

function sessionResponseFromUser(user: UserSessionRow) {
  const token = signAccessToken(buildTokenPayload(user));
  const caps = capabilitiesFromDbRow(user.role, user.admin_capabilities);
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      ...(user.role === "admin" || user.role === "compliance" ? { adminCaps: caps } : {})
    }
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
  return sessionResponseFromUser(user);
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
  res.status(StatusCodes.OK).json(sessionResponseFromUser(sessionUser));
});

export { router as authRoutes };
