/**
 * Pure mirrors / contracts for intake_register_student (…14050000).
 * Unit tests only — not PostgreSQL integration proof.
 */

/** Columns returned by intake_register_student — DOB intentionally excluded. */
export const INTAKE_REGISTER_RETURN_COLUMNS = [
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
  "inquiry_source",
  "inquiry_channel",
  "intake_date",
  "created_at",
  "updated_at",
] as const;

export type IntakeRegisterReturnColumn = (typeof INTAKE_REGISTER_RETURN_COLUMNS)[number];

/** Sensitive / staff fields that must NOT appear in the RPC return list. */
export const INTAKE_REGISTER_EXCLUDED_COLUMNS = [
  "dob",
  "archived_at",
  "portal_activated_at",
  "last_activity_at",
  "registration_notes",
  "profile_id",
] as const;

export function intakeRegisterReturnsColumn(column: string): boolean {
  return (INTAKE_REGISTER_RETURN_COLUMNS as readonly string[]).includes(column);
}

export function intakeRegisterExcludesSensitive(column: string): boolean {
  return (INTAKE_REGISTER_EXCLUDED_COLUMNS as readonly string[]).includes(column);
}

/** Non-admin ownership stamp: always auth.uid(); caller-supplied registered_by ignored. */
export function forcedRegisteredBy(input: {
  authUid: string | null;
  clientRegisteredBy?: string | null;
}): string | null {
  if (!input.authUid) return null;
  return input.authUid;
}

export function mapIntakeRegisterRpcError(rawMessage: string): {
  status: number;
  message: string;
} {
  const message = rawMessage.trim();
  if (/does not exist|Could not find the function|PGRST202/i.test(message)) {
    return {
      status: 503,
      message:
        "Intake registration RPC unavailable. Apply migration 20261014050000_intake_register_student_rpc.sql.",
    };
  }
  if (/authentication required/i.test(message)) {
    return { status: 401, message: "Sign in required to register students." };
  }
  if (/not authorized to register intake/i.test(message)) {
    return { status: 403, message: "You do not have permission to register students." };
  }
  if (/duplicate student email/i.test(message)) {
    return { status: 409, message: "A student with this email is already registered." };
  }
  if (/case_id is required|full_name is required|email is required/i.test(message)) {
    return { status: 400, message: "Registration is missing required fields." };
  }
  if (/assigned consultant not found/i.test(message)) {
    return { status: 400, message: "Selected counsellor desk was not found." };
  }
  if (/profile already linked to a student/i.test(message)) {
    return {
      status: 409,
      message: "This email is already linked to another student record.",
    };
  }
  if (/permission denied for function write_audit_event/i.test(message)) {
    return {
      status: 500,
      message:
        "Registration may have saved, but audit logging failed. Check Intake for this email before retrying. Apply write_audit_event EXECUTE grant migration if needed.",
    };
  }
  return {
    status: 400,
    message: "Could not complete registration. Try again or contact an administrator.",
  };
}

/**
 * After …14070000 the RPC ignores caller p_profile_id and links only when
 * profiles.email matches the registration email.
 */
export function intakeRegisterIgnoresCallerProfileId(): true {
  return true;
}

/**
 * Option 5 follow-up prepared as 20261014060000_drop_students_select_intake_registrar.sql.
 * See m1-registrar-select-rules.ts for readiness gates. M1 not fixed until staging REST.
 */
export const M1_REGISTRAR_SELECT_FOLLOWUP = {
  policy: "students_select_intake_registrar",
  migration: "20261014060000_drop_students_select_intake_registrar.sql",
  dropSql: "drop policy if exists students_select_intake_registrar on public.students;",
  prerequisites: [
    "portal-intake registration uses intake_register_student RPC",
    "fee ownership uses is_intake_registrar / is_front_desk_fee_registrar (no students select *)",
    "list uses list_front_desk_intake_summaries",
    "JWT REST test: FD select=* on owned row returns 0 columns or denied after drop",
    "portal-officer createStudentRecord still authorized via assignment SELECT",
  ],
} as const;

export const INTAKE_REGISTER_PG_INTEGRATION_PLAN = [
  {
    actor: "Anon",
    action: "EXECUTE intake_register_student",
    expected: "deny",
  },
  {
    actor: "Student",
    action: "CALL intake_register_student",
    expected: "deny (can_record_intake false)",
  },
  {
    actor: "FD-A",
    action: "CALL with valid payload; omit registered_by",
    expected: "success; registered_by = FD-A; no dob in result",
  },
  {
    actor: "FD-A",
    action: "CALL duplicate email",
    expected: "duplicate student email",
  },
  {
    actor: "Counsellor",
    action: "CALL valid self-assign registration",
    expected: "success when can_record_intake; registered_by = self",
  },
  {
    actor: "FD JWT REST",
    action: "GET students?select=* owned (policy still present)",
    expected: "UNVERIFIED residual until follow-up drop",
  },
] as const;
