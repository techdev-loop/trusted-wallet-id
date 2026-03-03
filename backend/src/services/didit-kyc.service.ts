import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export type KycVerificationStatus = "pending" | "in_review" | "verified" | "rejected" | "error";

interface DiditSessionResponse {
  id: string;
  url?: string;
  session_url?: string;
  applicant_id?: string;
  status?: string;
}

interface CreateDiditSessionInput {
  userId: string;
  email: string;
  legalName: string;
  dateOfBirth: string;
  country: string;
}

export interface DiditSessionResult {
  providerSessionId: string;
  providerApplicantId: string | null;
  sessionUrl: string | null;
  providerStatus: string;
  normalizedStatus: KycVerificationStatus;
}

export function normalizeDiditStatus(status: string | null | undefined): KycVerificationStatus {
  const normalized = (status ?? "").toLowerCase();
  if (["approved", "verified", "success", "completed", "passed"].includes(normalized)) {
    return "verified";
  }
  if (["rejected", "declined", "failed", "denied"].includes(normalized)) {
    return "rejected";
  }
  if (["review", "in_review", "manual_review", "pending_review"].includes(normalized)) {
    return "in_review";
  }
  if (["error", "expired", "cancelled"].includes(normalized)) {
    return "error";
  }
  return "pending";
}

function getDiditConfig(): { apiKey: string; baseUrl: string; flowId: string } {
  if (env.KYC_PROVIDER !== "didit") {
    throw new HttpError("KYC provider is disabled", StatusCodes.BAD_REQUEST);
  }

  if (!env.DIDIT_API_KEY || !env.DIDIT_FLOW_ID) {
    throw new HttpError(
      "Didit provider is not fully configured. Set DIDIT_API_KEY and DIDIT_FLOW_ID.",
      StatusCodes.SERVICE_UNAVAILABLE
    );
  }

  return {
    apiKey: env.DIDIT_API_KEY,
    baseUrl: env.DIDIT_BASE_URL,
    flowId: env.DIDIT_FLOW_ID
  };
}

export async function createDiditSession(input: CreateDiditSessionInput): Promise<DiditSessionResult> {
  const didit = getDiditConfig();
  const response = await fetch(`${didit.baseUrl}/v2/kyc/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${didit.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      flow_id: didit.flowId,
      external_user_id: input.userId,
      metadata: {
        email: input.email,
        legal_name: input.legalName,
        date_of_birth: input.dateOfBirth,
        country: input.country
      }
    })
  });

  const payload = (await response.json().catch(() => null)) as DiditSessionResponse | null;
  if (!response.ok || !payload?.id) {
    throw new HttpError("Failed to create Didit KYC session", StatusCodes.BAD_GATEWAY);
  }

  const providerStatus = payload.status ?? "pending";
  return {
    providerSessionId: payload.id,
    providerApplicantId: payload.applicant_id ?? null,
    sessionUrl: payload.url ?? payload.session_url ?? null,
    providerStatus,
    normalizedStatus: normalizeDiditStatus(providerStatus)
  };
}

export async function getDiditSession(sessionId: string): Promise<DiditSessionResult> {
  const didit = getDiditConfig();
  const response = await fetch(`${didit.baseUrl}/v2/kyc/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${didit.apiKey}`,
      "Content-Type": "application/json"
    }
  });

  const payload = (await response.json().catch(() => null)) as DiditSessionResponse | null;
  if (!response.ok || !payload?.id) {
    throw new HttpError("Failed to fetch Didit KYC session", StatusCodes.BAD_GATEWAY);
  }

  const providerStatus = payload.status ?? "pending";
  return {
    providerSessionId: payload.id,
    providerApplicantId: payload.applicant_id ?? null,
    sessionUrl: payload.url ?? payload.session_url ?? null,
    providerStatus,
    normalizedStatus: normalizeDiditStatus(providerStatus)
  };
}
