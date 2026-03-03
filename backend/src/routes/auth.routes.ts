import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { env } from "../config/env.js";
import { identityDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { signAccessToken } from "../security/jwt.js";
import { sendOtpEmail } from "../services/email.service.js";
import type { AppRole } from "../types/auth.js";

const signupSchema = z.object({
  email: z.string().email()
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/)
});

const router = Router();

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const otpCode = `${Math.floor(100000 + Math.random() * 900000)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await identityDb.query(
    `
      INSERT INTO otp_challenges (email, otp_code, expires_at)
      VALUES ($1, $2, $3)
    `,
    [parsed.data.email.toLowerCase(), otpCode, expiresAt]
  );

  await sendOtpEmail(parsed.data.email.toLowerCase(), otpCode);

  const response: Record<string, unknown> = {
    message: "OTP sent successfully",
    email: parsed.data.email.toLowerCase()
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

  const upsertedUser = await identityDb.query<{ id: string; email: string; role: AppRole }>(
    `
      INSERT INTO users (email)
      VALUES ($1)
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, role
    `,
    [email]
  );

  const user = upsertedUser.rows[0];
  const token = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  res.status(StatusCodes.OK).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
});

export { router as authRoutes };
