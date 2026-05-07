import { getSession } from "./session";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "https://api.fiulink.com/api";
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getMaxRetryAttempts(method: RequestOptions["method"], path: string): number {
  const normalizedMethod = method ?? "GET";

  // Auth flow should be the most resilient because users are blocked otherwise.
  if (path.startsWith("/auth/")) {
    return 12;
  }

  // Reads can safely retry more often.
  if (normalizedMethod === "GET") {
    return 8;
  }

  // Mutating endpoints keep tighter retry limits to reduce duplicate side effects.
  return 3;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false } = options;
  const maxRetryAttempts = getMaxRetryAttempts(method, path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (auth) {
    const session = getSession();
    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }
  }

  let response: Response | null = null;
  let lastNetworkError: unknown = null;

  for (let attempt = 1; attempt <= maxRetryAttempts; attempt += 1) {
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined
      });

      if (TRANSIENT_HTTP_STATUSES.has(response.status) && attempt < maxRetryAttempts) {
        await wait(Math.min(500 * attempt, 3000));
        continue;
      }

      break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < maxRetryAttempts) {
        await wait(Math.min(500 * attempt, 3000));
        continue;
      }
    }
  }

  if (!response) {
    throw new ApiError(
      `Unable to reach backend API at ${API_BASE_URL}. Backend may be waking up or restarting. Please retry in a few seconds.`,
      0
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  void lastNetworkError;
  return payload as T;
}