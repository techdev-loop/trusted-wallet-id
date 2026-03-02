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

  const fallbackMessage = error instanceof Error ? error.message : "Internal server error";
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: fallbackMessage
  });
}
