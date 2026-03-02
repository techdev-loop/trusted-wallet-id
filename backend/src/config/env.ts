import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  ALLOWED_ORIGIN: z.string().min(1).default("*"),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().min(1).default("1h"),
  AES_256_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "AES_256_KEY must be 64 hex characters"),
  IDENTITY_DATABASE_URL: z.string().url(),
  WALLET_DATABASE_URL: z.string().url()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
