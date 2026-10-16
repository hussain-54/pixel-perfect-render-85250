-- =============================================================================
-- R1 remediation — narrow students_select_fee_verifier (fee-queue scope)
-- Forward-only. DO NOT apply without owner approval + JWT REST proof.
--
-- Production evidence (catalog):
--   students_select_fee_verifier USING (can_verify_signup_fee())  -- org-wide
--   can_verify_signup_fee() = is_admin() OR business_role in
--     (accounts_banking_finance, manager, admin)
--
-- Why Finance does NOT need unrestricted students SELECT:
--   - verify/waive/reject uses SECURITY DEFINER verify_signup_fee_and_activate
--   - fee rows are authorized via signup_fee_payments policies + can_verify_signup_fee
--   - portalVerifySignupFee loads fees by student_id, not students.*
--
-- Smallest secure replacement:
--   Keep policy name + can_verify_signup_fee() gate, but require an open fee-queue
--   row (unpaid|claimed). Unrelated students (no open fee) are denied via this
--   policy arm.
--
-- Permissive OR residuals that REMAIN (not closed by this migration):
--   - students_select_access: profile_id / assigned_consultant_id / is_admin()
--   - Admin still has full SELECT via students_select_access
--   - Assigned counsellor / student self-profile unchanged
--   - Queue members still expose full students.* columns (RLS is row-level only)
--   - signup_fee_payments SELECT for verifiers stays org-wide (student_id UUID only)
--
-- Depends on: can_verify_signup_fee(), signup_fee_payments, …13020000 policy create
-- =============================================================================

drop policy if exists students_select_fee_verifier on public.students;

create policy students_select_fee_verifier on public.students
  for select
  to authenticated
  using (
    public.can_verify_signup_fee()
    and exists (
      select 1
      from public.signup_fee_payments f
      where f.student_id = students.id
        and f.status in (
          'unpaid'::public.signup_fee_status,
          'claimed'::public.signup_fee_status
        )
    )
  );

comment on policy students_select_fee_verifier on public.students is
  'R1: fee verifiers may SELECT students only when an unpaid/claimed signup fee exists (queue scope). Verify RPC remains DEFINER and does not require this policy.';
