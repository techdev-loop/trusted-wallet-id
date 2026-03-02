export type AppRole = "user" | "admin" | "compliance";

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: AppRole;
}

export interface AuthenticatedRequestUser extends AuthTokenPayload {
  iat?: number;
  exp?: number;
}
