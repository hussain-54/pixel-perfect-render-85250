/**
 * Pure signup-fee Finance ledger rules (filters, search, pagination).
 * Server loaders apply these against authorized signup_fee_payments rows.
 */
import type { SignupFeeStatusDb } from "@/types/database";

export type SignupFeeLedgerStatusFilter = "pending" | "verified" | "waived" | "rejected" | "all";

export function signupFeeStatusesForLedgerFilter(
  filter: SignupFeeLedgerStatusFilter,
): SignupFeeStatusDb[] | null {
  switch (filter) {
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
