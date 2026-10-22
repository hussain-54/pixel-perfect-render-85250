/**
 * Counsellor Workbench helpers — KPIs, attention queue, notification deep links.
 * Metrics use only persisted artefacts (agreements, tasks, apps, handovers, fee requests).
 * Registration alone never counts as counselling completed (no counselling_sessions table).
 */
import {
  resolveCounsellorLifecycleNext,
  type CounsellorLifecycleInput,
} from "@/lib/counsellor-lifecycle-next";

/** Documented definitions for dashboard KPI cards (product + audit). */
export const COUNSELLOR_METRIC_DEFINITIONS = {
  assignedStudents:
    "Non-archived students currently assigned to the logged-in counsellor desk (assigned_consultant_id).",
  counsellingCompleted:
    "Assigned students with at least one counselling_agreements row where consented = true. Not a full session history; registration alone does not count.",
  followUpsDue:
    "Open or in-progress tasks for this desk (assignee or assigned student) with due_at on or before end of today.",
  applicationsInProgress:
    "Applications for assigned students in Docs Pending, Under Review, Ready to Submit, or Submitted (UI stages).",
  awaitingResponse:
    "Distinct assigned students awaiting Admission (handover status submitted) and/or Front Desk/Finance (fee-verification request open or in_progress).",
  actionRequired:
    "Distinct assigned students where the counsellor has an actionable lifecycle next step, a returned handover, a cancelled fee request, an overdue task, or a document pending review.",
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
  hasOverdueTask: boolean;
};

export type CounsellorAttentionItem = {
  id: string;
  studentId: string;
  caseId: string;
  fullName: string;
  kind: "lifecycle" | "task" | "document" | "handover" | "fee";
  title: string;
  detail: string;
  priority: number;
  at: string;
};

export type CounsellorWorkbenchMetrics = {
  assignedStudents: number;
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

export function isTaskDueOnOrBeforeToday(
  dueAt: string | null | undefined,
  now = new Date(),
): boolean {
  if (!dueAt) return false;
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.parse(endOfLocalDayIso(now));
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

export function computeCounsellorWorkbenchMetrics(input: {
  students: CounsellorWorkbenchStudentSnap[];
  applicationsInProgressCount: number;
  followUpsDueCount: number;
  docsToReviewCount: number;
  deadlinesThisWeekCount: number;
}): CounsellorWorkbenchMetrics {
  const assignedStudents = input.students.length;
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
    if (counsellorHasActionableNext(lifecycleInputFromSnap(s))) actionIds.add(s.id);
    if (s.hasOverdueTask) actionIds.add(s.id);
    if (s.docsPendingReview > 0) actionIds.add(s.id);
    if ((s.handoverStatus ?? "").toLowerCase() === "returned") actionIds.add(s.id);
    if ((s.openFeeRequestStatus ?? "").toLowerCase() === "cancelled") actionIds.add(s.id);
  }

  return {
    assignedStudents,
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

    if ((s.handoverStatus ?? "").toLowerCase() === "returned") {
      items.push({
        id: `hand-ret-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind: "handover",
        title: "Admission returned the case",
        detail: next.body,
        priority: 1,
        at: s.lastActivity,
      });
    } else if ((s.openFeeRequestStatus ?? "").toLowerCase() === "cancelled") {
      items.push({
        id: `fee-corr-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind: "fee",
        title: "Fee verification needs correction",
        detail: "Front Desk returned the fee-verification request.",
        priority: 2,
        at: s.lastActivity,
      });
    } else if (counsellorHasActionableNext(life)) {
      items.push({
        id: `life-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind: "lifecycle",
        title: next.title,
        detail: next.body,
        priority: next.stepId === "complete_assessment" || next.stepId === "record_consent" ? 3 : 4,
        at: s.lastActivity,
      });
    }

    if (s.hasOverdueTask) {
      items.push({
        id: `task-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind: "task",
        title: "Overdue follow-up task",
        detail: "An open task for this student is past due.",
        priority: 2,
        at: s.lastActivity,
      });
    }

    if (s.docsPendingReview > 0) {
      items.push({
        id: `doc-${s.id}`,
        studentId: s.id,
        caseId: s.caseId,
        fullName: s.name,
        kind: "document",
        title: "Documents awaiting review",
        detail: `${s.docsPendingReview} document${s.docsPendingReview === 1 ? "" : "s"} pending review.`,
        priority: 5,
        at: s.lastActivity,
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
