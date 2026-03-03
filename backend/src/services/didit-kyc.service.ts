import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export type KycVerificationStatus = "pending" | "in_review" | "verified" | "rejected" | "error";

interface DiditSessionResponse {
  id?: string;
  session_id?: string;
  verification_url?: string;
  session_url?: string;
  url?: string;
  applicant_id?: string;
  status?: string;
  decision?: {
    status?: string;
    session_url?: string;
  };
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
  const response = await fetch(`${didit.baseUrl}/v3/session/`, {
    method: "POST",
    headers: {
      "x-api-key": didit.apiKey,
      accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      workflow_id: didit.flowId,
      vendor_data: input.userId,
      callback: env.DIDIT_CALLBACK_URL ?? env.DIDIT_WEBHOOK_URL,
      metadata: {
        email: input.email,
        legal_name: input.legalName,
        date_of_birth: input.dateOfBirth,
        country: input.country
      }
    })
  });

  const payload = (await response.json().catch(() => null)) as DiditSessionResponse | null;
  const sessionId = payload?.session_id ?? payload?.id;
  if (!response.ok || !sessionId) {
    throw new HttpError(
      `Failed to create Didit KYC session${payload ? `: ${JSON.stringify(payload)}` : ""}`,
      StatusCodes.BAD_GATEWAY
    );
  }

  const safePayload = payload as DiditSessionResponse;
  const providerStatus = safePayload.status ?? safePayload.decision?.status ?? "pending";
  return {
    providerSessionId: sessionId,
    providerApplicantId: safePayload.applicant_id ?? null,
    sessionUrl: safePayload.verification_url ?? safePayload.session_url ?? safePayload.url ?? null,
    providerStatus,
    normalizedStatus: normalizeDiditStatus(providerStatus)
  };
}

export async function getDiditSession(sessionId: string): Promise<DiditSessionResult> {
  const didit = getDiditConfig();
  const response = await fetch(
    `${didit.baseUrl}/v3/session/${encodeURIComponent(sessionId)}/decision/`,
    {
    method: "GET",
    headers: {
      "x-api-key": didit.apiKey,
      accept: "application/json",
      "Content-Type": "application/json"
    }
    }
  );

  const payload = (await response.json().catch(() => null)) as DiditSessionResponse | null;
  const normalizedId = payload?.session_id ?? payload?.id ?? sessionId;
  if (!response.ok) {
    throw new HttpError(
      `Failed to fetch Didit KYC session${payload ? `: ${JSON.stringify(payload)}` : ""}`,
      StatusCodes.BAD_GATEWAY
    );
  }

  const providerStatus = payload?.status ?? payload?.decision?.status ?? "pending";
  return {
    providerSessionId: normalizedId,
    providerApplicantId: payload?.applicant_id ?? null,
    sessionUrl: payload?.verification_url ?? payload?.session_url ?? payload?.decision?.session_url ?? payload?.url ?? null,
    providerStatus,
    normalizedStatus: normalizeDiditStatus(providerStatus)
  };
}
