import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { StatusCodes } from "http-status-codes";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.ALLOWED_ORIGIN
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/api/health", (_req, res) => {
  res.status(StatusCodes.OK).json({
    service: "fiulink-backend",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
