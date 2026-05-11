import { createHmac, randomBytes } from "crypto";
import { env } from "../config/env.js";

const DURATION_UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000
};

/** Parses values like `30d`, `7d`, `12h`, `15m` into milliseconds. */
export function parseDurationToMs(input: string): number {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration string: ${input}`);
  }
  const n = Number(match[1]);
  const unit = match[2] as keyof typeof DURATION_UNIT_MS;
  const mult = DURATION_UNIT_MS[unit];
  if (mult == null || !Number.isFinite(n)) {
    throw new Error(`Invalid duration string: ${input}`);
  }
  return n * mult;
}

export function refreshTokenExpiresAt(): Date {
  const ms = parseDurationToMs(env.REFRESH_TOKEN_EXPIRES_IN);
  return new Date(Date.now() + ms);
}

const refreshPepper = (): string => env.REFRESH_TOKEN_PEPPER ?? env.JWT_SECRET;

export function hashRefreshToken(rawToken: string): string {
  return createHmac("sha256", refreshPepper()).update(rawToken).digest("hex");
}

export function generateOpaqueRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}
