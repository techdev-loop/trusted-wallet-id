export interface SessionUser {
  id: string;
  email: string;
  role: "user" | "admin" | "compliance";
}

export interface SessionData {
  token: string;
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
    if (!parsed?.token || !parsed?.user?.id || !parsed?.user?.email || !parsed?.user?.role) {
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
