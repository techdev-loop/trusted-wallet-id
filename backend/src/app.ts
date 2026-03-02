import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { StatusCodes } from "http-status-codes";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { kycRoutes } from "./routes/kyc.routes.js";
import { legalRoutes } from "./routes/legal.routes.js";
import { paymentRoutes } from "./routes/payment.routes.js";
import { walletRoutes } from "./routes/wallet.routes.js";

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

app.use("/api/auth", authRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/legal", legalRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
