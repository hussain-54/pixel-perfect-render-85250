/**
 * My Registrations status filters — maps existing intake + fee-request fields only.
 * Does not invent ledger statuses or hardcode counts.
 */
import { frontDeskActionRequiredStudentIds } from "@/lib/front-desk-workspace";

export type IntakeFilterId =
  | "all"
  | "new_today"
  | "assigned"
  | "awaiting_counsellor"
  | "fee_pending"
  | "awaiting_finance"
  | "finance_verified"
  | "portal_pending"
  | "needs_attention";

export type IntakeFilterTone =
  | "slate"
  | "blue"
  | "purple"
  | "amber"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "red";

export type IntakeFilterDefinition = {
  id: IntakeFilterId;
  label: string;
  tone: IntakeFilterTone;
};

export const INTAKE_STATUS_FILTERS: IntakeFilterDefinition[] = [
  { id: "all", label: "All Registrations", tone: "slate" },
  { id: "new_today", label: "New Today", tone: "blue" },
  { id: "assigned", label: "Counsellor Assigned", tone: "purple" },
  { id: "awaiting_counsellor", label: "Awaiting Counsellor", tone: "amber" },
  { id: "fee_pending", label: "Fee Pending", tone: "orange" },
  { id: "awaiting_finance", label: "Awaiting Finance", tone: "yellow" },
  { id: "finance_verified", label: "Finance Verified", tone: "green" },
  { id: "portal_pending", label: "Portal Pending", tone: "teal" },
  { id: "needs_attention", label: "Needs Attention", tone: "red" },
];

type IntakeLike = {
  id: string;
  createdAt: string;
  assignmentStatus: "pending" | "assigned";
  signupFeeStatus: string | null;
  portalActivatedAt: string | null;
};

type FeeReqLike = {
  studentId: string;
  status: string;
  signupFeeStatus: string | null;
};

function feeStatus(row: IntakeLike): string {
  return (row.signupFeeStatus ?? "").trim().toLowerCase();
}

/** Calendar day in local timezone (YYYY-MM-DD). */
export function localDateKey(iso: string, now = new Date()): string {
  const d = iso ? new Date(iso) : now;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isCreatedToday(createdAt: string, now = new Date()): boolean {
  const key = localDateKey(createdAt, now);
  if (!key) return false;
  return key === localDateKey(now.toISOString(), now);
}

export function intakeRowMatchesStatusFilter(
  row: IntakeLike,
  filter: IntakeFilterId,
  attentionIds?: Set<string>,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  if (filter === "new_today") return isCreatedToday(row.createdAt, now);
  if (filter === "assigned") return row.assignmentStatus === "assigned";
  if (filter === "awaiting_counsellor") return row.assignmentStatus === "pending";
  const fee = feeStatus(row);
  if (filter === "fee_pending") return fee === "unpaid";
  if (filter === "awaiting_finance") return fee === "claimed";
  if (filter === "finance_verified") return fee === "verified";
  if (filter === "portal_pending") {
    if (fee !== "verified" && fee !== "waived") return false;
    return !row.portalActivatedAt;
  }
  if (filter === "needs_attention") {
    return Boolean(attentionIds?.has(row.id));
  }
  return true;
}

export function countIntakeStatusFilters(input: {
  rows: IntakeLike[];
  feeRequests?: FeeReqLike[];
  now?: Date;
}): Record<IntakeFilterId, number> {
  const now = input.now ?? new Date();
  const attentionIds = frontDeskActionRequiredStudentIds({
    intakeRows: input.rows as never,
    feeRequests: (input.feeRequests ?? []) as never,
  });
  const counts = Object.fromEntries(
    INTAKE_STATUS_FILTERS.map((f) => [f.id, 0]),
  ) as Record<IntakeFilterId, number>;

  for (const row of input.rows) {
    for (const def of INTAKE_STATUS_FILTERS) {
      if (intakeRowMatchesStatusFilter(row, def.id, attentionIds, now)) {
        counts[def.id] += 1;
      }
    }
  }
  return counts;
}

export function filterIntakeRowsByStatus<T extends IntakeLike>(input: {
  rows: T[];
  filter: IntakeFilterId;
  feeRequests?: FeeReqLike[];
  now?: Date;
}): T[] {
  const now = input.now ?? new Date();
  const attentionIds =
    input.filter === "needs_attention"
      ? frontDeskActionRequiredStudentIds({
          intakeRows: input.rows as never,
          feeRequests: (input.feeRequests ?? []) as never,
        })
      : undefined;
  return input.rows.filter((row) =>
    intakeRowMatchesStatusFilter(row, input.filter, attentionIds, now),
  );
}
