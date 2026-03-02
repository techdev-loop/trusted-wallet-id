import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../lib/http-error.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    error: "Not Found"
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error && typeof error === "object") {
    const maybePgError = error as { code?: string; message?: string };
    if (maybePgError.code === "28P01") {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        error:
          "Database authentication failed. Check IDENTITY_DATABASE_URL and WALLET_DATABASE_URL credentials."
      });
      return;
    }

    if (maybePgError.code === "3D000") {
      res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
        error: "Database does not exist. Create databases and run `npm run db:init` in backend."
      });
      return;
    }
  }

  if (error instanceof Error && error.message.includes("ECONNREFUSED")) {
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      error: "Database connection refused. Ensure PostgreSQL is running and connection URLs are correct."
    });
    return;
  }

  const fallbackMessage = error instanceof Error ? error.message : "Internal server error";
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: fallbackMessage
  });
}
