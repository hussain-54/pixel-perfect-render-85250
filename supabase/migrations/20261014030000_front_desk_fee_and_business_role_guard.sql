-- =============================================================================
-- Global Roots — Phase 2 follow-up: registrar signup-fee RLS + business_role guard
-- Forward-only. DO NOT apply without owner confirmation.
-- Depends on:
--   20261014020000_front_desk_intake_ownership.sql (students.registered_by)
--   20261013010000_signup_fee_update_restrict.sql (fee SELECT/UPDATE matrix + guard)
-- Does NOT extend can_access_student() with registered_by.
-- =============================================================================

-- Ownership proof without recursive RLS on students (SECURITY DEFINER, fixed search_path).
create or replace function public.is_intake_registrar(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.registered_by is not null
      and s.registered_by = auth.uid()
  );
$$;

comment on function public.is_intake_registrar(uuid) is
  'True when auth.uid() is students.registered_by for the given student. Does not grant child-table access.';

revoke all on function public.is_intake_registrar(uuid) from public;
revoke all on function public.is_intake_registrar(uuid) from anon;
grant execute on function public.is_intake_registrar(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- H1: signup_fee INSERT / SELECT / UPDATE for intake registrars (UPSERT path)
-- Preserve verifier + can_access_student paths from …13010000.
-- ---------------------------------------------------------------------------

drop policy if exists signup_fee_select on public.signup_fee_payments;
create policy signup_fee_select on public.signup_fee_payments
  for select
  to authenticated
  using (
    public.can_verify_signup_fee()
    or public.can_access_student(student_id)
    or public.is_intake_registrar(student_id)
  );

drop policy if exists signup_fee_insert on public.signup_fee_payments;
create policy signup_fee_insert on public.signup_fee_payments
  for insert
  to authenticated
  with check (
    public.can_record_intake()
    and (
      public.can_access_student(student_id)
      or public.is_intake_registrar(student_id)
    )
    -- Non-verifiers may only record unpaid/claimed; cannot spoof verification fields.
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
      public.is_intake_registrar(student_id)
      and status in ('unpaid', 'claimed')
    )
  )
  with check (
    public.can_verify_signup_fee()
    or (
      (
        public.can_access_student(student_id)
        or public.is_intake_registrar(student_id)
      )
      and status in ('unpaid', 'claimed')
      and verified_by is null
      and verified_at is null
      and (recorded_by is null or recorded_by = auth.uid())
    )
  );

-- Note: enforce_signup_fee_update_guard (…13010000) still blocks non-verifiers from
-- terminal statuses and verified_* fields. Student_id reassignment remains blocked.

-- ---------------------------------------------------------------------------
-- H2: Lock profiles.business_role for non-admins (extend existing role guard only)
-- Admin account provisioning updates business_role via admin JWT (auth.uid() = admin).
-- ---------------------------------------------------------------------------

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role public.app_role;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.role is distinct from old.role then
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role is null or caller_role not in ('admin', 'super_admin') then
      raise exception 'Role changes require admin privileges';
    end if;
  end if;

  if new.business_role is distinct from old.business_role then
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role is null or caller_role not in ('admin', 'super_admin') then
      raise exception 'Business role changes require admin privileges';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger already exists as profiles_role_guard → enforce_profile_role_guard();
-- CREATE OR REPLACE updates the function body; no second trigger.
