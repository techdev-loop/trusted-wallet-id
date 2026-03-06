import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { HttpError } from "../lib/http-error.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/confirm", requireAuth, async (_req, _res) => {
  throw new HttpError("Wallet fee payments are disabled", StatusCodes.GONE);
});

export { router as paymentRoutes };
