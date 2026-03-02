import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { identityDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { encryptText } from "../security/encryption.js";

const kycSchema = z.object({
  consentAccepted: z.boolean(),
  consentVersion: z.string().min(1),
  legalName: z.string().min(2),
  dateOfBirth: z.string().min(4),
  nationalId: z.string().min(4),
  country: z.string().min(2)
});

const router = Router();

router.post("/submit", requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = kycSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (!parsed.data.consentAccepted) {
    throw new HttpError("Explicit consent is required before KYC", StatusCodes.BAD_REQUEST);
  }

  const encryptedIdentityPayload = encryptText(
    JSON.stringify({
      legalName: parsed.data.legalName,
      dateOfBirth: parsed.data.dateOfBirth,
      nationalId: parsed.data.nationalId,
      country: parsed.data.country
    })
  );

  await identityDb.query(
    `
      INSERT INTO kyc_profiles (
        user_id,
        encrypted_identity_json,
        consent_version,
        consent_accepted_at,
        verification_status,
        verified_at
      ) VALUES ($1, $2, $3, NOW(), 'verified', NOW())
      ON CONFLICT (user_id)
      DO UPDATE
      SET encrypted_identity_json = EXCLUDED.encrypted_identity_json,
          consent_version = EXCLUDED.consent_version,
          consent_accepted_at = NOW(),
          verification_status = 'verified',
          verified_at = NOW(),
          updated_at = NOW()
    `,
    [req.user.sub, encryptedIdentityPayload, parsed.data.consentVersion]
  );

  res.status(StatusCodes.OK).json({
    verificationStatus: "verified",
    message: "KYC verification completed"
  });
});

export { router as kycRoutes };
