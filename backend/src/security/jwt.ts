import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthTokenPayload } from "../types/auth.js";

/**
 * Signs a short-lived access JWT. Lifetime comes from `JWT_EXPIRY` (default `1h`), in line with
 * common OAuth/OIDC access-token norms (~15m–1h; many providers use about one hour). There is no
 * refresh-token flow in this codebase—shorter values increase security but force more frequent sign-in.
 */
export function signAccessToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRY as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}
