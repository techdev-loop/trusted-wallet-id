import { StatusCodes } from "http-status-codes";

export class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = StatusCodes.BAD_REQUEST) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}
