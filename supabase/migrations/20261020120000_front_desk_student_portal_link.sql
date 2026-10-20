-- Front Desk may link an existing student login to the intake row they registered.
-- Does not set portal_activated_at. Signup-fee verification remains the activation gate.
-- Local file is not proof of remote apply.

create or replace function public.enforce_student_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Set only inside front_desk_link_student_portal_profile for this transaction.
  if current_setting('app.portal_profile_link', true) = '1' then
    if (to_jsonb(new) - 'profile_id' - 'updated_at')
       is distinct from (to_jsonb(old) - 'profile_id' - 'updated_at') then
      raise exception 'Portal link may only set profile_id';
    end if;
    if new.portal_activated_at is distinct from old.portal_activated_at then
      raise exception 'Portal link cannot activate the portal';
    end if;
    return new;
  end if;

  if new.registered_by is distinct from old.registered_by and not public.is_admin() then
    raise exception 'registered_by cannot be changed';
  end if;

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

  if old.registered_by is not null and old.registered_by = auth.uid() then
    if (to_jsonb(new) - 'assigned_consultant_id' - 'updated_at')
       is distinct from (to_jsonb(old) - 'assigned_consultant_id' - 'updated_at') then
      raise exception 'Registrars may only assign a counsellor on owned intake rows';
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

-- Return type gains profile_id. Drop is required before replace.
drop function if exists public.list_front_desk_intake_summaries();

create function public.list_front_desk_intake_summaries()
returns table (
  id uuid,
  case_id text,
  full_name text,
  email text,
  phone text,
  whatsapp text,
  city text,
  destination text,
  program text,
  study_level text,
  inquiry_source text,
  inquiry_channel public.inquiry_channel,
  intake_date date,
  registration_notes text,
  assigned_consultant_id uuid,
  registered_by uuid,
  journey_stage public.journey_stage,
  portal_activated_at timestamptz,
  profile_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  signup_fee_status public.signup_fee_status,
  counsellor_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    s.id,
    s.case_id,
    s.full_name,
    s.email,
    s.phone,
    s.whatsapp,
    s.city,
    s.destination,
    s.program,
    s.study_level,
    s.inquiry_source,
    s.inquiry_channel,
    s.intake_date,
    s.registration_notes,
    s.assigned_consultant_id,
    s.registered_by,
    s.journey_stage,
    s.portal_activated_at,
    s.profile_id,
    s.created_at,
    s.updated_at,
    f.status as signup_fee_status,
    cp.full_name as counsellor_name
  from public.students s
  left join public.signup_fee_payments f on f.student_id = s.id
  left join public.profiles cp on cp.id = s.assigned_consultant_id
  where
    public.is_admin()
    or s.registered_by = auth.uid()
  order by s.created_at desc
  limit 500;
end;
$$;

revoke all on function public.list_front_desk_intake_summaries() from public;
revoke all on function public.list_front_desk_intake_summaries() from anon;
grant execute on function public.list_front_desk_intake_summaries() to authenticated;

create or replace function public.front_desk_link_student_portal_profile(
  p_student_id uuid,
  p_profile_id uuid
)
returns table (
  student_id uuid,
  profile_id uuid,
  portal_activated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students%rowtype;
  v_profile_email text;
  v_profile_role text;
  v_other uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  select * into v_student
  from public.students s
  where s.id = p_student_id
  for update;

  if v_student.id is null then
    raise exception 'Student record not found';
  end if;

  if not public.is_admin() and v_student.registered_by is distinct from auth.uid() then
    raise exception 'Not authorized for this student';
  end if;

  select p.email, p.role into v_profile_email, v_profile_role
  from public.profiles p
  where p.id = p_profile_id;

  if v_profile_email is null then
    raise exception 'Portal account profile not found';
  end if;
  if v_profile_role is distinct from 'student' then
    raise exception 'Only a student account can be linked';
  end if;
  if lower(btrim(v_profile_email)) is distinct from lower(btrim(v_student.email)) then
    raise exception 'Account email does not match the student record';
  end if;

  if v_student.profile_id is not null and v_student.profile_id is distinct from p_profile_id then
    raise exception 'Student record is already linked to another account';
  end if;

  select s.id into v_other
  from public.students s
  where s.profile_id = p_profile_id
    and s.id is distinct from p_student_id
  limit 1;
  if v_other is not null then
    raise exception 'This account is already linked to another student';
  end if;

  if v_student.profile_id is not distinct from p_profile_id then
    return query
    select v_student.id, v_student.profile_id, v_student.portal_activated_at;
    return;
  end if;

  perform set_config('app.portal_profile_link', '1', true);
  return query
  update public.students s
  set profile_id = p_profile_id,
      updated_at = now()
  where s.id = p_student_id
  returning s.id, s.profile_id, s.portal_activated_at;
end;
$$;

revoke all on function public.front_desk_link_student_portal_profile(uuid, uuid) from public;
revoke all on function public.front_desk_link_student_portal_profile(uuid, uuid) from anon;
grant execute on function public.front_desk_link_student_portal_profile(uuid, uuid) to authenticated;

comment on function public.front_desk_link_student_portal_profile(uuid, uuid) is
  'Links students.profile_id for a Front Desk-owned (or admin) intake row when emails match. Does not activate the portal.';
