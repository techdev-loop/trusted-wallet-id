export type AppRole = "user" | "admin" | "compliance";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: AppRole;
  /** Present for admin/compliance; omitted in legacy JWTs (treated as full access). */
  adminCaps?: string[];
}

export interface AuthenticatedRequestUser extends AuthTokenPayload {
  iat?: number;
  exp?: number;
}
