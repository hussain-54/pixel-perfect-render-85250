import type { ApplicationStatus } from "@/types";

/** Wireframe page 5 submission pipeline stages (offer/deposit/visa stay separate). */
export const APPLICATION_PIPELINE_STAGES = [
  { key: "Docs Pending", label: "Docs Pending" },
  { key: "Under Review", label: "Under Review" },
  { key: "Ready to Submit", label: "Ready to Submit" },
  { key: "Submitted", label: "Submitted" },
  { key: "Offer Received", label: "Offer Received" },
] as const;

export type ApplicationPipelineStage = (typeof APPLICATION_PIPELINE_STAGES)[number]["key"];

/** Terminal outcomes allowed by validate_application_stage_transition (DB). */
export const APPLICATION_TERMINAL_OUTCOMES = ["Rejected", "Withdrawn"] as const;
export type ApplicationTerminalOutcome = (typeof APPLICATION_TERMINAL_OUTCOMES)[number];

export type ApplicationStageTarget = ApplicationPipelineStage | ApplicationTerminalOutcome;

export function isPipelineStage(value: string): value is ApplicationPipelineStage {
  return APPLICATION_PIPELINE_STAGES.some((s) => s.key === value);
}

export function isTerminalOutcome(value: string): value is ApplicationTerminalOutcome {
  return (APPLICATION_TERMINAL_OUTCOMES as readonly string[]).includes(value);
}

export function isApplicationStageTarget(value: string): value is ApplicationStageTarget {
  return isPipelineStage(value) || isTerminalOutcome(value);
}

/** Adjacent + forward/back correction transitions only. */
export const ALLOWED_STAGE_TRANSITIONS: Record<
  ApplicationPipelineStage,
  ApplicationPipelineStage[]
> = {
  "Docs Pending": ["Under Review"],
  "Under Review": ["Docs Pending", "Ready to Submit"],
  "Ready to Submit": ["Under Review", "Submitted"],
  Submitted: ["Ready to Submit", "Offer Received"],
  "Offer Received": ["Submitted"],
};

/**
 * Mirrors public.validate_application_stage_transition for pipeline + terminal closes.
 * Does not prove remote RLS/JWT.
 */
export function canTransitionApplicationStage(from: string, to: string): boolean {
  if (!isApplicationStageTarget(to)) return false;
  if (!isPipelineStage(from)) return false;
  if (isTerminalOutcome(to)) return true;
  return ALLOWED_STAGE_TRANSITIONS[from].includes(to);
}

/** Reject / withdraw actions available while still on the submission pipeline. */
export function applicationTerminalActions(from: string): ApplicationTerminalOutcome[] {
  if (!isPipelineStage(from)) return [];
  return [...APPLICATION_TERMINAL_OUTCOMES];
}

export type ApplicationStageHistoryRecord = {
  id: string;
  applicationId: string;
  fromStage: ApplicationStatus | null;
  toStage: ApplicationStatus;
  changedById: string | null;
  changedByName: string;
  changedAt: string;
  note: string | null;
};

export type ApplicationPipelineRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  university: string;
  program: string;
  country: string;
  intake: string;
  stage: ApplicationStatus;
  deadline: string;
  daysLeft: number | null;
  deadlineWarning: boolean;
  officerId: string;
  appliedOn: string;
};

export type ApplicationPipelineFilters = {
  q?: string;
  stage?: ApplicationPipelineStage | "all";
  studentId?: string;
};

export type ApplicationPipelinePayload = {
  rows: ApplicationPipelineRow[];
  counts: { all: number } & Record<ApplicationPipelineStage, number>;
  students: { id: string; name: string; caseId: string }[];
  canCreate: boolean;
};

export type ApplicationDetailPayload = {
  application: ApplicationPipelineRow;
  history: ApplicationStageHistoryRecord[];
};

export type NewPipelineApplicationInput = {
  studentId: string;
  university: string;
  country: string;
  program: string;
  intake: string;
  deadline: string;
  idempotencyKey?: string;
};
