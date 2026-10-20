/**
 * Front Desk intake edit / archive contracts (mirrors …20130000 RPCs).
 */

export const FRONT_DESK_INTAKE_EDITABLE_FIELDS = [
  "full_name",
  "email",
  "phone",
  "whatsapp",
  "city",
  "destination",
  "program",
  "study_level",
  "inquiry_source",
  "inquiry_channel",
  "intake_date",
  "registration_notes",
  "next_follow_up_at",
] as const;

export type FrontDeskIntakeEditableField = (typeof FRONT_DESK_INTAKE_EDITABLE_FIELDS)[number];

export const FRONT_DESK_INTAKE_PROTECTED_FIELDS = [
  "portal_activated_at",
  "profile_id",
  "registered_by",
  "assigned_consultant_id",
  "journey_stage",
  "case_id",
  "archived_at",
  "signup_fee_status",
] as const;

export function isFrontDeskIntakeEditableField(field: string): boolean {
  return (FRONT_DESK_INTAKE_EDITABLE_FIELDS as readonly string[]).includes(field);
}

export function emailChangeAllowedForIntake(input: {
  profileId: string | null | undefined;
  previousEmail: string;
  nextEmail: string;
}): { ok: true } | { ok: false; error: string } {
  const prev = input.previousEmail.trim().toLowerCase();
  const next = input.nextEmail.trim().toLowerCase();
  if (prev === next) return { ok: true };
  if (input.profileId) {
    return { ok: false, error: "Cannot change email after a portal account is linked." };
  }
  return { ok: true };
}

export function validateArchiveReason(reason: string): { ok: true } | { ok: false; error: string } {
  const t = reason.trim();
  if (t.length < 3) return { ok: false, error: "An archive reason is required (at least 3 characters)." };
  return { ok: true };
}

export function canRestoreArchivedRegistration(input: {
  isAdmin: boolean;
}): boolean {
  return input.isAdmin;
}

/** Diff allowed intake fields for audit metadata (never passwords). */
export function diffIntakeRegistrationFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { field: string; from: string | null; to: string | null }[] {
  const changes: { field: string; from: string | null; to: string | null }[] = [];
  for (const field of FRONT_DESK_INTAKE_EDITABLE_FIELDS) {
    const a = normalizeAuditValue(before[field]);
    const b = normalizeAuditValue(after[field]);
    if (a !== b) changes.push({ field, from: a, to: b });
  }
  return changes;
}

function normalizeAuditValue(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

export function mapFrontDeskIntakeManageRpcError(message: string): {
  status: number;
  message: string;
} {
  if (/does not exist|Could not find the function|PGRST202/i.test(message)) {
    return {
      status: 503,
      message:
        "Intake manage RPCs unavailable. Apply migration 20261020130000_front_desk_intake_manage.sql.",
    };
  }
  if (/Not authorized|not authorized/i.test(message)) {
    return { status: 403, message: "You cannot change this registration." };
  }
  if (/not found/i.test(message)) {
    return { status: 404, message: "Student record not found." };
  }
  if (/updated by someone else|Reload and try again/i.test(message)) {
    return {
      status: 409,
      message: "This registration was updated by someone else. Reload and try again.",
    };
  }
  if (/Archived registrations|archive reason|restore/i.test(message)) {
    return { status: 400, message: message };
  }
  if (/Cannot change email|valid email|Full name/i.test(message)) {
    return { status: 400, message: message };
  }
  return { status: 400, message: message || "Could not update the registration." };
}

/** Approximate season from stored intake_date (register form mapping). */
export function intakeDateToSeasonYear(intakeDate: string | null | undefined): {
  season: "Winter" | "Spring" | "Summer" | "Autumn" | "Other" | "";
  year: string;
} {
  if (!intakeDate || !/^\d{4}-\d{2}-\d{2}/.test(intakeDate)) {
    return { season: "", year: "" };
  }
  const year = intakeDate.slice(0, 4);
  const md = intakeDate.slice(5, 10);
  const season =
    md === "01-15"
      ? "Winter"
      : md === "03-15"
        ? "Spring"
        : md === "06-15"
          ? "Summer"
          : md === "09-15"
            ? "Autumn"
            : md === "01-01"
              ? "Other"
              : "Other";
  return { season, year };
}
