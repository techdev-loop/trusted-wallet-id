import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { StatusCodes } from "http-status-codes";
import { env, getAllowedOrigins } from "./config/env.js";
import { identityDb, walletDb } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { kycRoutes } from "./routes/kyc.routes.js";
import { legalRoutes } from "./routes/legal.routes.js";
import { paymentRoutes } from "./routes/payment.routes.js";
import { walletRoutes } from "./routes/wallet.routes.js";

const app = express();
const allowedOrigins = getAllowedOrigins();

app.use(helmet());
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes("*")) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }

      if (
        env.NODE_ENV === "development" &&
        /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(requestOrigin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${requestOrigin}`));
    }
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/api/health", async (_req, res) => {
  let identityDbStatus = "ok";
  let walletDbStatus = "ok";

  try {
    await identityDb.query("SELECT 1");
  } catch {
    identityDbStatus = "error";
  }

  try {
    await walletDb.query("SELECT 1");
  } catch {
    walletDbStatus = "error";
  }

  const overallStatus = identityDbStatus === "ok" && walletDbStatus === "ok" ? "ok" : "degraded";

  res.status(overallStatus === "ok" ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    service: "fiulink-backend",
    status: overallStatus,
    dependencies: {
      identityDb: identityDbStatus,
      walletDb: walletDbStatus
    },
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
