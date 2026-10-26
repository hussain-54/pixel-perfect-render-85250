/**
 * Pure signup-fee Finance ledger rules (filters, search, pagination).
 * Server loaders apply these against authorized signup_fee_payments rows.
 */
import type { SignupFeeStatusDb } from "@/types/database";

/**
 * Ledger filters:
 * - claimed = actionable payment proofs awaiting Finance decision (primary queue)
 * - unpaid = voucher issued / obligation open (not yet claimed)
 * - pending = unpaid + claimed (open obligations; not the primary review queue)
 */
export type SignupFeeLedgerStatusFilter =
  "claimed" | "unpaid" | "pending" | "verified" | "waived" | "rejected" | "all";

export function signupFeeStatusesForLedgerFilter(
  filter: SignupFeeLedgerStatusFilter,
): SignupFeeStatusDb[] | null {
  switch (filter) {
    case "claimed":
      return ["claimed"];
    case "unpaid":
      return ["unpaid"];
    case "verified":
      return ["verified"];
    case "waived":
      return ["waived"];
    case "rejected":
      return ["rejected"];
    case "all":
      return null;
    case "pending":
    default:
      return ["unpaid", "claimed"];
  }
}

export type SignupFeeLedgerSearchRow = {
  studentName: string | null;
  caseId: string | null;
  referenceReceipt: string | null;
  paymentMethod: string | null;
  studentId: string;
};

export function signupFeeLedgerRowMatchesSearch(
  row: SignupFeeLedgerSearchRow,
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.studentName, row.caseId, row.referenceReceipt, row.paymentMethod, row.studentId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

/** Clamp page size for ledger loaders (max 200). */
export function clampSignupFeeLedgerPage(input: { limit?: number; offset?: number }): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(Number(input.limit) || 100, 1), 200);
  const offset = Math.max(Number(input.offset) || 0, 0);
  return { limit, offset };
}

/**
 * Overview totals — verified/rejected/waived amounts must not be summed from
 * unverified claims. Pending queue uses unpaid+claimed only.
 */
export function signupFeeLedgerOverviewBuckets(statuses: SignupFeeStatusDb[]): {
  pending: number;
  verified: number;
  rejected: number;
  waived: number;
} {
  let pending = 0;
  let verified = 0;
  let rejected = 0;
  let waived = 0;
  for (const s of statuses) {
    if (s === "unpaid" || s === "claimed") pending += 1;
    else if (s === "verified") verified += 1;
    else if (s === "rejected") rejected += 1;
    else if (s === "waived") waived += 1;
  }
  return { pending, verified, rejected, waived };
}

export type SignupFeeAmountSnap = {
  status: SignupFeeStatusDb | string;
  amount: number;
  currency: string;
  verifiedAt: string | null;
};

/**
 * Cash totals by currency — only `verified` counts as received money.
 * Waivers are never cash. Pending/rejected are excluded.
 */
export function aggregateVerifiedSignupFeeCash(
  rows: SignupFeeAmountSnap[],
  opts?: { todayStartIso?: string },
): {
  verifiedByCurrency: { currency: string; total: number }[];
  verifiedTodayByCurrency: { currency: string; total: number }[];
} {
  const all = new Map<string, number>();
  const today = new Map<string, number>();
  const todayStart = opts?.todayStartIso ? new Date(opts.todayStartIso).getTime() : null;

  for (const row of rows) {
    if (String(row.status).toLowerCase() !== "verified") continue;
    const cur = (row.currency || "PKR").trim() || "PKR";
    const amt = Number(row.amount);
    if (!Number.isFinite(amt)) continue;
    all.set(cur, (all.get(cur) ?? 0) + amt);
    if (todayStart != null && row.verifiedAt) {
      const t = new Date(row.verifiedAt).getTime();
      if (!Number.isNaN(t) && t >= todayStart) {
        today.set(cur, (today.get(cur) ?? 0) + amt);
      }
    }
  }

  const toList = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    verifiedByCurrency: toList(all),
    verifiedTodayByCurrency: toList(today),
  };
}

/** Escape user search for PostgREST ilike patterns (strip wildcards). */
export function sanitizeSignupFeeSearchTerm(raw: string): string {
  return raw.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function expectedStatusForSignupFeeAction(
  action: "verify" | "waive" | "reject",
): SignupFeeStatusDb {
  if (action === "verify") return "verified";
  if (action === "waive") return "waived";
  return "rejected";
}

export function isTerminalSignupFeeStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "verified" || s === "waived" || s === "rejected";
}
