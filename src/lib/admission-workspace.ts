/**
 * Admission Team Workbench helpers — KPIs, attention items, next actions.
 * Application stages stay distinct from document status, offers, and handovers.
 * Student registration alone never counts as an application.
 */
import {
  APPLICATION_PIPELINE_STAGES,
  type ApplicationPipelineStage,
} from "@/types/applications-pipeline";

export const ADMISSION_METRIC_DEFINITIONS = {
  assignedToMe:
    "Applications where owned_by_consultant_id is the logged-in desk, among students visible via assignment or admission handover.",
  awaitingInitialReview:
    "Students with admission_handovers.status = submitted (awaiting Accept/Return), not application.stage.",
  documentsMissing:
    "Pipeline applications at Docs Pending, or students with documents in needs_correction / awaiting_upload (where visible).",
  inProgress:
    "Applications in Under Review or Ready to Submit (active processing; excludes Docs Pending and Submitted+).",
  returnedForCorrection:
    "Students with latest admission_handovers.status = returned (handover return — not an application stage).",
  submittedToUniversity: "Applications with stage Submitted.",
  offersDecisionsReceived:
    "Applications with stage Offer Received (offer/decision recorded on the application pipeline).",
  depositCasPending:
    "Deposits with status due/overdue, or CAS/I-20 records still pending or requested.",
  visaInProgress: "Visa milestones that have not reached a final decision (approved/refused).",
  overdueTasks: "Open desk tasks past due (local calendar day).",
  refusedRejected: "Applications at terminal outcome Rejected.",
  actionRequired:
    "Distinct students/apps needing Admission action: submitted handovers, Docs Pending apps, deadline ≤7 days, or docs needing correction.",
} as const;

/** Short UI hints for StatCards — keep long definitions in tooltips only. */
export const ADMISSION_METRIC_HINTS = {
  assignedToMe: "Apps owned by your desk",
  awaitingInitialReview: "Handovers awaiting accept/return",
  documentsMissing: "Docs pending or incomplete",
  inProgress: "Under review or ready to submit",
  returnedForCorrection: "Returned to counsellor",
  submittedToUniversity: "Submitted stage",
  offersDecisionsReceived: "Offer received stage",
  depositCasPending: "Deposit due or CAS/I-20 pending",
  visaInProgress: "Visa filing not yet decided",
  overdueTasks: "Tasks past due",
  refusedRejected: "Rejected applications",
  actionRequired: "Cases needing your next step",
} as const;

export type AdmissionAppSnap = {
  id: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  university: string;
  program: string;
  stage: string;
  officerId: string;
  deadline: string;
  daysLeft: number | null;
  deadlineWarning: boolean;
};

export type AdmissionHandoverSnap = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentCaseId: string | null;
  status: string;
  summary: string | null;
  missingInformation: string | null;
  handedOverAt: string;
  toOwnerId: string | null;
};

export type AdmissionDocSnap = {
  studentId: string;
  status: string;
};

export type AdmissionAttentionItem = {
  id: string;
  studentId: string;
  applicationId: string | null;
  caseId: string;
  fullName: string;
  kind: "handover" | "docs" | "deadline" | "stage";
  title: string;
  detail: string;
  priority: number;
  at: string;
};

export type AdmissionDepositSnap = { studentId: string; status: string };
export type AdmissionCasSnap = { studentId: string; status: string };
export type AdmissionVisaSnap = { studentId: string; stage: string; decision: string | null };

export type AdmissionWorkbenchMetrics = {
  assignedToMe: number;
  awaitingInitialReview: number;
  documentsMissing: number;
  inProgress: number;
  returnedForCorrection: number;
  submittedToUniversity: number;
  offersDecisionsReceived: number;
  depositCasPending: number;
  visaInProgress: number;
  overdueTasks: number;
  refusedRejected: number;
  actionRequired: number;
  upcomingDeadlines: number;
  /** Real pipeline strip — uses existing stages / visa records only. */
  pipeline: {
    assigned: number;
    submitted: number;
    offers: number;
    visa: number;
    refused: number;
  };
};

export function isAdmissionInProgressStage(stage: string): boolean {
  return stage === "Under Review" || stage === "Ready to Submit";
}

export function deriveAdmissionNextAction(input: {
  stage: string;
  handoverStatus: string | null;
  docsNeedingAttention: boolean;
  deadlineWarning: boolean;
}): { label: string; priority: number } {
  const hand = (input.handoverStatus ?? "").toLowerCase();
  if (hand === "submitted") {
    return { label: "Review counsellor handover — Accept or Return", priority: 1 };
  }
  if (input.docsNeedingAttention || input.stage === "Docs Pending") {
    return { label: "Complete document checks before review", priority: 2 };
  }
  if (input.stage === "Under Review") {
    return { label: "Finish initial review / move to Ready to Submit", priority: 3 };
  }
  if (input.stage === "Ready to Submit") {
    return { label: "Submit application to university when ready", priority: 4 };
  }
  if (input.deadlineWarning) {
    return { label: "Deadline approaching — prioritise this application", priority: 2 };
  }
  if (input.stage === "Submitted") {
    return { label: "Await university response / update when decided", priority: 5 };
  }
  if (input.stage === "Offer Received") {
    return { label: "Record offer follow-up on Offers workspace", priority: 5 };
  }
  if (hand === "returned") {
    return { label: "Returned to counsellor — waiting for resubmission", priority: 6 };
  }
  return { label: "No Admission action required", priority: 99 };
}

export function computeAdmissionWorkbenchMetrics(input: {
  viewerUserId: string | null;
  applications: AdmissionAppSnap[];
  handovers: AdmissionHandoverSnap[];
  documents: AdmissionDocSnap[];
  deposits?: AdmissionDepositSnap[];
  casRecords?: AdmissionCasSnap[];
  visas?: AdmissionVisaSnap[];
  overdueTaskCount?: number;
}): AdmissionWorkbenchMetrics {
  const apps = input.applications;
  const assignedToMe = input.viewerUserId
    ? apps.filter((a) => a.officerId === input.viewerUserId).length
    : 0;

  const submittedHandovers = input.handovers.filter((h) => h.status === "submitted");
  const returnedHandovers = input.handovers.filter((h) => h.status === "returned");

  const docsAttentionStudents = new Set(
    input.documents
      .filter((d) => {
        const s = d.status.toLowerCase();
        return (
          s === "needs_correction" ||
          s === "needs correction" ||
          s === "awaiting_upload" ||
          s === "pending review" ||
          s === "pending_review"
        );
      })
      .map((d) => d.studentId),
  );

  const documentsMissing = new Set([
    ...apps.filter((a) => a.stage === "Docs Pending").map((a) => a.studentId),
    ...docsAttentionStudents,
  ]).size;

  const inProgress = apps.filter((a) => isAdmissionInProgressStage(a.stage)).length;
  const submittedToUniversity = apps.filter((a) => a.stage === "Submitted").length;
  const offersDecisionsReceived = apps.filter((a) => a.stage === "Offer Received").length;
  const refusedRejected = apps.filter((a) => a.stage === "Rejected").length;
  const upcomingDeadlines = apps.filter(
    (a) => a.deadlineWarning || (a.daysLeft != null && a.daysLeft >= 0 && a.daysLeft <= 7),
  ).length;

  const depositPendingStudents = new Set(
    (input.deposits ?? [])
      .filter((d) => {
        const s = d.status.toLowerCase();
        return s === "due" || s === "overdue";
      })
      .map((d) => d.studentId),
  );
  const casPendingStudents = new Set(
    (input.casRecords ?? [])
      .filter((c) => {
        const s = c.status.toLowerCase();
        return s === "pending" || s === "requested";
      })
      .map((c) => c.studentId),
  );
  const depositCasPending = new Set([...depositPendingStudents, ...casPendingStudents]).size;

  const visaInProgress = (input.visas ?? []).filter((v) => {
    const decision = (v.decision ?? "").toLowerCase();
    return decision !== "approved" && decision !== "refused";
  }).length;

  const overdueTasks = Math.max(0, input.overdueTaskCount ?? 0);

  const actionIds = new Set<string>();
  for (const h of submittedHandovers) actionIds.add(h.studentId);
  for (const a of apps) {
    if (a.stage === "Docs Pending") actionIds.add(a.studentId);
    if (a.deadlineWarning) actionIds.add(a.studentId);
  }
  for (const id of docsAttentionStudents) actionIds.add(id);
  for (const id of depositPendingStudents) actionIds.add(id);
  for (const id of casPendingStudents) actionIds.add(id);

  return {
    assignedToMe,
    awaitingInitialReview: submittedHandovers.length,
    documentsMissing,
    inProgress,
    returnedForCorrection: returnedHandovers.length,
    submittedToUniversity,
    offersDecisionsReceived,
    depositCasPending,
    visaInProgress,
    overdueTasks,
    refusedRejected,
    actionRequired: actionIds.size,
    upcomingDeadlines,
    pipeline: {
      assigned: assignedToMe,
      submitted: submittedToUniversity,
      offers: offersDecisionsReceived,
      visa: visaInProgress,
      refused: refusedRejected,
    },
  };
}

export function buildAdmissionAttentionItems(input: {
  applications: AdmissionAppSnap[];
  handovers: AdmissionHandoverSnap[];
  limit?: number;
}): AdmissionAttentionItem[] {
  const limit = input.limit ?? 12;
  const items: AdmissionAttentionItem[] = [];
  const handoverByStudent = new Map<string, AdmissionHandoverSnap>();
  for (const h of input.handovers) {
    if (!handoverByStudent.has(h.studentId)) handoverByStudent.set(h.studentId, h);
  }

  for (const h of input.handovers) {
    if (h.status !== "submitted") continue;
    items.push({
      id: `hand-${h.id}`,
      studentId: h.studentId,
      applicationId: null,
      caseId: h.studentCaseId ?? "",
      fullName: h.studentName ?? "Student",
      kind: "handover",
      title: "Counsellor handover awaiting review",
      detail: h.summary || "Accept to take ownership or return with notes.",
      priority: 1,
      at: h.handedOverAt,
    });
  }

  for (const a of input.applications) {
    const hand = handoverByStudent.get(a.studentId);
    if (a.deadlineWarning) {
      items.push({
        id: `dl-${a.id}`,
        studentId: a.studentId,
        applicationId: a.id,
        caseId: a.studentCaseId,
        fullName: a.studentName,
        kind: "deadline",
        title: `Deadline in ${a.daysLeft ?? "?"} day(s)`,
        detail: `${a.university} · ${a.program}`,
        priority: 2,
        at: a.deadline || "",
      });
    }
    if (a.stage === "Docs Pending") {
      items.push({
        id: `docs-${a.id}`,
        studentId: a.studentId,
        applicationId: a.id,
        caseId: a.studentCaseId,
        fullName: a.studentName,
        kind: "docs",
        title: "Documents pending for application",
        detail: `${a.university} · ${a.program}`,
        priority: 3,
        at: a.deadline || "",
      });
    }
    const next = deriveAdmissionNextAction({
      stage: a.stage,
      handoverStatus: hand?.status ?? null,
      docsNeedingAttention: a.stage === "Docs Pending",
      deadlineWarning: a.deadlineWarning,
    });
    if (next.priority <= 4 && a.stage === "Under Review") {
      items.push({
        id: `rev-${a.id}`,
        studentId: a.studentId,
        applicationId: a.id,
        caseId: a.studentCaseId,
        fullName: a.studentName,
        kind: "stage",
        title: next.label,
        detail: `${a.university} · ${a.program}`,
        priority: next.priority,
        at: a.deadline || "",
      });
    }
  }

  const byKey = new Map<string, AdmissionAttentionItem>();
  for (const item of items.sort((a, b) => a.priority - b.priority)) {
    const key = item.applicationId ?? `stu-${item.studentId}`;
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.values()].slice(0, limit);
}

/** Deep-link focus values for /staff/applications (handover queue vs app stages). */
export type AdmissionApplicationsFocus =
  "docs" | "in_progress" | "submitted" | "offers" | "action" | "handovers" | "returned";

export function resolveAdmissionNotificationHref(input: {
  linkPath: string | null | undefined;
  studentId: string | null | undefined;
}): string {
  const raw = (input.linkPath ?? "").trim();
  const [pathPart, queryPart = ""] = raw.split("?");
  const basePath = pathPart || "";
  const studentId = input.studentId?.trim();
  const existing = new URLSearchParams(queryPart);
  const withParams = (path: string, extras?: { focus?: AdmissionApplicationsFocus }) => {
    const params = new URLSearchParams(existing.toString());
    if (extras?.focus && !params.has("focus")) params.set("focus", extras.focus);
    if (studentId && !params.has("studentId")) params.set("studentId", studentId);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  if (basePath.startsWith("/staff/documents")) {
    return withParams("/staff/documents");
  }
  if (basePath.startsWith("/staff/offers")) {
    return withParams("/staff/offers");
  }
  if (basePath.startsWith("/staff/tasks")) {
    return withParams("/staff/tasks");
  }
  if (basePath.startsWith("/staff/finance")) {
    return withParams("/staff/finance");
  }
  if (basePath.startsWith("/staff/students/") && studentId) {
    return `/staff/students/${studentId}?tab=applications`;
  }
  if (basePath.startsWith("/staff/students") && studentId) {
    return `/staff/students/${studentId}?tab=applications`;
  }
  if (basePath.startsWith("/staff/applications")) {
    const focus = (existing.get("focus") as AdmissionApplicationsFocus | null) ?? "handovers";
    return withParams("/staff/applications", { focus });
  }
  if (studentId) {
    return withParams("/staff/applications", { focus: "handovers" });
  }
  if (basePath.startsWith("/staff/dashboard")) return "/staff/dashboard";
  return "/staff/applications";
}

/** Human-readable handover status for staff UI (aligned with DB enum). */
export function formatAdmissionHandoverStatusLabel(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "submitted") return "Sent to Admission";
  if (s === "accepted") return "Received by Admission";
  if (s === "returned") return "Returned for Clarification";
  return status?.trim() || "—";
}

export function pipelineStageLabels(): { key: ApplicationPipelineStage; label: string }[] {
  return APPLICATION_PIPELINE_STAGES.map((s) => ({ key: s.key, label: s.label }));
}

/** Short display ref — prefer portal_ref when present; never invent business IDs. */
export function formatApplicationRef(input: { id: string; portalRef?: string | null }): string {
  const ref = (input.portalRef ?? "").trim();
  if (ref) return ref;
  return input.id.length > 8 ? `${input.id.slice(0, 8)}…` : input.id;
}
