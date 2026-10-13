-- =============================================================================
-- Atomic signup-fee verify/waive/reject + optional portal activation (RPC).
-- DO NOT apply without owner approval. DO NOT wire portal-intake until applied
-- and owner verification SQL confirms the function + trigger path.
--
-- Requires: 20261012010000_milestone1_intake_activation.sql
-- Recommended first: 20261013010000_signup_fee_update_restrict.sql
--
-- Auth note: can_verify_signup_fee() is org-wide (Accounts/Finance/Manager/Admin)
-- and does NOT imply can_access_student() (assignment-scoped). This RPC authorizes
-- on can_verify_signup_fee() alone after auth.uid() is present.
-- =============================================================================

-- Fee verifiers need SELECT on students for staging verify UI (RPC itself is definer).
drop policy if exists students_select_fee_verifier on public.students;
create policy students_select_fee_verifier on public.students
  for select to authenticated
  using (public.can_verify_signup_fee());

-- Narrow staff-field guard:
--  - fee verifiers: allowlist portal_activated_at (+ updated_at from set_updated_at)
--  - students: cannot self-activate
create or replace function public.enforce_student_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or public.is_assigned_consultant(old.id) then
    return new;
  end if;

  if public.can_verify_signup_fee() then
    if (to_jsonb(new) - 'portal_activated_at' - 'updated_at')
       is distinct from (to_jsonb(old) - 'portal_activated_at' - 'updated_at') then
      raise exception 'Fee verifiers may only set portal_activated_at on students';
    end if;
    return new;
  end if;

  if old.profile_id is not null and old.profile_id = auth.uid() then
    if new.assigned_consultant_id is distinct from old.assigned_consultant_id
      or new.journey_stage is distinct from old.journey_stage
      or new.case_id is distinct from old.case_id
      or new.profile_id is distinct from old.profile_id
      or new.archived_at is distinct from old.archived_at
      or new.email is distinct from old.email
      or new.full_name is distinct from old.full_name
      or new.portal_activated_at is distinct from old.portal_activated_at
    then
      raise exception 'Students cannot change staff-controlled student fields';
    end if;
    return new;
  end if;

  raise exception 'Not allowed to update this student record';
end;
$$;

create or replace function public.verify_signup_fee_and_activate(
  p_fee_id uuid,
  p_student_id uuid,
  p_action text,
  p_notes text default null,
  p_activate_portal boolean default true
)
returns table (
  fee_id uuid,
  student_id uuid,
  status public.signup_fee_status,
  portal_activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next public.signup_fee_status;
  v_fee public.signup_fee_payments%rowtype;
  v_activated timestamptz;
begin
  -- Authz before any privileged mutation.
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_action not in ('verify', 'waive', 'reject') then
    raise exception 'invalid action';
  end if;

  if not public.can_verify_signup_fee() then
    raise exception 'not authorized to verify signup fees';
  end if;

  v_next := case p_action
    when 'verify' then 'verified'::public.signup_fee_status
    when 'waive' then 'waived'::public.signup_fee_status
    else 'rejected'::public.signup_fee_status
  end;

  -- Lock fee row; require it belongs to the requested student.
  select *
  into v_fee
  from public.signup_fee_payments f
  where f.id = p_fee_id
    and f.student_id = p_student_id
  for update;

  if not found then
    raise exception 'signup fee row not found for student';
  end if;

  update public.signup_fee_payments f
  set
    status = v_next,
    verified_by = auth.uid(),
    verified_at = now(),
    notes = coalesce(nullif(trim(p_notes), ''), f.notes)
  where f.id = v_fee.id
  returning * into v_fee;

  v_activated := null;
  if p_activate_portal and v_next in ('verified', 'waived') then
    update public.students s
    set portal_activated_at = coalesce(s.portal_activated_at, now())
    where s.id = p_student_id
    returning s.portal_activated_at into v_activated;

    if not found then
      raise exception 'student row missing during activation';
    end if;
  else
    select s.portal_activated_at into v_activated
    from public.students s
    where s.id = p_student_id;
  end if;

  return query
  select v_fee.id, v_fee.student_id, v_fee.status, v_activated;
end;
$$;

revoke all on function public.verify_signup_fee_and_activate(uuid, uuid, text, text, boolean) from public;
revoke all on function public.verify_signup_fee_and_activate(uuid, uuid, text, text, boolean) from anon;
grant execute on function public.verify_signup_fee_and_activate(uuid, uuid, text, text, boolean) to authenticated;

comment on function public.verify_signup_fee_and_activate(uuid, uuid, text, text, boolean) is
  'Single-transaction fee verify/waive/reject with optional portal activation. Authored for owner apply; wire portal-intake only after remote confirmation.';
