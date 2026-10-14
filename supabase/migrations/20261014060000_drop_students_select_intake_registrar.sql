-- =============================================================================
-- Global Roots — Option 5: drop students_select_intake_registrar (M1 residual)
-- Forward-only. DO NOT apply without owner confirmation + staging JWT REST proof.
--
-- Depends on (applied and live):
--   20261014020000_front_desk_intake_ownership.sql
--     (registered_by, list_front_desk_intake_summaries, front_desk_assign_counsellor)
--   20261014030000_front_desk_fee_and_business_role_guard.sql (is_intake_registrar)
--   20261014040000_signup_fee_fd_registrar_only.sql (is_front_desk_fee_registrar)
--   20261014050000_intake_register_student_rpc.sql (narrow registration RETURNING)
--
-- Why this is safe for intended app paths (local audit — not staging proof):
--   - FD list: list_front_desk_intake_summaries (DEFINER)
--   - FD fee ownership: is_intake_registrar / is_front_desk_fee_registrar (boolean)
--   - FD register: intake_register_student (DEFINER, narrow columns)
--   - FD assign: front_desk_assign_counsellor (DEFINER)
--   - Officer createStudentRecord: always sets assigned_consultant_id →
--     students_select_access (assigned_consultant_id = auth.uid() or is_admin())
--
-- Preserved SELECT policies (unchanged by this migration; permissive OR):
--   - students_select_access: self / assigned consultant / admin
--   - students_select_fee_verifier: can_verify_signup_fee() (org-wide residual —
--     out of M1 scope; do not treat as fixed by this drop)
-- Staging M1 REST proof must use an FD-owned row where assigned_consultant_id
-- is NOT the FD uid (else students_select_access alone still allows select=*).
--
-- Separate residuals (NOT fixed here):
--   - front_desk_assign_counsellor returns public.students (full row DEFINER)
--   - students_select_fee_verifier org-wide SELECT for fee verifiers
--
-- Does NOT extend can_access_student with registered_by.
-- Does NOT claim M1 fixed until JWT REST select=* on owned pending rows is denied.
-- Operator runbook: docs/testing/OPTION6-STAGING-VERIFICATION-RUNBOOK.md
-- =============================================================================

drop policy if exists students_select_intake_registrar on public.students;

comment on table public.students is
  'Registrar table SELECT removed (…14060000). FD list/fee/register/assign use DEFINER RPCs; officer RETURNING relies on students_select_access.';
