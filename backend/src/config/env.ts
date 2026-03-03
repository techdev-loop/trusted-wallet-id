import "dotenv/config";
import { z } from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return value;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGIN: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z.string().min(1).optional(),
  KYC_PROVIDER: z.enum(["none", "didit"]).default("none"),
  DIDIT_API_KEY: z.string().min(1).optional(),
  DIDIT_BASE_URL: z.string().url().default("https://verification.didit.me"),
  DIDIT_WEBHOOK_SECRET: z.string().min(1).optional(),
  DIDIT_FLOW_ID: z.string().min(1).optional(),
  DIDIT_WEBHOOK_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  DIDIT_CALLBACK_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  KYC_SANDBOX_MODE: booleanFromEnv.optional().default(false),
  KYC_SANDBOX_AUTO_APPROVE: booleanFromEnv.optional().default(false),
  EMAIL_PROVIDER: z.enum(["none", "resend"]).default("none"),
  RESEND_API_KEY: z.string().min(1).optional(),
  OTP_EMAIL_FROM: z.string().email().default("onboarding@resend.dev"),
  OTP_EMAIL_REPLY_TO: z.string().email().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().min(1).default("1h"),
  AES_256_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "AES_256_KEY must be 64 hex characters"),
  IDENTITY_DATABASE_URL: z.string().url(),
  WALLET_DATABASE_URL: z.string().url(),
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(1825)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;

export function getAllowedOrigins(): string[] {
  const rawOrigins = env.ALLOWED_ORIGINS ?? env.ALLOWED_ORIGIN ?? "*";
  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
