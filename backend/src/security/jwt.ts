import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthTokenPayload } from "../types/auth.js";

/**
 * Signs a short-lived access JWT. Lifetime comes from `JWT_EXPIRY` (default `15m` when refresh tokens are enabled).
 * Refresh is handled via opaque tokens (`POST /auth/refresh`), not long-lived JWTs.
 */
export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
