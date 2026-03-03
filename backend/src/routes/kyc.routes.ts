import { Router } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { env } from "../config/env.js";
import { identityDb } from "../db/pool.js";
import { HttpError } from "../lib/http-error.js";
import { logAdminAudit } from "../services/audit.service.js";
import {
  createDiditSession,
  getDiditSession,
  normalizeDiditStatus
} from "../services/didit-kyc.service.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { encryptText } from "../security/encryption.js";

const kycSchema = z.object({
  consentAccepted: z.boolean(),
  consentVersion: z.string().min(1),
  legalName: z.string().min(2),
  dateOfBirth: z.string().min(4),
  nationalId: z.string().min(4),
  country: z.string().min(2),
  documents: z
    .array(
      z.object({
        type: z.string().min(1),
        fileName: z.string().min(1),
        documentNumber: z.string().min(1).optional(),
        issuingCountry: z.string().min(2).optional()
      })
    )
    .max(10)
    .optional(),
  sandboxDecision: z.enum(["approved", "in_review", "rejected"]).optional()
});

const diditWebhookSchema = z.object({
  session_id: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
  applicant_id: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  external_user_id: z.string().uuid().optional(),
  event: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional()
});

const router = Router();
const OTP_RETRY_COOLDOWN_MS = 60 * 1000;
const MAX_KYC_INIT_ATTEMPTS = 5;
const SYSTEM_AUDIT_ACTOR_ID = "00000000-0000-0000-0000-000000000000";
const SANDBOX_PROVIDER_NAME = "didit_sandbox";

function isSandboxModeEnabled(): boolean {
  return env.NODE_ENV !== "production" && env.KYC_SANDBOX_MODE;
}

function getWebhookSignature(headers: AuthenticatedRequest["headers"]): string | null {
  const value = headers["x-didit-signature"] ?? headers["didit-signature"];
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSignature(signature: string): string {
  return signature.startsWith("sha256=") ? signature.slice(7) : signature;
}

function verifyDiditSignature(rawBody: string, signatureHeader: string): boolean {
  if (!env.DIDIT_WEBHOOK_SECRET) {
    return false;
  }
  const expected = createHmac("sha256", env.DIDIT_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const provided = normalizeSignature(signatureHeader);
  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

router.post("/webhooks/didit", async (req, res) => {
  const signatureHeader = getWebhookSignature(req.headers);
  const rawBody = (req as { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});

  if (!signatureHeader || !verifyDiditSignature(rawBody, signatureHeader)) {
    throw new HttpError("Invalid Didit webhook signature", StatusCodes.UNAUTHORIZED);
  }

  const parsed = diditWebhookSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const payload = parsed.data;
  const providerSessionId = payload.session_id ?? payload.id;
  if (!providerSessionId) {
    throw new HttpError("Didit webhook missing session id", StatusCodes.BAD_REQUEST);
  }

  const candidateUserId = payload.external_user_id;
  let userId = candidateUserId ?? null;
  if (!userId) {
    const owner = await identityDb.query<{ user_id: string }>(
      `
        SELECT user_id
        FROM kyc_profiles
        WHERE provider_session_id = $1
        LIMIT 1
      `,
      [providerSessionId]
    );
    userId = owner.rows[0]?.user_id ?? null;
  }

  if (!userId) {
    throw new HttpError("Unable to map Didit webhook to user", StatusCodes.BAD_REQUEST);
  }

  const providerStatus = payload.status ?? "pending";
  const normalizedStatus = normalizeDiditStatus(providerStatus);
  const verificationStatus = normalizedStatus === "in_review" ? "pending" : normalizedStatus;
  const reviewRequired = normalizedStatus === "in_review" || normalizedStatus === "error";
  const completedAt = normalizedStatus === "verified" || normalizedStatus === "rejected";

  await identityDb.query(
    `
      UPDATE kyc_profiles
      SET provider_name = 'didit',
          provider_session_id = $2,
          provider_applicant_id = COALESCE($3, provider_applicant_id),
          provider_status = $4,
          provider_raw_result_json = $5,
          verification_status = $6,
          review_required = $7,
          last_error = CASE WHEN $6 = 'error' THEN COALESCE($8, 'Didit reported error state') ELSE NULL END,
          verified_at = CASE WHEN $6 = 'verified' THEN NOW() ELSE verified_at END,
          completed_at = CASE WHEN $9 THEN NOW() ELSE completed_at END,
          updated_at = NOW()
      WHERE user_id = $1
    `,
    [
      userId,
      providerSessionId,
      payload.applicant_id ?? null,
      providerStatus,
      encryptText(JSON.stringify(payload)),
      verificationStatus,
      reviewRequired,
      payload.event ?? null,
      completedAt
    ]
  );

  await logAdminAudit({
    actorUserId: SYSTEM_AUDIT_ACTOR_ID,
    actorRole: "system",
    action: "KYC_STATUS_UPDATED_FROM_WEBHOOK",
    targetUserId: userId,
    metadata: {
      provider: "didit",
      providerSessionId,
      providerStatus,
      normalizedStatus
    }
  });

  res.status(StatusCodes.OK).json({ acknowledged: true });
});

router.use(requireAuth);

router.post("/sandbox/decision", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!isSandboxModeEnabled()) {
    throw new HttpError("Sandbox KYC controls are disabled", StatusCodes.NOT_FOUND);
  }
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const parsed = z
    .object({
      decision: z.enum(["approved", "in_review", "rejected"]),
      reason: z.string().max(500).optional()
    })
    .safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(parsed.error.message, StatusCodes.BAD_REQUEST);
  }

  const decision = parsed.data.decision;
  const verificationStatus = decision === "approved" ? "verified" : decision === "rejected" ? "rejected" : "pending";
  const completed = verificationStatus === "verified" || verificationStatus === "rejected";

  const updateResult = await identityDb.query(
    `
      UPDATE kyc_profiles
      SET provider_name = $2,
          provider_status = $3,
          provider_raw_result_json = $4,
          verification_status = $5,
          review_required = $6,
          last_error = CASE WHEN $5 = 'rejected' THEN COALESCE($7, 'Sandbox rejected') ELSE NULL END,
          verified_at = CASE WHEN $5 = 'verified' THEN NOW() ELSE verified_at END,
          completed_at = CASE WHEN $8 THEN NOW() ELSE completed_at END,
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING user_id
    `,
    [
      req.user.sub,
      SANDBOX_PROVIDER_NAME,
      decision,
      encryptText(
        JSON.stringify({
          provider: SANDBOX_PROVIDER_NAME,
          decision,
          reason: parsed.data.reason ?? null,
          decidedAt: new Date().toISOString()
        })
      ),
      verificationStatus,
      decision === "in_review",
      parsed.data.reason ?? null,
      completed
    ]
  );

  if (!updateResult.rows[0]) {
    throw new HttpError("Start KYC first before setting sandbox decision", StatusCodes.BAD_REQUEST);
  }

  res.status(StatusCodes.OK).json({
    verificationStatus,
    provider: SANDBOX_PROVIDER_NAME,
    providerStatus: decision
  });
});

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
      country: parsed.data.country,
      documents: parsed.data.documents ?? []
    })
  );

  const existingResult = await identityDb.query<{
    failed_attempts: number;
    submitted_at: Date | null;
    verification_status: string;
    provider_session_id: string | null;
  }>(
    `
      SELECT failed_attempts, submitted_at, verification_status, provider_session_id
      FROM kyc_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [req.user.sub]
  );

  const existing = existingResult.rows[0];
  if (existing?.verification_status === "verified") {
    res.status(StatusCodes.OK).json({
      verificationStatus: "verified",
      message: "KYC already verified"
    });
    return;
  }

  if (
    existing?.submitted_at &&
    ["pending", "in_review"].includes(existing.verification_status) &&
    Date.now() - existing.submitted_at.getTime() < OTP_RETRY_COOLDOWN_MS
  ) {
    throw new HttpError("KYC is already in progress. Please wait before retrying.", StatusCodes.TOO_MANY_REQUESTS);
  }

  if ((existing?.failed_attempts ?? 0) >= MAX_KYC_INIT_ATTEMPTS) {
    throw new HttpError(
      "Maximum KYC attempts reached. Manual compliance review is required.",
      StatusCodes.TOO_MANY_REQUESTS
    );
  }

  let providerSessionId: string | null = null;
  let providerApplicantId: string | null = null;
  let providerStatus = "pending";
  let providerSessionUrl: string | null = null;
  let verificationStatus = "pending";
  let reviewRequired = false;
  let lastError: string | null = null;
  let providerName: string | null = null;

  if (isSandboxModeEnabled()) {
    const sandboxDecision = parsed.data.sandboxDecision ?? (env.KYC_SANDBOX_AUTO_APPROVE ? "approved" : "in_review");
    providerName = SANDBOX_PROVIDER_NAME;
    providerSessionId = `sandbox-${randomUUID()}`;
    providerApplicantId = `sandbox-applicant-${req.user.sub}`;
    providerStatus = sandboxDecision;
    verificationStatus =
      sandboxDecision === "approved" ? "verified" : sandboxDecision === "rejected" ? "rejected" : "pending";
    reviewRequired = sandboxDecision === "in_review";
    providerSessionUrl = null;
  } else if (env.KYC_PROVIDER === "didit") {
    providerName = "didit";
    try {
      const session = await createDiditSession({
        userId: req.user.sub,
        email: req.user.email,
        legalName: parsed.data.legalName,
        dateOfBirth: parsed.data.dateOfBirth,
        country: parsed.data.country
      });
      providerSessionId = session.providerSessionId;
      providerApplicantId = session.providerApplicantId;
      providerStatus = session.providerStatus;
      verificationStatus = session.normalizedStatus === "in_review" ? "pending" : session.normalizedStatus;
      reviewRequired = session.normalizedStatus === "error" || session.normalizedStatus === "in_review";
      providerSessionUrl = session.sessionUrl;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Failed to initiate Didit KYC session";
      reviewRequired = true;
      verificationStatus = "error";
      providerStatus = "error";
    }
  } else {
    reviewRequired = true;
    lastError = "KYC provider is disabled";
    verificationStatus = "pending";
  }

  await identityDb.query(
    `
      INSERT INTO kyc_profiles (
        user_id,
        encrypted_identity_json,
        consent_version,
        consent_accepted_at,
        verification_status,
        provider_name,
        provider_session_id,
        provider_applicant_id,
        provider_status,
        provider_raw_result_json,
        review_required,
        failed_attempts,
        last_error,
        submitted_at,
        updated_at,
        verified_at,
        completed_at
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(),
        CASE WHEN $4 = 'verified' THEN NOW() ELSE NULL END,
        CASE WHEN $4 IN ('verified', 'rejected') THEN NOW() ELSE NULL END
      )
      ON CONFLICT (user_id)
      DO UPDATE
      SET encrypted_identity_json = EXCLUDED.encrypted_identity_json,
          consent_version = EXCLUDED.consent_version,
          consent_accepted_at = NOW(),
          verification_status = EXCLUDED.verification_status,
          provider_name = EXCLUDED.provider_name,
          provider_session_id = COALESCE(EXCLUDED.provider_session_id, kyc_profiles.provider_session_id),
          provider_applicant_id = COALESCE(EXCLUDED.provider_applicant_id, kyc_profiles.provider_applicant_id),
          provider_status = EXCLUDED.provider_status,
          provider_raw_result_json = EXCLUDED.provider_raw_result_json,
          review_required = EXCLUDED.review_required,
          failed_attempts = CASE WHEN EXCLUDED.verification_status = 'error'
              THEN kyc_profiles.failed_attempts + 1
              ELSE kyc_profiles.failed_attempts
            END,
          last_error = EXCLUDED.last_error,
          submitted_at = NOW(),
          updated_at = NOW(),
          verified_at = CASE WHEN EXCLUDED.verification_status = 'verified' THEN NOW() ELSE kyc_profiles.verified_at END,
          completed_at = CASE WHEN EXCLUDED.verification_status IN ('verified', 'rejected') THEN NOW() ELSE kyc_profiles.completed_at END
    `,
    [
      req.user.sub,
      encryptedIdentityPayload,
      parsed.data.consentVersion,
      verificationStatus,
      providerName,
      providerSessionId,
      providerApplicantId,
      providerStatus,
      providerSessionId
        ? encryptText(
            JSON.stringify({
              provider: providerName,
              providerSessionId,
              providerStatus,
              documents: parsed.data.documents ?? []
            })
          )
        : null,
      reviewRequired,
      verificationStatus === "error" ? 1 : 0,
      lastError
    ]
  );

  res.status(StatusCodes.OK).json({
    verificationStatus,
    message:
      verificationStatus === "error"
        ? "KYC session could not be started. Compliance review may be required."
        : "KYC session created successfully",
    provider: providerName ?? "none",
    providerSessionId,
    providerSessionUrl
  });
});

router.get("/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    throw new HttpError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const profileResult = await identityDb.query<{
    verification_status: string;
    provider_name: string | null;
    provider_session_id: string | null;
    provider_status: string | null;
    review_required: boolean;
    last_error: string | null;
  }>(
    `
      SELECT verification_status, provider_name, provider_session_id, provider_status, review_required, last_error
      FROM kyc_profiles
      WHERE user_id = $1
      LIMIT 1
    `,
    [req.user.sub]
  );

  const profile = profileResult.rows[0];
  if (!profile) {
    res.status(StatusCodes.OK).json({
      verificationStatus: "not_started"
    });
    return;
  }

  let refreshedProviderStatus = profile.provider_status;
  let refreshedVerificationStatus = profile.verification_status;
  let providerSessionUrl: string | null = null;

  if (env.KYC_PROVIDER === "didit" && profile.provider_name === "didit" && profile.provider_session_id) {
    try {
      const live = await getDiditSession(profile.provider_session_id);
      refreshedProviderStatus = live.providerStatus;
      refreshedVerificationStatus =
        live.normalizedStatus === "in_review" ? "pending" : live.normalizedStatus;
      providerSessionUrl = live.sessionUrl;

      await identityDb.query(
        `
          UPDATE kyc_profiles
          SET provider_status = $2,
              verification_status = $3,
              verified_at = CASE WHEN $3 = 'verified' THEN NOW() ELSE verified_at END,
              completed_at = CASE WHEN $3 IN ('verified', 'rejected') THEN NOW() ELSE completed_at END,
              updated_at = NOW()
          WHERE user_id = $1
        `,
        [req.user.sub, refreshedProviderStatus, refreshedVerificationStatus]
      );
    } catch {
      // Non-blocking. Keep last known database status.
    }
  }

  res.status(StatusCodes.OK).json({
    verificationStatus: refreshedVerificationStatus,
    provider: profile.provider_name,
    providerSessionId: profile.provider_session_id,
    providerStatus: refreshedProviderStatus,
    providerSessionUrl,
    reviewRequired: profile.review_required,
    lastError: profile.last_error
  });
});

export { router as kycRoutes };
