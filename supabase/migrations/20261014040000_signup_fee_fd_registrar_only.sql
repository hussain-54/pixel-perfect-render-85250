-- =============================================================================
-- Global Roots — Signup fee: Front Desk-only registrar arm (Option 3)
-- Forward-only. DO NOT apply without owner confirmation.
-- Depends on:
--   20261014020000_front_desk_intake_ownership.sql (is_front_desk, registered_by)
--   20261014030000_front_desk_fee_and_business_role_guard.sql (is_intake_registrar)
-- Does NOT extend can_access_student() with registered_by.
-- Does NOT rewrite historical migrations.
--
-- Change: registrar-specific fee SELECT/INSERT/UPDATE requires
--   is_intake_registrar(student_id) AND (is_front_desk() OR is_admin()).
-- Preserved:
--   can_verify_signup_fee() org-wide verifier path
--   can_access_student (+ can_staff_mutate on UPDATE) assignment-scoped path
--   enforce_signup_fee_update_guard terminal / verified_* / student_id rules
-- =============================================================================

-- Narrow helper: ownership alone is insufficient for fee write/read via registrar arm.
create or replace function public.is_front_desk_fee_registrar(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_intake_registrar(p_student_id)
    and (public.is_front_desk() or public.is_admin());
$$;

comment on function public.is_front_desk_fee_registrar(uuid) is
  'Registrar fee arm: owned intake AND (Front Desk business role OR admin). Counsellors who registered a student do not get fee write via this path.';

revoke all on function public.is_front_desk_fee_registrar(uuid) from public;
revoke all on function public.is_front_desk_fee_registrar(uuid) from anon;
grant execute on function public.is_front_desk_fee_registrar(uuid) to authenticated;

-- Replace fee policies (same names; drop + create — no duplicate policies).
drop policy if exists signup_fee_select on public.signup_fee_payments;
create policy signup_fee_select on public.signup_fee_payments
  for select
  to authenticated
  using (
    public.can_verify_signup_fee()
    or public.can_access_student(student_id)
    or public.is_front_desk_fee_registrar(student_id)
  );

drop policy if exists signup_fee_insert on public.signup_fee_payments;
create policy signup_fee_insert on public.signup_fee_payments
  for insert
  to authenticated
  with check (
    public.can_record_intake()
    and (
      public.can_access_student(student_id)
      or public.is_front_desk_fee_registrar(student_id)
    )
    and (
      public.can_verify_signup_fee()
      or status in ('unpaid', 'claimed')
    )
    and verified_by is null
    and verified_at is null
    and (recorded_by is null or recorded_by = auth.uid())
  );

drop policy if exists signup_fee_update on public.signup_fee_payments;
create policy signup_fee_update on public.signup_fee_payments
  for update
  to authenticated
  using (
    public.can_verify_signup_fee()
    or (
      public.can_access_student(student_id)
      and public.can_staff_mutate_student(student_id)
      and status in ('unpaid', 'claimed')
    )
    or (
      public.is_front_desk_fee_registrar(student_id)
      and status in ('unpaid', 'claimed')
    )
  )
  with check (
    public.can_verify_signup_fee()
    or (
      (
        public.can_access_student(student_id)
        or public.is_front_desk_fee_registrar(student_id)
      )
      and status in ('unpaid', 'claimed')
      and verified_by is null
      and verified_at is null
      and (recorded_by is null or recorded_by = auth.uid())
    )
  );

-- Rollback (manual, if needed): recreate …14030000 fee policies using
-- is_intake_registrar alone (not recommended once FD-only is accepted).
