export interface SessionUser {
  id: string;
  email?: string;
  role: "user" | "admin" | "compliance";
  /** Server-issued capability strings; omitted on legacy sessions (treated as full access for admin/compliance). */
  adminCaps?: string[];
  /** Web3 wallet session (`/web3/connect`). */
  walletAddress?: string;
  chain?: string;
}

export interface SessionData {
  token: string;
  /** Opaque refresh token; absent on legacy sessions until next sign-in. */
  refreshToken?: string;
  user: SessionUser;
}

const SESSION_KEY = "fiulink.session";

export function getSession(): SessionData | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.token || !parsed?.user?.id || !parsed?.user?.email || parsed?.user?.role == null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(session: SessionData): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}