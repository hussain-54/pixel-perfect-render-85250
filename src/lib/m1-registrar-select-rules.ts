/**
 * Option 5/6/7 — M1 registrar SELECT residual contracts.
 * Unit tests only.
 * Runbook: docs/testing/OPTION6-STAGING-VERIFICATION-RUNBOOK.md
 * Evidence ledger: docs/testing/OPTION7-STAGING-EVIDENCE-LEDGER.md (gates start NOT RUN).
 * Do not claim M1 fixed until staging JWT REST proves deny on owned select=* (ledger E1).
 */

/** Staging evidence ledger gates (must match OPTION7-STAGING-EVIDENCE-LEDGER.md). */
export const M1_STAGING_EVIDENCE_GATES = ["A", "B", "C", "D", "E", "F", "G"] as const;

/** Mandatory M1 closure gate id inside the ledger. */
export const M1_CLOSURE_GATE = "E1" as const;

/** Forward chain for Phase 2 FD → M1 drop (local filenames). */
export const M1_MIGRATION_ORDER = [
  "20261014020000_front_desk_intake_ownership.sql",
  "20261014030000_front_desk_fee_and_business_role_guard.sql",
  "20261014040000_signup_fee_fd_registrar_only.sql",
  "20261014050000_intake_register_student_rpc.sql",
  "20261014060000_drop_students_select_intake_registrar.sql",
] as const;

/** Policy removed by 20261014060000 (must match migration). */
export const M1_REGISTRAR_SELECT_POLICY = "students_select_intake_registrar" as const;

export const M1_REGISTRAR_SELECT_DROP_SQL =
  "drop policy if exists students_select_intake_registrar on public.students;" as const;

/**
 * Exact arg types for drop function / grants (must match …14050000).
 * text×9, uuid, text, inquiry_channel, date, text, uuid
 */
export const INTAKE_REGISTER_STUDENT_ARG_TYPES =
  "text, text, text, text, text, text, text, text, text, uuid, text, public.inquiry_channel, date, text, uuid" as const;

export const INTAKE_REGISTER_STUDENT_DROP_SQL = `
drop function if exists public.intake_register_student(
  text, text, text, text, text, text, text, text, text, uuid, text,
  public.inquiry_channel, date, text, uuid
);
`.trim();

/** Row-level policies that remain after the drop (permissive OR). */
export const STUDENTS_SELECT_POLICIES_AFTER_DROP = [
  "students_select_access",
  "students_select_fee_verifier",
] as const;

/**
 * After …14060000, FD REST select=* on an owned row is denied only when NONE of
 * the remaining permissive policies match. Typical FD: not admin, not fee verifier,
 * not assigned_consultant_id / profile_id on that row.
 */
export function fdOwnedRestSelectShouldDeny(input: {
  isAdmin: boolean;
  canVerifySignupFee: boolean;
  isAssignedConsultantOnRow: boolean;
  isStudentSelfProfile: boolean;
}): boolean {
  if (input.isAdmin) return false;
  if (input.canVerifySignupFee) return false;
  if (input.isAssignedConsultantOnRow) return false;
  if (input.isStudentSelfProfile) return false;
  return true;
}

/**
 * Sensitive columns exposed by any row-scoped SELECT=* policy (Postgres RLS
 * cannot hide columns on a permitted row).
 */
export const STUDENTS_SENSITIVE_COLUMNS = [
  "dob",
  "registration_notes",
  "archived_at",
  "portal_activated_at",
  "last_activity_at",
  "profile_id",
] as const;

/**
 * Residuals NOT closed by M1 / E1 (must stay OPEN in Option 7 ledger).
 * R1–R3 ids align with OPTION6/OPTION7 docs.
 */
export const M1_OUT_OF_SCOPE_RESIDUALS = [
  {
    id: "R1",
    description: "students_select_fee_verifier — org-wide students SELECT for fee verifiers",
  },
  {
    id: "R2",
    description: "front_desk_assign_counsellor — DEFINER returns full public.students row",
  },
  {
    id: "R3",
    description:
      "Permissive OR paths — admin / fee-verifier / assigned-to-self / self-profile still SELECT",
  },
] as const;

/** Local audit gates — staging_rest_proof stays false until operator evidence. */
export const M1_POLICY_DROP_PREREQUISITES = [
  {
    id: "intake_rpc",
    description: "portal-intake registration uses intake_register_student only",
    localSatisfied: true,
  },
  {
    id: "fee_ownership_rpc",
    description: "FD fee ownership uses is_intake_registrar / is_front_desk_fee_registrar",
    localSatisfied: true,
  },
  {
    id: "fd_list_rpc",
    description: "FD list uses list_front_desk_intake_summaries",
    localSatisfied: true,
  },
  {
    id: "fd_assign_rpc",
    description: "FD assign uses front_desk_assign_counsellor",
    localSatisfied: true,
  },
  {
    id: "officer_assignment_select",
    description:
      "portal-officer createStudentRecord sets assigned_consultant_id (students_select_access)",
    localSatisfied: true,
  },
  {
    id: "no_can_access_student_extension",
    description: "can_access_student must NOT include registered_by",
    localSatisfied: true,
  },
  {
    id: "catalog_parity",
    description: "Staging catalog / migration-history parity documented (Step A)",
    localSatisfied: false,
  },
  {
    id: "staging_rest_proof",
    description: "Staging JWT REST: FD select=* on owned pending row denied / empty after drop",
    localSatisfied: false,
  },
] as const;

export function m1PolicyDropLocallyReady(): boolean {
  return M1_POLICY_DROP_PREREQUISITES.filter(
    (p) => p.id !== "staging_rest_proof" && p.id !== "catalog_parity",
  ).every((p) => p.localSatisfied);
}

/** True only with operator evidence (never asserted true in unit tests). */
export function m1RegistrarPiiClaimFixed(input: {
  catalogParityDocumented: boolean;
  stagingRestOwnedSelectDenied: boolean;
}): boolean {
  return (
    m1PolicyDropLocallyReady() &&
    input.catalogParityDocumented &&
    input.stagingRestOwnedSelectDenied
  );
}

export const M1_POLICY_DROP_PG_INTEGRATION_PLAN = [
  {
    actor: "Operator",
    action: "Catalog / schema_migrations or object parity (Step A)",
    expected: "document PASS/FAIL/UNVERIFIED before apply",
  },
  {
    actor: "Anon",
    action: "GET /students?select=*",
    expected: "deny",
  },
  {
    actor: "FD-A JWT",
    action: "rpc intake_register_student",
    expected: "success; registered_by=FD-A; no dob in payload",
  },
  {
    actor: "Student / unauthorized",
    action: "rpc intake_register_student",
    expected: "deny",
  },
  {
    actor: "FD-A JWT",
    action: "GET /students?select=*&id=eq.<owned_pending_by_FD-A>",
    expected: "deny or empty AFTER …14060000 (PASS required for M1 fixed)",
  },
  {
    actor: "FD-B JWT",
    action: "GET /students?select=*&id=eq.<owned_by_FD-A>",
    expected: "deny or empty",
  },
  {
    actor: "FD-A JWT",
    action: "GET applications|documents|offers|internal_notes?student_id=eq.<owned>",
    expected: "empty/deny (no can_access_student via registered_by)",
  },
  {
    actor: "Officer / counsellor",
    action: "INSERT students … RETURNING * with assigned_consultant_id=self",
    expected: "success via students_select_access",
  },
  {
    actor: "Assigned counsellor",
    action: "GET /students?select=*&id=eq.<assigned>",
    expected: "allow (students_select_access)",
  },
  {
    actor: "Admin",
    action: "GET /students?select=*",
    expected: "allow (students_select_access)",
  },
  {
    actor: "Student",
    action: "GET /students?select=*&profile_id=eq.<self>",
    expected: "allow own row only",
  },
] as const;

/** Emergency recreate — re-opens M1 residual. Matches …14020000. */
export const M1_REGISTRAR_SELECT_ROLLBACK_SQL = `
create policy students_select_intake_registrar
  on public.students
  for select
  to authenticated
  using (registered_by = auth.uid());
`.trim();
