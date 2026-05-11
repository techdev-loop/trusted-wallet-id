/** Mirrors backend `admin_capabilities`; `*` grants everything. */

export const ADMIN_CAPABILITY_WILDCARD = "*";

export function effectiveAdminCaps(
  role: "user" | "admin" | "compliance",
  caps: string[] | undefined
): string[] {
  if (role !== "admin" && role !== "compliance") {
    return [];
  }
  if (caps === undefined) {
    return [ADMIN_CAPABILITY_WILDCARD];
  }
  return caps;
}

export function hasAdminCapability(capsEffective: string[], required: string): boolean {
  if (capsEffective.includes(ADMIN_CAPABILITY_WILDCARD)) {
    return true;
  }
  return capsEffective.includes(required);
}

/** After OTP or password sign-in: operators with capabilities go to the admin app. */
export function getPostAuthPath(user: {
  role: "user" | "admin" | "compliance";
  adminCaps?: string[];
}): "/admin" | "/dashboard" {
  if (user.role === "admin" || user.role === "compliance") {
    const caps = effectiveAdminCaps(user.role, user.adminCaps);
    if (caps.length > 0) {
      return "/admin";
    }
  }
  return "/dashboard";
}

export const CAPABILITY_LABELS: Record<string, string> = {
  [ADMIN_CAPABILITY_WILDCARD]: "Full access (all tasks)",
  "manage_wallets:read": "View wallets & Tron lists",
  "manage_wallets:write": "Edit Tron pay settings, Telegram test, transfer notifications",
  "withdrawals:read": "View withdrawals tab",
  "withdrawals:write": "Submit chain withdrawals",
  "operators:manage": "Manage admin team & permissions",
  "operators:delete": "Remove operators from team (admin/compliance accounts)",
  "users:read": "Search user by wallet address",
  "identity:read": "View KYC / identity payloads",
  "disclosures:write": "Create disclosure requests",
  "disclosures:approve": "Approve disclosure requests",
  "audit:read": "View admin audit logs"
};

export const ASSIGNABLE_CAPABILITIES = [
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