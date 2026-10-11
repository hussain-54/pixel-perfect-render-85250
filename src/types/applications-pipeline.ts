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

export function isPipelineStage(value: string): value is ApplicationPipelineStage {
  return APPLICATION_PIPELINE_STAGES.some((s) => s.key === value);
}

/** Adjacent + forward/back correction transitions only. */
export const ALLOWED_STAGE_TRANSITIONS: Record<ApplicationPipelineStage, ApplicationPipelineStage[]> = {
  "Docs Pending": ["Under Review"],
  "Under Review": ["Docs Pending", "Ready to Submit"],
  "Ready to Submit": ["Under Review", "Submitted"],
  Submitted: ["Ready to Submit", "Offer Received"],
  "Offer Received": ["Submitted"],
};

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
