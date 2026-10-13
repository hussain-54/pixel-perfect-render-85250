-- =============================================================================
-- Signup fee UPDATE hardening (forward-only). DO NOT apply without owner approval.
-- Prevents non-verifiers from setting terminal statuses / verification audit fields,
-- and blocks reassignment of student_id on existing fee rows.
-- Requires: 20261012010000_milestone1_intake_activation.sql
--
-- CRITICAL (intended role matrix): can_verify_signup_fee() actors (Accounts/Finance/
-- Manager/Admin) are NOT always can_access_student() (assignment-scoped). Fee SELECT
-- and UPDATE for verifiers must not require assignment.
-- =============================================================================

-- Verifiers (org-wide finance) OR assigned/own student may read fee rows.
drop policy if exists signup_fee_select on public.signup_fee_payments;
create policy signup_fee_select on public.signup_fee_payments
  for select to authenticated
  using (
    public.can_verify_signup_fee()
    or public.can_access_student(student_id)
  );

-- Staff may update unpaid/claimed rows (claim metadata). Only fee verifiers
-- may transition into verified / waived / rejected. Verifiers do not need assignment.
drop policy if exists signup_fee_update on public.signup_fee_payments;
create policy signup_fee_update on public.signup_fee_payments
  for update to authenticated
  using (
    public.can_verify_signup_fee()
    or (
      public.can_access_student(student_id)
      and public.can_staff_mutate_student(student_id)
      and status in ('unpaid', 'claimed')
    )
  )
  with check (
    public.can_verify_signup_fee()
    or (
      public.can_access_student(student_id)
      and status in ('unpaid', 'claimed')
    )
  );

-- Defense in depth beyond RLS column blindness: non-verifiers cannot set terminal
-- statuses or verification audit fields; nobody can reassign student_id.
create or replace function public.enforce_signup_fee_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.student_id is distinct from new.student_id then
    raise exception 'signup_fee_payments.student_id cannot be reassigned';
  end if;

  if not public.can_verify_signup_fee() then
    if new.status is distinct from old.status
       and new.status not in ('unpaid', 'claimed') then
      raise exception 'only fee verifiers may set terminal signup fee statuses';
    end if;
    if new.verified_by is distinct from old.verified_by
       or new.verified_at is distinct from old.verified_at then
      raise exception 'only fee verifiers may set signup fee verification fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists signup_fee_prevent_student_reassign on public.signup_fee_payments;
drop trigger if exists signup_fee_enforce_update_guard on public.signup_fee_payments;
create trigger signup_fee_enforce_update_guard
  before update on public.signup_fee_payments
  for each row execute function public.enforce_signup_fee_update_guard();

revoke all on function public.enforce_signup_fee_update_guard() from public;
