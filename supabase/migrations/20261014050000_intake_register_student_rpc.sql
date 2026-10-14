-- =============================================================================
-- Global Roots — Narrow intake registration RPC (M1 Option 4)
-- Forward-only. DO NOT apply without owner confirmation.
-- Depends on:
--   20261014020000_front_desk_intake_ownership.sql (registered_by + stamp trigger)
--   20261012010000_milestone1_intake_activation.sql (can_record_intake, inquiry_channel)
--
-- Does NOT drop students_select_intake_registrar in this step.
-- Follow-up prepared as 20261014060000_drop_students_select_intake_registrar.sql
-- (apply only after staging JWT REST proves deny on owned select=*).
-- Does NOT extend can_access_student with registered_by.
-- =============================================================================

create or replace function public.intake_register_student(
  p_case_id text,
  p_full_name text,
  p_email text,
  p_phone text default null,
  p_whatsapp text default null,
  p_city text default null,
  p_destination text default null,
  p_program text default null,
  p_study_level text default null,
  p_assigned_consultant_id uuid default null,
  p_inquiry_source text default null,
  p_inquiry_channel public.inquiry_channel default null,
  p_intake_date date default null,
  p_registration_notes text default null,
  p_profile_id uuid default null
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
  journey_stage public.journey_stage,
  assigned_consultant_id uuid,
  registered_by uuid,
  inquiry_source text,
  inquiry_channel public.inquiry_channel,
  intake_date date,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.students;
  v_email text := trim(p_email);
  v_name text := trim(p_full_name);
  v_case text := trim(p_case_id);
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not public.can_record_intake() then
    raise exception 'not authorized to register intake';
  end if;

  if v_case is null or v_case = '' then
    raise exception 'case_id is required';
  end if;
  if v_name is null or v_name = '' then
    raise exception 'full_name is required';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'email is required';
  end if;

  -- DEFINER-visible uniqueness check (callers may lack SELECT on other students).
  if exists (
    select 1 from public.students s where lower(s.email) = lower(v_email)
  ) then
    raise exception 'duplicate student email';
  end if;

  if p_assigned_consultant_id is not null then
    if not exists (
      select 1 from public.consultants c where c.id = p_assigned_consultant_id
    ) then
      raise exception 'assigned consultant not found';
    end if;
  end if;

  insert into public.students (
    case_id,
    full_name,
    email,
    phone,
    whatsapp,
    city,
    destination,
    program,
    study_level,
    journey_stage,
    assigned_consultant_id,
    registered_by,
    inquiry_source,
    inquiry_channel,
    intake_date,
    registration_notes,
    portal_activated_at,
    profile_id
  )
  values (
    v_case,
    v_name,
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_destination, '')), ''),
    nullif(trim(coalesce(p_program, '')), ''),
    nullif(trim(coalesce(p_study_level, '')), ''),
    'profile_submitted'::public.journey_stage,
    p_assigned_consultant_id,
    -- Force ownership stamp; ignore any client attempt to set another registrar.
    -- Admin also stamps self (matches app session.userId behavior).
    v_uid,
    nullif(trim(coalesce(p_inquiry_source, '')), ''),
    p_inquiry_channel,
    p_intake_date,
    nullif(trim(coalesce(p_registration_notes, '')), ''),
    null,
    p_profile_id
  )
  returning * into v_row;

  -- Narrow return: no dob, archived_at, portal_activated_at, registration_notes, last_activity_at.
  return query
  select
    v_row.id,
    v_row.case_id,
    v_row.full_name,
    v_row.email,
    v_row.phone,
    v_row.whatsapp,
    v_row.city,
    v_row.destination,
    v_row.program,
    v_row.study_level,
    v_row.journey_stage,
    v_row.assigned_consultant_id,
    v_row.registered_by,
    v_row.inquiry_source,
    v_row.inquiry_channel,
    v_row.intake_date,
    v_row.created_at,
    v_row.updated_at;
end;
$$;

comment on function public.intake_register_student is
  'SECURITY DEFINER intake insert returning minimal columns. Forces registered_by=auth.uid(). Does not grant table SELECT of other columns.';

revoke all on function public.intake_register_student(
  text, text, text, text, text, text, text, text, text, uuid, text,
  public.inquiry_channel, date, text, uuid
) from public;
revoke all on function public.intake_register_student(
  text, text, text, text, text, text, text, text, text, uuid, text,
  public.inquiry_channel, date, text, uuid
) from anon;
grant execute on function public.intake_register_student(
  text, text, text, text, text, text, text, text, text, uuid, text,
  public.inquiry_channel, date, text, uuid
) to authenticated;
