import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../lib/http-error.js";
import { verifyAccessToken } from "../security/jwt.js";
import type { AuthenticatedRequestUser, AppRole } from "../types/auth.js";

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedRequestUser;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const token = authHeader.replace("Bearer ", "").trim();
  req.user = verifyAccessToken(token);
  next();
}

/** Sets `req.user` when a valid Bearer token is present; otherwise continues without auth. */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.replace("Bearer ", "").trim();
  try {
    req.user = verifyAccessToken(token);
  } catch {
    /* invalid or expired token — treat as anonymous */
  }
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
    }

    if (!roles.includes(req.user.role)) {
      throw new HttpError("Forbidden", StatusCodes.FORBIDDEN);
    }

    next();
  };
}
