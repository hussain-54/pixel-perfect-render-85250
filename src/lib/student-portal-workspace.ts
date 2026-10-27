/**
 * Student Portal workbench helpers — next actions, notification deep links,
 * and student-safe application status messaging. Does not invent stages or KPIs.
 */
import type { ApplicationStatus, DocumentStatus } from "@/types";

export type StudentNextAction = {
  id: string;
  title: string;
  detail: string;
  href:
    | "/student/documents"
    | "/student/applications"
    | "/student/profile"
    | "/student/appointments"
    | "/student/notifications"
    | "/student/dashboard";
  priority: number;
};

export function resolveStudentNotificationHref(input: {
  linkPath: string | null | undefined;
}): string {
  const path = (input.linkPath ?? "").trim().split("?")[0] || "";
  if (path.startsWith("/student/documents")) return "/student/documents";
  if (path.startsWith("/student/applications")) return "/student/applications";
  if (path.startsWith("/student/appointments")) return "/student/appointments";
  if (path.startsWith("/student/profile")) return "/student/profile";
  if (path.startsWith("/student/notifications")) return "/student/notifications";
  if (path.startsWith("/student/dashboard") || path === "/student" || path === "/student/") {
    return "/student/dashboard";
  }
  // Staff or unknown paths must not open staff portals for students.
  return "/student/notifications";
}

/** Student-safe label: never claim university submission without Submitted / Offer stage. */
export function studentApplicationStageExplain(status: ApplicationStatus): string {
  switch (status) {
    case "Docs Pending":
      return "Documents still needed before review can finish.";
    case "Under Review":
      return "Our Admission Team is reviewing your file (not yet submitted to the university).";
    case "Ready to Submit":
      return "Internal review complete — staff will submit when ready.";
    case "Submitted":
      return "Submitted to the university.";
    case "Offer Received":
      return "An admission decision or offer has been recorded.";
    case "Rejected":
      return "This application was closed as rejected.";
    case "Withdrawn":
      return "This application was withdrawn.";
    default:
      return "Status on file.";
  }
}

export function studentApplicationNextAction(status: ApplicationStatus): string {
  switch (status) {
    case "Docs Pending":
      return "Upload or correct required documents";
    case "Under Review":
    case "Ready to Submit":
      return "No student action — awaiting Admission Team";
    case "Submitted":
      return "Await university response";
    case "Offer Received":
      return "Review offer details with your counsellor";
    case "Rejected":
    case "Withdrawn":
      return "No further action on this application";
    default:
      return "Check with your counsellor if unsure";
  }
}

export function isStudentActionableDocStatus(
  status: DocumentStatus | string,
  awaitingUpload?: boolean,
): boolean {
  if (awaitingUpload) return true;
  const s = String(status).toLowerCase();
  return (
    s === "needs correction" ||
    s === "needs_correction" ||
    s.includes("correction") ||
    s === "rejected" ||
    s.includes("reupload") ||
    s === "awaiting upload"
  );
}

export function buildStudentNextActions(input: {
  profilePercent: number;
  feeStatus: string | null | undefined;
  portalActivated: boolean;
  docsNeedingAction: number;
  appsDocsPending: number;
  hasCounsellor: boolean;
  hasUpcomingAppointment: boolean;
  pendingTimelineCount: number;
}): StudentNextAction[] {
  const items: StudentNextAction[] = [];

  if (input.profilePercent < 80) {
    items.push({
      id: "profile",
      title: "Complete your profile",
      detail: `${input.profilePercent}% complete — add missing contact and study details.`,
      href: "/student/profile",
      priority: 2,
    });
  }

  const fee = (input.feeStatus ?? "").toLowerCase();
  if (
    !input.portalActivated &&
    (fee === "rejected" || fee === "claimed" || fee === "unpaid" || !fee)
  ) {
    items.push({
      id: "fee",
      title:
        fee === "rejected"
          ? "Signup fee needs correction"
          : fee === "claimed"
            ? "Signup fee awaiting verification"
            : "Signup fee not verified yet",
      detail:
        fee === "rejected"
          ? "Contact Front Desk or Accounts with updated payment evidence."
          : "Portal features unlock after Accounts verifies or waives your signup fee.",
      href: "/student/notifications",
      priority: 1,
    });
  }

  if (input.docsNeedingAction > 0) {
    items.push({
      id: "docs",
      title: "Documents need your attention",
      detail: `${input.docsNeedingAction} file(s) to upload or correct.`,
      href: "/student/documents",
      priority: 1,
    });
  } else if (input.appsDocsPending > 0) {
    items.push({
      id: "apps-docs",
      title: "Application documents pending",
      detail: `${input.appsDocsPending} application(s) still marked Docs Pending.`,
      href: "/student/applications",
      priority: 2,
    });
  }

  if (!input.hasCounsellor) {
    items.push({
      id: "counsellor",
      title: "Counsellor not assigned yet",
      detail: "Front Desk will assign a counsellor after registration steps are complete.",
      href: "/student/dashboard",
      priority: 3,
    });
  } else if (!input.hasUpcomingAppointment) {
    items.push({
      id: "appt",
      title: "Book a counselling appointment",
      detail: "Request a slot with your assigned counsellor when you are ready.",
      href: "/student/appointments",
      priority: 4,
    });
  }

  if (input.pendingTimelineCount > 0 && items.length === 0) {
    items.push({
      id: "timeline",
      title: "Follow up on open journey steps",
      detail: `${input.pendingTimelineCount} item(s) still need attention on your timeline.`,
      href: "/student/dashboard",
      priority: 5,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
