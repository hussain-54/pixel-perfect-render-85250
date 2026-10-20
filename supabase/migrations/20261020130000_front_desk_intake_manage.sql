-- Front Desk intake manage: follow-up date, allowlisted edit, soft archive.
-- Uses transaction-local GUC so enforce_student_staff_fields can permit narrow FD mutations.
-- Local file is not proof of remote apply.

alter table public.students
  add column if not exists next_follow_up_at date;

comment on column public.students.next_follow_up_at is
  'Front Desk / staff follow-up date for intake; separate from fee verification and portal activation.';

-- Extend staff-field guard with FD intake mutate + archive GUCs.
create or replace function public.enforce_student_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

  -- Narrow Front Desk intake field edit (owned rows / admin via RPC).
  if current_setting('app.front_desk_intake_edit', true) = '1' then
    if (to_jsonb(new)
          - 'full_name' - 'phone' - 'whatsapp' - 'city'
          - 'destination' - 'program' - 'study_level'
          - 'inquiry_source' - 'inquiry_channel' - 'intake_date'
          - 'registration_notes' - 'next_follow_up_at' - 'updated_at'
          - 'email')
       is distinct from (to_jsonb(old)
          - 'full_name' - 'phone' - 'whatsapp' - 'city'
          - 'destination' - 'program' - 'study_level'
          - 'inquiry_source' - 'inquiry_channel' - 'intake_date'
          - 'registration_notes' - 'next_follow_up_at' - 'updated_at'
          - 'email') then
      raise exception 'Front Desk intake edit may only change permitted registration fields';
    end if;
    if new.portal_activated_at is distinct from old.portal_activated_at
       or new.profile_id is distinct from old.profile_id
       or new.registered_by is distinct from old.registered_by
       or new.assigned_consultant_id is distinct from old.assigned_consultant_id
       or new.journey_stage is distinct from old.journey_stage
       or new.case_id is distinct from old.case_id
       or new.archived_at is distinct from old.archived_at then
      raise exception 'Front Desk intake edit cannot change protected fields';
    end if;
    -- Email change only when no portal login is linked.
    if new.email is distinct from old.email and old.profile_id is not null then
      raise exception 'Cannot change email after a portal account is linked';
    end if;
    return new;
  end if;

  -- Soft archive / restore (owned rows / admin via RPC).
  if current_setting('app.front_desk_intake_archive', true) = '1' then
    if (to_jsonb(new) - 'archived_at' - 'updated_at')
       is distinct from (to_jsonb(old) - 'archived_at' - 'updated_at') then
      raise exception 'Archive action may only set archived_at';
    end if;
    if new.portal_activated_at is distinct from old.portal_activated_at then
      raise exception 'Archive cannot change portal activation';
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

drop function if exists public.list_front_desk_intake_summaries();

create function public.list_front_desk_intake_summaries(
  p_include_archived boolean default false
)
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
  next_follow_up_at date,
  assigned_consultant_id uuid,
  registered_by uuid,
  journey_stage public.journey_stage,
  portal_activated_at timestamptz,
  profile_id uuid,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  signup_fee_status public.signup_fee_status,
  signup_fee_amount numeric,
  signup_fee_currency text,
  signup_fee_method text,
  signup_fee_reference text,
  counsellor_name text,
  registrar_name text
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

  -- Non-admin Front Desk never lists archived by default; only admin may request archived.
  if p_include_archived and not public.is_admin() then
    raise exception 'Not authorized to list archived registrations';
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
    s.next_follow_up_at,
    s.assigned_consultant_id,
    s.registered_by,
    s.journey_stage,
    s.portal_activated_at,
    s.profile_id,
    s.archived_at,
    s.created_at,
    s.updated_at,
    f.status as signup_fee_status,
    f.amount as signup_fee_amount,
    f.currency as signup_fee_currency,
    f.payment_method as signup_fee_method,
    f.reference_receipt as signup_fee_reference,
    cp.full_name as counsellor_name,
    rp.full_name as registrar_name
  from public.students s
  left join public.signup_fee_payments f on f.student_id = s.id
  left join public.profiles cp on cp.id = s.assigned_consultant_id
  left join public.profiles rp on rp.id = s.registered_by
  where
    (public.is_admin() or s.registered_by = auth.uid())
    and (
      case
        when p_include_archived then s.archived_at is not null
        else s.archived_at is null
      end
    )
  order by s.created_at desc
  limit 500;
end;
$$;

revoke all on function public.list_front_desk_intake_summaries(boolean) from public;
revoke all on function public.list_front_desk_intake_summaries(boolean) from anon;
grant execute on function public.list_front_desk_intake_summaries(boolean) to authenticated;

create or replace function public.front_desk_update_intake_registration(
  p_student_id uuid,
  p_expected_updated_at timestamptz,
  p_full_name text,
  p_email text,
  p_phone text,
  p_whatsapp text,
  p_city text,
  p_destination text,
  p_program text,
  p_study_level text,
  p_inquiry_source text,
  p_inquiry_channel public.inquiry_channel,
  p_intake_date date,
  p_registration_notes text,
  p_next_follow_up_at date
)
returns table (
  id uuid,
  case_id text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.students%rowtype;
  v_new_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.students where students.id = p_student_id for update;
  if not found then
    raise exception 'Student record not found';
  end if;

  if v_row.archived_at is not null then
    raise exception 'Archived registrations cannot be edited';
  end if;

  if not public.is_admin() and v_row.registered_by is distinct from auth.uid() then
    raise exception 'Not authorized for this student';
  end if;

  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'This registration was updated by someone else. Reload and try again.';
  end if;

  v_new_email := lower(trim(coalesce(p_email, '')));
  if v_new_email = '' or position('@' in v_new_email) = 0 then
    raise exception 'A valid email is required';
  end if;
  if trim(coalesce(p_full_name, '')) = '' then
    raise exception 'Full name is required';
  end if;

  if v_row.profile_id is not null and v_new_email is distinct from lower(trim(v_row.email)) then
    raise exception 'Cannot change email after a portal account is linked';
  end if;

  perform set_config('app.front_desk_intake_edit', '1', true);

  update public.students s
  set
    full_name = trim(p_full_name),
    email = v_new_email,
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    whatsapp = nullif(trim(coalesce(p_whatsapp, '')), ''),
    city = nullif(trim(coalesce(p_city, '')), ''),
    destination = nullif(trim(coalesce(p_destination, '')), ''),
    program = nullif(trim(coalesce(p_program, '')), ''),
    study_level = nullif(trim(coalesce(p_study_level, '')), ''),
    inquiry_source = nullif(trim(coalesce(p_inquiry_source, '')), ''),
    inquiry_channel = p_inquiry_channel,
    intake_date = p_intake_date,
    registration_notes = nullif(trim(coalesce(p_registration_notes, '')), ''),
    next_follow_up_at = p_next_follow_up_at
  where s.id = p_student_id;

  return query
  select s.id, s.case_id, s.updated_at
  from public.students s
  where s.id = p_student_id;
end;
$$;

revoke all on function public.front_desk_update_intake_registration(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text, public.inquiry_channel, date, text, date
) from public;
revoke all on function public.front_desk_update_intake_registration(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text, public.inquiry_channel, date, text, date
) from anon;
grant execute on function public.front_desk_update_intake_registration(
  uuid, timestamptz, text, text, text, text, text, text, text, text, text, public.inquiry_channel, date, text, date
) to authenticated;

create or replace function public.front_desk_archive_registration(
  p_student_id uuid,
  p_archive boolean,
  p_reason text default null
)
returns table (
  id uuid,
  case_id text,
  archived_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.students%rowtype;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  select * into v_row from public.students where students.id = p_student_id for update;
  if not found then
    raise exception 'Student record not found';
  end if;

  if not public.is_admin() and v_row.registered_by is distinct from auth.uid() then
    raise exception 'Not authorized for this student';
  end if;

  -- Restore is admin-only.
  if not p_archive and not public.is_admin() then
    raise exception 'Only an administrator can restore an archived registration';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if p_archive and (v_reason is null or char_length(v_reason) < 3) then
    raise exception 'An archive reason is required';
  end if;

  perform set_config('app.front_desk_intake_archive', '1', true);

  update public.students s
  set archived_at = case when p_archive then coalesce(s.archived_at, now()) else null end
  where s.id = p_student_id;

  return query
  select s.id, s.case_id, s.archived_at
  from public.students s
  where s.id = p_student_id;
end;
$$;

revoke all on function public.front_desk_archive_registration(uuid, boolean, text) from public;
revoke all on function public.front_desk_archive_registration(uuid, boolean, text) from anon;
grant execute on function public.front_desk_archive_registration(uuid, boolean, text) to authenticated;
