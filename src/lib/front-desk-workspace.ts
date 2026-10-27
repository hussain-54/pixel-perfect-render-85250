/**
 * Front Desk workspace helpers — KPIs, next actions, and FD-safe timelines.
 * Uses only fields already returned by Front Desk intake / fee-request RPCs.
 * Does not invent application decisions or merge fee/journey/request into one status.
 */
import { journeyStageRank } from "@/lib/journey-stage";
import {
  requestStuckAfterFeeDecision,
  signupFeeIsTerminalDecision,
} from "@/lib/fee-verification-workflow";
import { describePersistedSignupFeeStatus } from "@/lib/registration-form-a4";

export type FrontDeskWorkflowKind =
  "registration" | "counsellor" | "signup_fee" | "fee_verification" | "journey" | "portal";

export type FrontDeskTimelineItem = {
  id: string;
  kind: FrontDeskWorkflowKind;
  title: string;
  detail?: string;
  at: string;
};

export type FrontDeskNextAction = {
  code:
    | "assign_counsellor"
    | "forward_fee_request"
    | "await_finance"
    | "sync_fee_request"
    | "return_or_correct"
    | "none";
  label: string;
  priority: number;
};

export type FrontDeskAttentionItem = {
  id: string;
  studentId: string;
  caseId: string;
  fullName: string;
  kind: "unassigned" | "fee_open" | "fee_stuck" | "fee_correction";
  title: string;
  detail: string;
  at: string;
};

type IntakeLike = {
  id: string;
  caseId: string;
  fullName: string;
  counsellorName: string | null;
  assignmentStatus: "pending" | "assigned";
  signupFeeStatus: string | null;
  journeyStage: string;
  portalActivatedAt: string | null;
  profileId: string | null;
  createdAt: string;
  updatedAt: string;
  registrarName?: string | null;
};

type FeeReqLike = {
  id: string;
  studentId: string;
  caseId: string;
  fullName: string;
  status: string;
  signupFeeStatus: string | null;
  summary: string;
  coordinatorNote: string | null;
  forwardedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  feeVerifiedAt: string | null;
};

/** Journey stages at/after application work (students.journey_stage — not applications.stage). */
export function isJourneyApplicationInProgress(journeyStage: string | null | undefined): boolean {
  return journeyStageRank(journeyStage) >= journeyStageRank("application_submitted");
}

export function describeJourneyStageLabel(stage: string | null | undefined): string {
  const s = (stage ?? "").trim();
  if (!s) return "Unknown";
  return s.replaceAll("_", " ");
}

export function deriveFrontDeskNextAction(input: {
  assignmentStatus: "pending" | "assigned";
  signupFeeStatus: string | null | undefined;
  openFeeRequest?: Pick<FeeReqLike, "status" | "forwardedAt" | "signupFeeStatus"> | null;
}): FrontDeskNextAction {
  const req = input.openFeeRequest;
  if (req) {
    const stuck = requestStuckAfterFeeDecision({
      requestStatus: req.status,
      signupFeeStatus: req.signupFeeStatus ?? input.signupFeeStatus,
    });
    if (stuck) {
      return {
        code: "sync_fee_request",
        label: "Sync fee request from Accounts decision",
        priority: 1,
      };
    }
    if (req.status === "cancelled") {
      // Fee ledger is authoritative when a signup fee row already exists.
      const fee = (input.signupFeeStatus ?? req.signupFeeStatus ?? "").toLowerCase();
      if (
        fee === "unpaid" ||
        fee === "claimed" ||
        fee === "verified" ||
        fee === "waived" ||
        fee === "rejected"
      ) {
        // Fall through — cancelled coordination is historical, not the next action.
      } else {
        return {
          code: "return_or_correct",
          label: "Needs correction — follow up with counsellor",
          priority: 2,
        };
      }
    }
    if (req.status === "open" || (req.status === "in_progress" && !req.forwardedAt)) {
      return {
        code: "forward_fee_request",
        label: "Send fee verification to Accounts / Finance",
        priority: 2,
      };
    }
    if (req.status === "in_progress") {
      return {
        code: "await_finance",
        label: "Awaiting Finance verification",
        priority: 4,
      };
    }
  }

  if (input.assignmentStatus === "pending") {
    return {
      code: "assign_counsellor",
      label: "Assign counsellor",
      priority: 3,
    };
  }

  const fee = describePersistedSignupFeeStatus(input.signupFeeStatus);
  if (fee.isClaimedAwaitingFinance) {
    return {
      code: "await_finance",
      label: "Signup fee claimed — awaiting Finance",
      priority: 4,
    };
  }

  return { code: "none", label: "No Front Desk action required", priority: 99 };
}

export type FrontDeskDashboardMetrics = {
  totalRegistrations: number;
  awaitingCounsellor: number;
  assignedToCounsellors: number;
  /** Issued unpaid vouchers (not claimed yet). */
  unpaidVouchers: number;
  /** Payment proofs submitted — awaiting Finance (claimed only; not verified cash). */
  proofsAwaitingFinance: number;
  /** Combined unpaid + claimed for legacy callers. */
  feeVerification: number;
  verifiedFees: number;
  rejectedFees: number;
  /** Fee authorized (verified/waived) but portal not yet activated. */
  portalLinkPending: number;
  applicationsInProgress: number;
  actionRequired: number;
};

export function computeFrontDeskDashboardMetrics(input: {
  intakeRows: IntakeLike[];
  feeRequests: FeeReqLike[];
}): FrontDeskDashboardMetrics {
  const totalRegistrations = input.intakeRows.length;
  const awaitingCounsellor = input.intakeRows.filter(
    (r) => r.assignmentStatus === "pending",
  ).length;
  const assignedToCounsellors = input.intakeRows.filter(
    (r) => r.assignmentStatus === "assigned",
  ).length;
  const unpaidVouchers = input.intakeRows.filter(
    (r) => (r.signupFeeStatus ?? "").toLowerCase() === "unpaid",
  ).length;
  const proofsAwaitingFinance = input.intakeRows.filter(
    (r) => (r.signupFeeStatus ?? "").toLowerCase() === "claimed",
  ).length;
  const feeVerification = unpaidVouchers + proofsAwaitingFinance;
  const verifiedFees = input.intakeRows.filter(
    (r) => (r.signupFeeStatus ?? "").toLowerCase() === "verified",
  ).length;
  const rejectedFees = input.intakeRows.filter(
    (r) => (r.signupFeeStatus ?? "").toLowerCase() === "rejected",
  ).length;
  const portalLinkPending = input.intakeRows.filter((r) => {
    const fee = (r.signupFeeStatus ?? "").toLowerCase();
    if (fee !== "verified" && fee !== "waived") return false;
    return !r.portalActivatedAt;
  }).length;
  const applicationsInProgress = input.intakeRows.filter((r) =>
    isJourneyApplicationInProgress(r.journeyStage),
  ).length;

  const openOrStuckFeeIds = new Set<string>();
  for (const req of input.feeRequests) {
    // Cancelled coordination is historical — never drives actionable counts / Finance queues.
    if (req.status === "cancelled" || req.status === "resolved") continue;
    if (req.status === "open") {
      openOrStuckFeeIds.add(req.studentId);
      continue;
    }
    if (
      requestStuckAfterFeeDecision({
        requestStatus: req.status,
        signupFeeStatus: req.signupFeeStatus,
      })
    ) {
      openOrStuckFeeIds.add(req.studentId);
    }
  }
  const rejectedIds = input.intakeRows
    .filter((r) => (r.signupFeeStatus ?? "").toLowerCase() === "rejected")
    .map((r) => r.id);
  const unassignedIds = new Set(
    input.intakeRows.filter((r) => r.assignmentStatus === "pending").map((r) => r.id),
  );
  const actionRequired = new Set([...openOrStuckFeeIds, ...unassignedIds, ...rejectedIds]).size;

  return {
    totalRegistrations,
    awaitingCounsellor,
    assignedToCounsellors,
    unpaidVouchers,
    proofsAwaitingFinance,
    feeVerification,
    verifiedFees,
    rejectedFees,
    portalLinkPending,
    applicationsInProgress,
    actionRequired,
  };
}

/** Primary CTA label for a Front Desk next-action code. */
export function frontDeskNextActionCta(
  code: string,
): "Assign counsellor" | "Open record" | "Sync fee" | "Send to Finance" | "View" {
  switch (code) {
    case "assign_counsellor":
      return "Assign counsellor";
    case "sync_fee_request":
      return "Sync fee";
    case "forward_fee_request":
      return "Send to Finance";
    case "await_finance":
    case "return_or_correct":
      return "Open record";
    default:
      return "View";
  }
}

export function buildFrontDeskAttentionItems(input: {
  intakeRows: IntakeLike[];
  feeRequests: FeeReqLike[];
  limit?: number;
}): FrontDeskAttentionItem[] {
  const limit = input.limit ?? 12;
  const items: FrontDeskAttentionItem[] = [];

  for (const req of input.feeRequests) {
    const stuck = requestStuckAfterFeeDecision({
      requestStatus: req.status,
      signupFeeStatus: req.signupFeeStatus,
    });
    if (stuck) {
      items.push({
        id: `stuck-${req.id}`,
        studentId: req.studentId,
        caseId: req.caseId,
        fullName: req.fullName,
        kind: "fee_stuck",
        title: "Fee request out of sync",
        detail: "Accounts decided the fee; sync the counsellor request.",
        at: req.updatedAt || req.createdAt,
      });
      continue;
    }
    if (req.status === "open") {
      items.push({
        id: `open-${req.id}`,
        studentId: req.studentId,
        caseId: req.caseId,
        fullName: req.fullName,
        kind: "fee_open",
        title: "Fee verification awaiting Front Desk",
        detail: req.summary || "Counsellor requested signup-fee verification.",
        at: req.createdAt,
      });
      continue;
    }
    if (req.status === "cancelled") {
      const fee = (req.signupFeeStatus ?? "").toLowerCase();
      const feeExists =
        fee === "unpaid" ||
        fee === "claimed" ||
        fee === "verified" ||
        fee === "waived" ||
        fee === "rejected";
      items.push({
        id: `corr-${req.id}`,
        studentId: req.studentId,
        caseId: req.caseId,
        fullName: req.fullName,
        kind: "fee_correction",
        title: feeExists ? "Historical cancelled coordination" : "Fee request needs correction",
        detail: feeExists
          ? "Cancelled counsellor request — not a fee ledger row. Use Signup fee voucher status above."
          : req.coordinatorNote || req.summary || "Returned for counsellor correction.",
        at: req.updatedAt || req.createdAt,
      });
    }
  }

  const feeStudentIds = new Set(items.map((i) => i.studentId));
  for (const row of input.intakeRows) {
    if (row.assignmentStatus !== "pending") continue;
    if (feeStudentIds.has(row.id)) continue;
    items.push({
      id: `unassigned-${row.id}`,
      studentId: row.id,
      caseId: row.caseId,
      fullName: row.fullName,
      kind: "unassigned",
      title: "Awaiting counsellor assignment",
      detail: "Registration is complete; assign a counsellor desk.",
      at: row.updatedAt || row.createdAt,
    });
  }

  items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return items.slice(0, limit);
}

/**
 * Build a readable timeline from authorized Front Desk data only.
 * Keeps registration, counsellor, signup fee, fee-verification, and journey distinct.
 */
export function buildFrontDeskRecordTimeline(input: {
  student: IntakeLike;
  feeRequests: FeeReqLike[];
}): FrontDeskTimelineItem[] {
  const s = input.student;
  const items: FrontDeskTimelineItem[] = [];

  items.push({
    id: "reg-created",
    kind: "registration",
    title: "Registration created",
    ...(s.registrarName ? { detail: `Recorded by ${s.registrarName}` } : {}),
    at: s.createdAt,
  });

  if (s.assignmentStatus === "assigned") {
    items.push({
      id: "counsellor-assigned",
      kind: "counsellor",
      title: "Counsellor assigned",
      detail: s.counsellorName || "Counsellor assigned",
      at: s.updatedAt,
    });
  }

  const feeStatus = (s.signupFeeStatus ?? "").toLowerCase();
  if (feeStatus && feeStatus !== "unpaid") {
    const feeLabel = describePersistedSignupFeeStatus(s.signupFeeStatus).label;
    items.push({
      id: `fee-${feeStatus}`,
      kind: "signup_fee",
      title: `Signup fee: ${feeLabel}`,
      detail: signupFeeIsTerminalDecision(s.signupFeeStatus)
        ? "Accounts decision (verify / waive / reject) — not a Front Desk action."
        : "Claim recorded; Finance verification still required for activation gates.",
      at: s.updatedAt,
    });
  }

  for (const req of input.feeRequests) {
    items.push({
      id: `fvr-created-${req.id}`,
      kind: "fee_verification",
      title: "Counsellor fee-verification request",
      ...(req.summary ? { detail: req.summary } : {}),
      at: req.createdAt,
    });
    if (req.forwardedAt) {
      items.push({
        id: `fvr-fwd-${req.id}`,
        kind: "fee_verification",
        title: "Forwarded to Accounts / Finance",
        ...(req.coordinatorNote ? { detail: req.coordinatorNote } : {}),
        at: req.forwardedAt,
      });
    }
    if (req.feeVerifiedAt) {
      items.push({
        id: `fvr-fee-decided-${req.id}`,
        kind: "signup_fee",
        title: "Signup fee decision recorded",
        detail: describePersistedSignupFeeStatus(req.signupFeeStatus).label,
        at: req.feeVerifiedAt,
      });
    }
    if (req.resolvedAt) {
      items.push({
        id: `fvr-resolved-${req.id}`,
        kind: "fee_verification",
        title:
          req.status === "cancelled"
            ? "Historical: fee-verification request cancelled"
            : "Fee-verification request resolved",
        ...(req.status === "cancelled"
          ? {
              detail: [
                "Not a signup fee ledger row — excluded from Finance verification queue.",
                req.coordinatorNote || req.summary || null,
              ]
                .filter(Boolean)
                .join(" "),
            }
          : req.coordinatorNote
            ? { detail: req.coordinatorNote }
            : {}),
        at: req.resolvedAt,
      });
    } else if (req.status === "cancelled") {
      items.push({
        id: `fvr-cancelled-${req.id}`,
        kind: "fee_verification",
        title: "Historical: fee-verification request cancelled",
        detail: [
          "Not a signup fee ledger row — excluded from Finance verification queue.",
          req.coordinatorNote || req.summary || null,
        ]
          .filter(Boolean)
          .join(" "),
        at: req.updatedAt || req.createdAt,
      });
    }
  }

  if (s.profileId) {
    items.push({
      id: "portal-linked",
      kind: "portal",
      title: "Student portal login linked",
      detail: s.portalActivatedAt
        ? "Portal activated after fee authorization"
        : "Login linked; CRM activation still follows fee verification",
      at: s.portalActivatedAt || s.updatedAt,
    });
  }

  if (s.journeyStage && s.journeyStage !== "profile_submitted") {
    items.push({
      id: `journey-${s.journeyStage}`,
      kind: "journey",
      title: `Journey stage: ${describeJourneyStageLabel(s.journeyStage)}`,
      detail:
        "Student journey milestone (separate from signup fee and fee-verification request status).",
      at: s.updatedAt,
    });
  }

  items.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return items;
}

/** Map staff notification link to an FD-safe path when possible. */
export function resolveFrontDeskNotificationHref(input: {
  linkPath: string | null | undefined;
  studentId: string | null | undefined;
}): string {
  const studentId = input.studentId?.trim();
  if (studentId) {
    return `/staff/intake/${studentId}`;
  }
  const path = (input.linkPath ?? "").trim();
  if (!path) return "/staff/front-desk";
  if (path.startsWith("/staff/students/")) {
    const id = path.split("/")[3];
    if (id) return `/staff/intake/${id}`;
  }
  if (path === "/staff/students" || path.startsWith("/staff/students?")) {
    return "/staff/intake";
  }
  if (
    path.startsWith("/staff/front-desk") ||
    path.startsWith("/staff/intake") ||
    path.startsWith("/staff/register") ||
    path.startsWith("/staff/finance")
  ) {
    return path.split("?")[0] || "/staff/front-desk";
  }
  return "/staff/front-desk";
}
