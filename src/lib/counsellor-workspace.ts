/**
 * Counsellor Workbench helpers — KPIs, attention queue, notification deep links.
 * Metrics use only persisted artefacts (agreements, tasks, apps, handovers, fee requests).
 * Registration alone never counts as counselling completed (no counselling_sessions table).
 */
import {
  resolveCounsellorLifecycleNext,
  type CounsellorLifecycleInput,
} from "@/lib/counsellor-lifecycle-next";
import type { ProfileTabId } from "@/types/student-profile";

/** Documented definitions for dashboard KPI cards (product + audit / tooltips). */
export const COUNSELLOR_METRIC_DEFINITIONS = {
  assignedStudents:
    "Non-archived students currently assigned to the logged-in counsellor desk (assigned_consultant_id).",
  awaitingInitialAssessment:
    "Assigned students with no saved counselling assessment (assessed_at null). Opening the profile does not count as complete.",
  counsellingCompleted:
    "Assigned students with at least one counselling_agreements row where consented = true. Not a full session history; registration alone does not count.",
  followUpsDue:
    "Open or in-progress tasks for this desk (assignee or assigned student) with due_at on or before end of today.",
  applicationsInProgress:
    "Applications for assigned students in Docs Pending, Under Review, Ready to Submit, or Submitted (UI stages).",
  awaitingResponse:
    "Distinct assigned students awaiting Admission (handover status submitted) and/or Front Desk/Finance (fee-verification request open or in_progress).",
  actionRequired:
    "Distinct assigned students where the counsellor has an actionable lifecycle next step, a returned handover, a cancelled fee request, an overdue or due-today task, or a document pending review.",
} as const;

/** Short UI hints for StatCards — keep long definitions in tooltips only. */
export const COUNSELLOR_METRIC_HINTS = {
  assignedStudents: "On your desk",
  awaitingInitialAssessment: "No saved counselling assessment yet",
  counsellingCompleted: "Consent recorded",
  followUpsDue: "Due today or earlier",
  applicationsInProgress: "Active pipeline stages",
  awaitingResponse: "Waiting on FD, Finance, or Admission",
  actionRequired: "Students needing your next step",
} as const;

export const IN_PROGRESS_APPLICATION_UI_STATUSES = [
  "Docs Pending",
  "Under Review",
  "Ready to Submit",
  "Submitted",
] as const;

export type CounsellorWorkbenchStudentSnap = {
  id: string;
  caseId: string;
  name: string;
  destination: string;
  stageLabel: string;
  lastActivity: string;
  hasAssessment: boolean;
  hasConsent: boolean;
  signupFeeStatus: string | null;
  openFeeRequestStatus: string | null;
  handoverStatus: string | null;
  docsPendingReview: number;
  /** Task due before start of local today. */
  hasOverdueTask: boolean;
  /** Task due sometime today (not past midnight). */
  hasDueTodayTask: boolean;
};

export type CounsellorAttentionUrgency = "critical" | "high" | "normal";

export type CounsellorAttentionItem = {
  id: string;
  studentId: string;
  caseId: string;
  fullName: string;
  kind: "lifecycle" | "task" | "document" | "handover" | "fee";
  title: string;
  detail: string;
  /** Lower = more urgent (workflow-derived, not invented SLA). */
  priority: number;
  at: string;
  urgencyGroup: CounsellorAttentionUrgency;
  workflowStatus: string;
  nextResponsibleRole: string;
  primaryActionLabel: string;
  profileTab: ProfileTabId;
};

export type CounsellorWorkbenchMetrics = {
  assignedStudents: number;
  awaitingInitialAssessment: number;
  counsellingCompleted: number;
  followUpsDue: number;
  applicationsInProgress: number;
  awaitingResponse: number;
  actionRequired: number;
  /** Kept for compatibility with prior AO cards. */
  docsToReview: number;
  deadlinesThisWeek: number;
};

export function endOfLocalDayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function startOfLocalDayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function isTaskDueOnOrBeforeToday(
  dueAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!dueAt) return false;
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.parse(endOfLocalDayIso(now));
}

/** True when due_at is strictly before local midnight today. */
export function isTaskPastDue(dueAt: string | null | undefined, now = new Date()): boolean {
  if (!dueAt) return false;
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return false;
  return t < Date.parse(startOfLocalDayIso(now));
}

export function isTaskDueToday(dueAt: string | null | undefined, now = new Date()): boolean {
  return isTaskDueOnOrBeforeToday(dueAt, now) && !isTaskPastDue(dueAt, now);
}

export function lifecycleInputFromSnap(
  snap: Pick<
    CounsellorWorkbenchStudentSnap,
    "hasAssessment" | "hasConsent" | "signupFeeStatus" | "openFeeRequestStatus" | "handoverStatus"
  >,
): CounsellorLifecycleInput {
  return {
    hasSavedAssessment: snap.hasAssessment,
    hasConsent: snap.hasConsent,
    signupFeeStatus: snap.signupFeeStatus,
    openFeeRequestStatus: snap.openFeeRequestStatus,
    handoverStatus: snap.handoverStatus,
  };
}

/** True when the counsellor (not another team) must act next. */
export function counsellorHasActionableNext(input: CounsellorLifecycleInput): boolean {
  const next = resolveCounsellorLifecycleNext(input);
  if (
    next.stepId === "await_fee_decision" ||
    next.stepId === "with_admission" ||
    next.stepId === "done"
  ) {
    return false;
  }
  return next.primaryAction !== "none" || next.stepId === "forward_admission";
}

export function urgencyGroupFromPriority(priority: number): CounsellorAttentionUrgency {
  if (priority <= 1) return "critical";
  if (priority <= 2) return "high";
  return "normal";
}

export function profileTabForAttentionKind(kind: CounsellorAttentionItem["kind"]): ProfileTabId {
  switch (kind) {
    case "document":
      return "documents";
    case "task":
      return "overview";
    case "handover":
      return "applications";
    case "fee":
      return "assessment";
    case "lifecycle":
    default:
      return "assessment";
  }
}

export function primaryActionLabelForAttentionKind(
  kind: CounsellorAttentionItem["kind"],
  lifecycleLabel: string | null,
): string {
  switch (kind) {
    case "document":
      return "Review documents";
    case "task":
      return "Open tasks";
    case "handover":
      return "Review handover";
    case "fee":
      return "Correct fee request";
    case "lifecycle":
      return lifecycleLabel?.trim() || "Open record";
    default:
      return "Open record";
  }
}

function studentNeedsCounsellorAction(s: CounsellorWorkbenchStudentSnap): boolean {
  if (counsellorHasActionableNext(lifecycleInputFromSnap(s))) return true;
  if (s.hasOverdueTask || s.hasDueTodayTask) return true;
  if (s.docsPendingReview > 0) return true;
  if ((s.handoverStatus ?? "").toLowerCase() === "returned") return true;
  if ((s.openFeeRequestStatus ?? "").toLowerCase() === "cancelled") return true;
  return false;
}

export function computeCounsellorWorkbenchMetrics(input: {
  students: CounsellorWorkbenchStudentSnap[];
  applicationsInProgressCount: number;
  followUpsDueCount: number;
  docsToReviewCount: number;
  deadlinesThisWeekCount: number;
}): CounsellorWorkbenchMetrics {
  const assignedStudents = input.students.length;
  const awaitingInitialAssessment = input.students.filter((s) => !s.hasAssessment).length;
  const counsellingCompleted = input.students.filter((s) => s.hasConsent).length;

  const awaitingIds = new Set<string>();
  for (const s of input.students) {
    const fee = (s.openFeeRequestStatus ?? "").toLowerCase();
    const hand = (s.handoverStatus ?? "").toLowerCase();
    if (fee === "open" || fee === "in_progress" || hand === "submitted") {
      awaitingIds.add(s.id);
    }
  }

  const actionIds = new Set<string>();
  for (const s of input.students) {
    if (studentNeedsCounsellorAction(s)) actionIds.add(s.id);
  }

  return {
    assignedStudents,
    awaitingInitialAssessment,
    counsellingCompleted,
    followUpsDue: input.followUpsDueCount,
    applicationsInProgress: input.applicationsInProgressCount,
    awaitingResponse: awaitingIds.size,
    actionRequired: actionIds.size,
    docsToReview: input.docsToReviewCount,
    deadlinesThisWeek: input.deadlinesThisWeekCount,
  };
}

export function buildCounsellorAttentionItems(
  students: CounsellorWorkbenchStudentSnap[],
  limit = 10,
): CounsellorAttentionItem[] {
  const items: CounsellorAttentionItem[] = [];

  for (const s of students) {
    const life = lifecycleInputFromSnap(s);
    const next = resolveCounsellorLifecycleNext(life);
    const workflowStatus = s.stageLabel || next.title;

    if ((s.handoverStatus ?? "").toLowerCase() === "returned") {
      const kind = "handover" as const;
      items.push({
        id: `hand-ret-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind,
        title: "Admission returned the case",
        detail: next.body,
        priority: 1,
        at: s.lastActivity,
        urgencyGroup: urgencyGroupFromPriority(1),
        workflowStatus,
        nextResponsibleRole: "Counsellor",
        primaryActionLabel: primaryActionLabelForAttentionKind(kind, next.primaryLabel),
        profileTab: profileTabForAttentionKind(kind),
      });
    } else if ((s.openFeeRequestStatus ?? "").toLowerCase() === "cancelled") {
      const kind = "fee" as const;
      items.push({
        id: `fee-corr-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind,
        title: "Fee verification needs correction",
        detail: "Front Desk returned the fee-verification request.",
        priority: 2,
        at: s.lastActivity,
        urgencyGroup: urgencyGroupFromPriority(2),
        workflowStatus,
        nextResponsibleRole: "Counsellor",
        primaryActionLabel: primaryActionLabelForAttentionKind(kind, next.primaryLabel),
        profileTab: profileTabForAttentionKind(kind),
      });
    } else if (counsellorHasActionableNext(life)) {
      const kind = "lifecycle" as const;
      const priority =
        next.stepId === "complete_assessment" || next.stepId === "record_consent" ? 3 : 4;
      items.push({
        id: `life-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind,
        title: next.title,
        detail: next.body,
        priority,
        at: s.lastActivity,
        urgencyGroup: urgencyGroupFromPriority(priority),
        workflowStatus,
        nextResponsibleRole: "Counsellor",
        primaryActionLabel: primaryActionLabelForAttentionKind(kind, next.primaryLabel),
        profileTab: profileTabForAttentionKind(kind),
      });
    }

    if (s.hasOverdueTask || s.hasDueTodayTask) {
      const kind = "task" as const;
      const priority = s.hasOverdueTask ? 2 : 3;
      items.push({
        id: `task-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind,
        title: s.hasOverdueTask ? "Overdue follow-up task" : "Follow-up task due today",
        detail: s.hasOverdueTask
          ? "An open task for this student is past due."
          : "An open task for this student is due today.",
        priority,
        at: s.lastActivity,
        urgencyGroup: urgencyGroupFromPriority(priority),
        workflowStatus,
        nextResponsibleRole: "Counsellor",
        primaryActionLabel: primaryActionLabelForAttentionKind(kind, null),
        profileTab: profileTabForAttentionKind(kind),
      });
    }

    if (s.docsPendingReview > 0) {
      const kind = "document" as const;
      items.push({
        id: `doc-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind,
        title: "Documents awaiting review",
        detail: `${s.docsPendingReview} document${s.docsPendingReview === 1 ? "" : "s"} pending review.`,
        priority: 5,
        at: s.lastActivity,
        urgencyGroup: urgencyGroupFromPriority(5),
        workflowStatus,
        nextResponsibleRole: "Counsellor",
        primaryActionLabel: primaryActionLabelForAttentionKind(kind, null),
        profileTab: profileTabForAttentionKind(kind),
      });
    }
  }

  // One primary item per student (highest priority).
  const byStudent = new Map<string, CounsellorAttentionItem>();
  for (const item of items.sort((a, b) => a.priority - b.priority || b.at.localeCompare(a.at))) {
    if (!byStudent.has(item.studentId)) byStudent.set(item.studentId, item);
  }

  return [...byStudent.values()]
    .sort((a, b) => a.priority - b.priority || b.at.localeCompare(a.at))
    .slice(0, limit);
}

export function resolveCounsellorNotificationHref(input: {
  linkPath: string | null | undefined;
  studentId: string | null | undefined;
}): string {
  const studentId = input.studentId?.trim();
  if (studentId) {
    return `/staff/students/${studentId}`;
  }
  const path = (input.linkPath ?? "").trim();
  if (!path) return "/staff/dashboard";
  if (path.startsWith("/staff/students")) {
    return path.split("?")[0] || "/staff/students";
  }
  if (
    path.startsWith("/staff/dashboard") ||
    path.startsWith("/staff/applications") ||
    path.startsWith("/staff/documents") ||
    path.startsWith("/staff/tasks") ||
    path.startsWith("/staff/appointments")
  ) {
    return path.split("?")[0] || "/staff/dashboard";
  }
  // FD/finance paths are not counsellor CRM homes — land on dashboard.
  return "/staff/dashboard";
}

export function nextActionLabelForSnap(snap: CounsellorWorkbenchStudentSnap): string {
  return resolveCounsellorLifecycleNext(lifecycleInputFromSnap(snap)).title;
}

export function attentionKindLabel(kind: string): string {
  switch (kind) {
    case "handover":
      return "Handover";
    case "fee":
      return "Fee";
    case "task":
      return "Task";
    case "document":
      return "Documents";
    case "lifecycle":
      return "Lifecycle";
    default:
      return "Action";
  }
}

export function attentionUrgencyLabel(group: string): string {
  switch (group) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    default:
      return "Normal";
  }
}

/** Dashboard KPI selection — filters workspace panels; null = show all. */
export type CounsellorKpiFilter =
  | "assigned"
  | "awaiting_assessment"
  | "consent_recorded"
  | "follow_ups"
  | "apps_in_progress"
  | "awaiting_response"
  | "action_required";

export type AttentionListFilter = "all" | "urgent" | "today";

export type CounsellorCaseFilterSnap = Pick<
  CounsellorWorkbenchStudentSnap,
  | "hasAssessment"
  | "hasConsent"
  | "signupFeeStatus"
  | "openFeeRequestStatus"
  | "handoverStatus"
  | "hasOverdueTask"
  | "hasDueTodayTask"
  | "docsPendingReview"
>;

/** True when due_at falls on the local calendar day of `at` (or is overdue for "today" urgency). */
export function attentionMatchesListFilter(
  item: { urgencyGroup?: string | null; at: string; kind: string },
  filter: AttentionListFilter,
  now = new Date(),
): boolean {
  if (filter === "all") return true;
  if (filter === "urgent") {
    return item.urgencyGroup === "critical" || item.urgencyGroup === "high";
  }
  // Today: updated today, or task/lifecycle items that are due-oriented (overdue/due today urgency).
  const start = Date.parse(startOfLocalDayIso(now));
  const end = Date.parse(endOfLocalDayIso(now));
  const at = Date.parse(item.at);
  if (!Number.isNaN(at) && at >= start && at <= end) return true;
  return item.urgencyGroup === "critical" || item.urgencyGroup === "high";
}

export function studentMatchesKpiFilter(
  snap: CounsellorCaseFilterSnap,
  filter: CounsellorKpiFilter | null,
): boolean {
  if (!filter || filter === "assigned") return true;
  if (filter === "awaiting_assessment") return !snap.hasAssessment;
  if (filter === "consent_recorded") return snap.hasConsent;
  if (filter === "follow_ups") return snap.hasOverdueTask || snap.hasDueTodayTask;
  if (filter === "awaiting_response") {
    const fee = (snap.openFeeRequestStatus ?? "").toLowerCase();
    const hand = (snap.handoverStatus ?? "").toLowerCase();
    return fee === "open" || fee === "in_progress" || hand === "submitted";
  }
  if (filter === "action_required") return studentNeedsCounsellorAction(snap as CounsellorWorkbenchStudentSnap);
  if (filter === "apps_in_progress") return false; // apps live on applications route, not student snaps
  return true;
}

export function attentionMatchesKpiFilter(
  item: { kind: string; title: string },
  snap: CounsellorCaseFilterSnap | undefined,
  filter: CounsellorKpiFilter | null,
): boolean {
  if (!filter || filter === "assigned") return true;
  if (filter === "follow_ups") return item.kind === "task";
  if (filter === "apps_in_progress") return false;
  if (snap) return studentMatchesKpiFilter(snap, filter);
  if (filter === "awaiting_assessment") {
    return item.kind === "lifecycle" && /assessment/i.test(item.title);
  }
  if (filter === "consent_recorded") return false;
  if (filter === "awaiting_response") {
    return item.kind === "fee" || item.kind === "handover" || /admission|front desk|accounts/i.test(item.title);
  }
  if (filter === "action_required") return true;
  return true;
}

/** Where the attention primary action should navigate. */
export function resolveAttentionOpenTarget(item: {
  kind: string;
  studentId: string;
  profileTab?: string | null | undefined;
}):
  | { to: "/staff/tasks" }
  | {
      to: "/staff/students/$studentId";
      params: { studentId: string };
      search: { tab: ProfileTabId };
    } {
  if (item.kind === "task") {
    return { to: "/staff/tasks" };
  }
  if (item.kind === "document") {
    return {
      to: "/staff/students/$studentId",
      params: { studentId: item.studentId },
      search: { tab: "documents" },
    };
  }
  const kind = item.kind as CounsellorAttentionItem["kind"];
  const tab = (item.profileTab ?? profileTabForAttentionKind(kind)) as ProfileTabId;
  return {
    to: "/staff/students/$studentId",
    params: { studentId: item.studentId },
    search: { tab },
  };
}

/** Compact header line: today's priority counts from live metrics. */
export function buildCounsellorPrioritySummary(m: {
  actionRequired: number;
  followUpsDue: number;
  awaitingInitialAssessment: number;
  awaitingResponse: number;
}): string {
  const parts: string[] = [];
  if (m.actionRequired > 0) {
    parts.push(`${m.actionRequired} need${m.actionRequired === 1 ? "s" : ""} action`);
  }
  if (m.followUpsDue > 0) {
    parts.push(`${m.followUpsDue} follow-up${m.followUpsDue === 1 ? "" : "s"} due`);
  }
  if (m.awaitingInitialAssessment > 0) {
    parts.push(`${m.awaitingInitialAssessment} awaiting assessment`);
  }
  if (m.awaitingResponse > 0) {
    parts.push(`${m.awaitingResponse} awaiting response`);
  }
  if (!parts.length) return "No urgent priorities today";
  return parts.slice(0, 3).join(" · ");
}
