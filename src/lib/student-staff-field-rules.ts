/**
 * Pure mirrors of students BEFORE UPDATE staff-field rules intended by
 * 20261013020000 + remediated 20261014020000.
 * Does NOT prove remote RLS — locks intended matrix for unit tests.
 */

export type StudentStaffFieldActor = {
  isAdmin: boolean;
  isAssignedConsultant: boolean;
  /** Mirrors can_verify_signup_fee() */
  canVerifySignupFee: boolean;
  /** auth.uid() equals old.registered_by */
  isRegistrarOwner: boolean;
  /** auth.uid() equals old.profile_id */
  isOwningStudent: boolean;
};

/** Columns fee verifiers may change (plus updated_at from set_updated_at). */
export const FEE_VERIFIER_ALLOWLIST = ["portal_activated_at", "updated_at"] as const;

/** Columns intake registrars may change on owned rows (assign RPC path). */
export const REGISTRAR_ASSIGN_ALLOWLIST = ["assigned_consultant_id", "updated_at"] as const;

const STAFF_LOCKED_FOR_STUDENT = [
  "assigned_consultant_id",
  "journey_stage",
  "case_id",
  "profile_id",
  "archived_at",
  "email",
  "full_name",
  "portal_activated_at",
] as const;

function onlyAllowlistedChanged(
  changedFields: readonly string[],
  allowlist: readonly string[],
): boolean {
  return changedFields.every((f) => (allowlist as readonly string[]).includes(f));
}

/**
 * Mirrors enforce_student_staff_fields decision for a proposed UPDATE.
 * `changedFields` = column names that differ (excluding no-ops).
 * Returns null when allowed; otherwise an error message.
 */
export function studentStaffFieldUpdateDenied(input: {
  actor: StudentStaffFieldActor;
  changedFields: readonly string[];
  registeredByChanged: boolean;
}): string | null {
  const { actor, changedFields, registeredByChanged } = input;

  if (registeredByChanged && !actor.isAdmin) {
    return "registered_by cannot be changed";
  }

  if (actor.isAdmin || actor.isAssignedConsultant) {
    return null;
  }

  if (actor.canVerifySignupFee) {
    if (!onlyAllowlistedChanged(changedFields, FEE_VERIFIER_ALLOWLIST)) {
      return "Fee verifiers may only set portal_activated_at on students";
    }
    return null;
  }

  if (actor.isRegistrarOwner) {
    if (!onlyAllowlistedChanged(changedFields, REGISTRAR_ASSIGN_ALLOWLIST)) {
      return "Registrars may only assign a counsellor on owned intake rows";
    }
    return null;
  }

  if (actor.isOwningStudent) {
    const locked = changedFields.some((f) =>
      (STAFF_LOCKED_FOR_STUDENT as readonly string[]).includes(f),
    );
    if (locked) {
      return "Students cannot change staff-controlled student fields";
    }
    return null;
  }

  return "Not allowed to update this student record";
}

/** Mirrors list_active_counsellor_desks authorization (admin / FD / manager). */
export function canListActiveCounsellorDesks(input: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isFrontDesk: boolean;
  isManager: boolean;
}): boolean {
  if (!input.isAuthenticated) return false;
  return input.isAdmin || input.isFrontDesk || input.isManager;
}

/** Counsellor desk eligibility for front_desk_assign_counsellor. */
export function isEligibleCounsellorDesk(input: {
  status: string;
  businessRole: string | null | undefined;
}): boolean {
  return input.status === "active" && input.businessRole === "counsellor_consultant";
}

/** Who may call front_desk_assign_counsellor (before ownership check). */
export function canCallFrontDeskAssignCounsellor(input: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isFrontDesk: boolean;
}): boolean {
  if (!input.isAuthenticated) return false;
  return input.isAdmin || input.isFrontDesk;
}

/**
 * Columns returned by front_desk_assign_counsellor after …14080000.
 * Excludes DOB / activation / archive / notes / profile_id (R2 narrow).
 */
export const FRONT_DESK_ASSIGN_RETURN_COLUMNS = [
  "id",
  "case_id",
  "full_name",
  "email",
  "phone",
  "whatsapp",
  "city",
  "destination",
  "program",
  "study_level",
  "journey_stage",
  "assigned_consultant_id",
  "registered_by",
  "updated_at",
] as const;

export const FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS = [
  "dob",
  "archived_at",
  "portal_activated_at",
  "last_activity_at",
  "registration_notes",
  "profile_id",
] as const;

export function frontDeskAssignReturnsColumn(column: string): boolean {
  return (FRONT_DESK_ASSIGN_RETURN_COLUMNS as readonly string[]).includes(column);
}

export function frontDeskAssignExcludesSensitive(column: string): boolean {
  return (FRONT_DESK_ASSIGN_EXCLUDED_COLUMNS as readonly string[]).includes(column);
}
