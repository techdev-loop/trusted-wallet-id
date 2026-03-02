import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";

const router = Router();

router.get("/notices", (_req, res) => {
  res.status(StatusCodes.OK).json({
    disclaimer:
      "FIUlink is an independent private platform and is not affiliated with any government authority.",
    kycConsentRequirement:
      "Explicit user consent is required before KYC verification and wallet identity linkage.",
    dataRetentionPolicy: {
      retentionDays: env.DATA_RETENTION_DAYS,
      statement:
        "Identity and wallet-linkage records are retained per policy and lawful obligations, then handled using secure deletion controls."
    },
    disclosurePolicy:
      "Disclosure occurs only on lawful request or when prior user consent has been recorded."
  });
});

export { router as legalRoutes };
