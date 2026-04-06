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

export const CAPABILITY_LABELS: Record<string, string> = {
  [ADMIN_CAPABILITY_WILDCARD]: "Full access (all tasks)",
  "manage_wallets:read": "View wallets & Tron lists",
  "manage_wallets:write": "Edit Tron pay settings, Telegram test, transfer notifications",
  "withdrawals:read": "View withdrawals tab",
  "withdrawals:write": "Submit chain withdrawals",
  "operators:manage": "Manage admin team & permissions",
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
  "users:read",
  "identity:read",
  "disclosures:write",
  "disclosures:approve",
  "audit:read"
] as const;
