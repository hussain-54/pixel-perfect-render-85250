/**
 * Front Desk student-portal provisioning rules.
 * Linking never activates the portal and never trusts a client-supplied email.
 */

export type StudentPortalAccountStatus =
  | "not_provisioned"
  | "pending_setup"
  | "pending_activation"
  | "active";

export function studentPortalAccountStatus(input: {
  profileId: string | null | undefined;
  hasSignedIn: boolean;
  portalActivatedAt: string | null | undefined;
}): StudentPortalAccountStatus {
  if (input.portalActivatedAt?.trim()) return "active";
  if (!input.profileId) return "not_provisioned";
  if (!input.hasSignedIn) return "pending_setup";
  return "pending_activation";
}

export function studentPortalAccountStatusLabel(status: StudentPortalAccountStatus): string {
  switch (status) {
    case "not_provisioned":
      return "Not created";
    case "pending_setup":
      return "Pending setup";
    case "pending_activation":
      return "Pending activation";
    case "active":
      return "Active";
  }
}

export type PortalLinkDecision =
  | { ok: true; mode: "already_linked" | "link" }
  | {
      ok: false;
      reason:
        | "missing_email"
        | "email_mismatch"
        | "not_student_role"
        | "linked_other_profile"
        | "linked_other_student";
    };

/** Decide whether an existing Auth profile may be attached to this CRM student. */
export function decideStudentPortalLink(input: {
  studentId: string;
  studentEmail: string;
  studentProfileId: string | null;
  accountUserId: string;
  accountEmail: string;
  accountRole: string;
  accountLinkedStudentId: string | null;
}): PortalLinkDecision {
  const studentEmail = input.studentEmail.trim().toLowerCase();
  const accountEmail = input.accountEmail.trim().toLowerCase();
  if (!studentEmail || !accountEmail) return { ok: false, reason: "missing_email" };
  if (studentEmail !== accountEmail) return { ok: false, reason: "email_mismatch" };
  if (input.accountRole !== "student") return { ok: false, reason: "not_student_role" };
  if (input.studentProfileId && input.studentProfileId !== input.accountUserId) {
    return { ok: false, reason: "linked_other_profile" };
  }
  if (input.accountLinkedStudentId && input.accountLinkedStudentId !== input.studentId) {
    return { ok: false, reason: "linked_other_student" };
  }
  if (input.studentProfileId === input.accountUserId) {
    return { ok: true, mode: "already_linked" };
  }
  return { ok: true, mode: "link" };
}

const PROFILE_FIELDS = ["phone", "city", "destination", "program", "studyLevel", "dob"] as const;

export function studentProfileCompletion(student: {
  phone?: string | null;
  city?: string | null;
  destination?: string | null;
  program?: string | null;
  studyLevel?: string | null;
  dob?: string | null;
}): { done: number; total: number; percent: number } {
  const done = PROFILE_FIELDS.filter((key) => Boolean(student[key]?.trim())).length;
  const total = PROFILE_FIELDS.length;
  return { done, total, percent: Math.round((done / total) * 100) };
}

/** Student-facing fee label. No amounts, receipts, or internal notes. */
export function studentFacingFeeLabel(status: string | null | undefined): string {
  switch ((status ?? "").trim().toLowerCase()) {
    case "verified":
      return "Verified";
    case "waived":
      return "Waived";
    case "claimed":
      return "Awaiting Finance verification";
    case "rejected":
      return "Needs correction";
    case "unpaid":
      return "Payment pending";
    default:
      return "Not recorded";
  }
}

/**
 * Intake list has profile_id + portal_activated_at only.
 * Linked-but-not-activated means the login exists; fee activation is still pending.
 */
export function intakePortalStatusFromRow(input: {
  profileId: string | null | undefined;
  portalActivatedAt: string | null | undefined;
}): StudentPortalAccountStatus {
  if (input.portalActivatedAt?.trim()) return "active";
  if (!input.profileId) return "not_provisioned";
  return "pending_activation";
}

/** True when this Front Desk path must not send Auth invite/recovery emails. */
export function frontDeskProvisionUsesPasswordCreateOnly(): boolean {
  return true;
}

/** Safe RPC/error mapping — never forwards invite tokens or passwords. */
export function mapStudentPortalLinkRpcError(message: string): {
  status: number;
  message: string;
} {
  if (/does not exist|Could not find the function|PGRST202/i.test(message)) {
    return {
      status: 503,
      message:
        "Student portal linking is unavailable. Apply migration 20261020120000_front_desk_student_portal_link.sql.",
    };
  }
  if (/not authorized/i.test(message)) {
    return { status: 403, message: "You cannot link this student." };
  }
  if (/not found/i.test(message)) {
    return { status: 404, message: "Student or account was not found." };
  }
  if (/another account|another student|does not match|only a student/i.test(message)) {
    return { status: 409, message: sanitizeProvisionErrorMessage(message) };
  }
  return { status: 400, message: "Could not link the student portal account." };
}

/** Strip token-like fragments from Auth/invite errors before surfacing to staff. */
export function sanitizeProvisionErrorMessage(raw: string): string {
  const cleaned = raw
    .replace(/https?:\/\/\S+/gi, "[link omitted]")
    .replace(/\b(password|secret|token)\s*[:=]\s*\S+/gi, "$1=[omitted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token omitted]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[token omitted]")
    .trim();
  return cleaned.slice(0, 240) || "Could not complete student portal provisioning.";
}

export function inviteEmailFailureMessage(raw: string | null | undefined): string {
  const safe = sanitizeProvisionErrorMessage(raw ?? "");
  if (!safe || /could not complete/i.test(safe)) {
    return "Could not send the account setup email. Confirm Auth email is configured and try again.";
  }
  return safe;
}

/**
 * Linking only writes profile_id. Activation remains on the fee-verify path.
 * Pure guard for tests and server assertions after a link response.
 */
export function portalActivationUnchangedByLink(input: {
  before: string | null | undefined;
  after: string | null | undefined;
}): boolean {
  return (input.before?.trim() || "") === (input.after?.trim() || "");
}
