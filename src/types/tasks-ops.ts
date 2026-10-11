import type { OfficerTaskPriority, OfficerTaskStatus } from "@/types";

export const TASK_FILTER_TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
] as const;

export type TaskFilterTab = (typeof TASK_FILTER_TABS)[number]["key"];

export type TaskSource = "manual" | "system";

/** Stored priority level (distinct from derived overdue urgency). */
export type TaskPriorityLevel = "low" | "normal" | "high";

export const TASK_PRIORITY_LEVELS: readonly TaskPriorityLevel[] = ["low", "normal", "high"];

export const TASK_STATUSES: readonly OfficerTaskStatus[] = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
];

/** Portal timezone for day boundaries (deadline / overdue math). */
export const TASK_TIMEZONE = "Asia/Karachi";

/** Application / offer deadline automation window. */
export const DEADLINE_ALERT_DAYS = 7;

/** Passport / language-test expiry automation window. */
export const DOCUMENT_EXPIRY_ALERT_DAYS = 90;

export type TaskAutomationKind =
  | "document_rejection"
  | "application_deadline"
  | "offer_expiry"
  | "document_expiry";

export type PortalTaskRecord = {
  id: string;
  title: string;
  description: string | null;
  studentId: string | null;
  assigneeId: string;
  createdById: string | null;
  dueAt: string | null;
  priorityLevel: TaskPriorityLevel;
  status: OfficerTaskStatus;
  source: TaskSource;
  /** Idempotency / dedupe key for system tasks. */
  reminderRef: string | null;
  relatedApplicationId: string | null;
  relatedDocumentId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskOpsFilters = {
  tab?: TaskFilterTab;
  q?: string;
  /** ISO date (yyyy-mm-dd) for calendar day focus. */
  day?: string;
};

export type TaskOpsRow = {
  id: string;
  title: string;
  description: string | null;
  studentId: string | null;
  studentName: string | null;
  studentCaseId: string | null;
  assigneeId: string;
  assigneeName: string;
  dueAt: string | null;
  dueLabel: string;
  priorityLevel: TaskPriorityLevel;
  /** Derived urgency for badges / sorting. */
  urgency: OfficerTaskPriority;
  status: OfficerTaskStatus;
  source: TaskSource;
  sourceLabel: string;
  reminderRef: string | null;
  relatedApplicationId: string | null;
  relatedApplicationLabel: string | null;
  relatedDocumentId: string | null;
  relatedDocumentLabel: string | null;
  linkHref: string | null;
  isOverdue: boolean;
  completedAt: string | null;
};

export type TaskOpsPayload = {
  rows: TaskOpsRow[];
  counts: Record<TaskFilterTab, number>;
  /** yyyy-mm-dd → task count for calendar dots. */
  calendarMarks: Record<string, number>;
  students: { id: string; name: string; caseId: string }[];
  assignees: { id: string; name: string }[];
  applications: { id: string; studentId: string; label: string }[];
  documents: { id: string; studentId: string; label: string }[];
  automation: {
    lastRunAt: string | null;
    lastResult: TaskAutomationRunResult | null;
    schedulerActive: boolean;
  };
};

export type TaskAutomationRunResult = {
  ranAt: string;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
  byKind: Record<TaskAutomationKind, number>;
};

export type UpsertTaskInput = {
  id?: string;
  title: string;
  description?: string;
  studentId?: string | null;
  assigneeId: string;
  dueAt?: string | null;
  priorityLevel?: TaskPriorityLevel;
  status?: OfficerTaskStatus;
  relatedApplicationId?: string | null;
  relatedDocumentId?: string | null;
};

export type UpdateTaskStatusInput = {
  id: string;
  status: OfficerTaskStatus;
};