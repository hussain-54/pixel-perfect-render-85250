-- =============================================================================
-- Milestone 1b — Secure student profile claim (no service role)
-- Depends on: profiles, students, handle_new_user / app_role foundation.
-- Students with profile_id IS NULL cannot satisfy students_update USING
-- (profile_id = auth.uid()), so claim must use a SECURITY DEFINER RPC.
-- DO NOT apply without owner approval.
-- =============================================================================

create or replace function public.claim_own_student_record()
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.students;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select p.email into v_email
  from public.profiles p
  where p.id = v_uid;

  if v_email is null or btrim(v_email) = '' then
    raise exception 'Profile email not found for this account';
  end if;

  -- Already linked to this auth user
  select * into v_row
  from public.students s
  where s.profile_id = v_uid
  limit 1;
  if found then
    return v_row;
  end if;

  -- Link exactly one unlinked CRM row whose email matches the trusted profile email.
  update public.students s
  set profile_id = v_uid,
      updated_at = now()
  where s.id = (
    select s2.id
    from public.students s2
    where s2.profile_id is null
      and lower(s2.email) = lower(v_email)
    order by s2.created_at asc
    limit 1
    for update skip locked
  )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'No matching student registration found for this account email';
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_own_student_record() from public;
grant execute on function public.claim_own_student_record() to authenticated;

comment on function public.claim_own_student_record() is
  'Links students.profile_id to auth.uid() when emails match and profile_id is null. Never trusts client student ids.';
