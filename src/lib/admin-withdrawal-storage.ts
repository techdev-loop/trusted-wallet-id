/**
 * Persists the admin "This session" withdrawal list per signed-in operator (localStorage).
 * Survives full page refresh; cleared on explicit logout from Admin/Dashboard.
 */

const STORAGE_PREFIX = "fiulink.admin.withdrawals.v1.";

export interface PersistedWithdrawalEntry {
  id: string;
  chain: string;
  amountUsdt: number;
  destinationAddress: string;
  status: string;
  note: string;
  txHash: string;
  createdAt: string;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isValidEntry(x: unknown): x is PersistedWithdrawalEntry {
  if (!isRecord(x)) return false;
  const chains = ["ethereum", "bsc", "tron", "solana"];
  return (
    typeof x.id === "string" &&
    typeof x.chain === "string" &&
    chains.includes(x.chain) &&
    typeof x.amountUsdt === "number" &&
    typeof x.destinationAddress === "string" &&
    x.status === "completed" &&
    typeof x.note === "string" &&
    typeof x.txHash === "string" &&
    typeof x.createdAt === "string"
  );
}

export function loadWithdrawalSession(userId: string | undefined): PersistedWithdrawalEntry[] {
  if (!userId || typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

export function persistWithdrawalSession(userId: string | undefined, entries: PersistedWithdrawalEntry[]): void {
  if (!userId || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(entries));
  } catch {
    /* quota / private mode */
  }
}

export function clearWithdrawalSession(userId: string | undefined): void {
  if (!userId || typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}
