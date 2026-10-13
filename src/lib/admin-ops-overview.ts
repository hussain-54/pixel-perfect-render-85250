/**
 * Pure aggregation helpers for admin overall tracking.
 * Counts only — no fabricated student PII.
 */
import type { JourneyStage } from "@/types/database";
import { JOURNEY_STAGE_ORDER } from "@/lib/journey-stage";
import { canViewModule, hasMinPermission, type BusinessRole } from "@/lib/business-permissions";
import { rolesAtLeastAdmin, type AppRole } from "@/lib/roles";

export type AdminOpsStudentSnap = {
  id: string;
  name: string;
  caseId: string;
  journeyStage: string;
  archived: boolean;
  updatedAt: string;
};

export type AdminOpsCountsInput = {
  students: AdminOpsStudentSnap[];
  pendingSignupFees: number;
  submittedHandovers: number;
  docsPendingReview: number;
  appsRequiringAction: number;
  offersRequiringAction: number;
  outstandingUniversityFees: number;
  visaAttention: number;
  overdueTasks: number;
  counsellingAppointmentsPending: number;
};

export type AdminOpsOverviewMetrics = {
  studentsByStage: Record<string, number>;
  totalStudents: number;
  activeStudents: number;
  pendingSignupFeeVerification: number;
  counsellingQueue: number;
  handoverQueue: number;
  documentsAwaitingVerification: number;
  applicationsRequiringAction: number;
  offersRequiringAction: number;
  outstandingUniversityFees: number;
  visaCasesRequiringAttention: number;
  overdueTasks: number;
};

export function emptyStageCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const stage of JOURNEY_STAGE_ORDER) out[stage] = 0;
  return out;
}

export function aggregateStudentsByStage(
  students: Array<{ journeyStage: string; archived?: boolean }>,
): Record<string, number> {
  const counts = emptyStageCounts();
  for (const s of students) {
    if (s.archived) continue;
    const key = s.journeyStage in counts ? s.journeyStage : "profile_submitted";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function buildAdminOpsMetrics(input: AdminOpsCountsInput): AdminOpsOverviewMetrics {
  const active = input.students.filter((s) => !s.archived);
  return {
    studentsByStage: aggregateStudentsByStage(input.students),
    totalStudents: input.students.length,
    activeStudents: active.length,
    pendingSignupFeeVerification: input.pendingSignupFees,
    counsellingQueue: input.counsellingAppointmentsPending,
    handoverQueue: input.submittedHandovers,
    documentsAwaitingVerification: input.docsPendingReview,
    applicationsRequiringAction: input.appsRequiringAction,
    offersRequiringAction: input.offersRequiringAction,
    outstandingUniversityFees: input.outstandingUniversityFees,
    visaCasesRequiringAttention: input.visaAttention,
    overdueTasks: input.overdueTasks,
  };
}

/** Who may view the admin ops overview (server must still enforce session + RLS). */
export function canViewAdminOpsOverview(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "manager") return true;
  return (
    canViewModule(input.businessRole, "reports") && canViewModule(input.businessRole, "students")
  );
}

/** Accounts may see fee aggregates but not document content payloads. */
export function canViewAdminDocumentDetails(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "manager") return true;
  return canViewModule(input.businessRole, "documents");
}

export function canViewAdminFinanceDetails(input: {
  appRole: AppRole;
  businessRole: BusinessRole | null;
}): boolean {
  if (rolesAtLeastAdmin(input.appRole)) return true;
  if (input.businessRole === "manager") return true;
  // Edit+ on fees/banking — counsellors (view-only fees) do not get finance aggregates.
  return (
    hasMinPermission(input.businessRole, "fees_payments", 2) ||
    hasMinPermission(input.businessRole, "banking_finance", 2)
  );
}

export function isKnownJourneyStage(value: string): value is JourneyStage {
  return (JOURNEY_STAGE_ORDER as readonly string[]).includes(value);
}
