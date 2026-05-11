import type { AppRole, AuthenticatedRequestUser } from "../types/auth.js";

/** Wildcard grants every capability. */
export const ADMIN_CAPABILITY_WILDCARD = "*";

export const ADMIN_CAPABILITIES = [
  ADMIN_CAPABILITY_WILDCARD,
  "manage_wallets:read",
  "manage_wallets:write",
  "withdrawals:read",
  "withdrawals:write",
  "operators:manage",
  "operators:delete",
  "users:read",
  "identity:read",
  "disclosures:write",
  "disclosures:approve",
  "audit:read"
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const CAP_SET = new Set<string>(ADMIN_CAPABILITIES);

export function isValidCapabilityList(caps: string[]): caps is AdminCapability[] {
  return caps.every((c) => CAP_SET.has(c));
}

/**
 * Normalize DB row: NULL admin_capabilities for admin/compliance means legacy full access.
 * Empty array = explicitly no capabilities.
 */
export function capabilitiesFromDbRow(role: AppRole, adminCapabilities: string[] | null): string[] {
  if (role !== "admin" && role !== "compliance") {
    return [];
  }
  if (adminCapabilities === null) {
    return [ADMIN_CAPABILITY_WILDCARD];
  }
  return adminCapabilities;
}

/** JWT may omit adminCaps for tokens issued before RBAC; treat as full access. */
export function effectiveCapabilities(user: AuthenticatedRequestUser): string[] {
  if (user.role !== "admin" && user.role !== "compliance") {
    return [];
  }
  if (user.adminCaps === undefined) {
    return [ADMIN_CAPABILITY_WILDCARD];
  }
  return user.adminCaps;
}

export function hasCapability(effective: string[], required: string): boolean {
  if (effective.includes(ADMIN_CAPABILITY_WILDCARD)) {
    return true;
  }
  return effective.includes(required);
}
