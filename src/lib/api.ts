import { getSession } from "./session";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000/api";

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
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (auth) {
    const session = getSession();
    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(
      `Unable to reach backend API at ${API_BASE_URL}. Check that backend is running and CORS is configured.`,
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

  return payload as T;
}
