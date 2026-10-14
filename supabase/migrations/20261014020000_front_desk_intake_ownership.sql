-- =============================================================================
-- Global Roots — Front Desk intake ownership (Phase 2)
-- Forward-only additive. DO NOT apply without owner confirmation.
-- Local file is not proof of remote apply.
--
-- Design:
-- - students.registered_by = intake registrar (profiles.id / auth.uid())
-- - Do NOT extend can_access_student with registered_by (avoids child-table leak
--   into applications, assessments, offers, visa, private notes).
-- - Narrow SELECT policy for registrar on students rows only; server must select
--   intake-safe columns (RLS cannot hide columns on a permitted row).
-- - Security-definer RPCs for intake list + counsellor assign by registrar.
-- - Stamp / lock registered_by via triggers; extend enforce_student_staff_fields
--   so front_desk_assign_counsellor is not blocked by the staff UPDATE trigger.
-- =============================================================================

alter table public.students
  add column if not exists registered_by uuid references public.profiles (id) on delete set null;

comment on column public.students.registered_by is
  'Front Desk (or staff) user who created the intake row; stamped server-side / via trigger.';

create index if not exists students_registered_by_idx
  on public.students (registered_by)
  where registered_by is not null;

-- Registrar may read own intake rows. RLS is row-level only — column privileges still
-- apply. App ownership checks use select('id'); list UI uses list_front_desk_intake_summaries.
-- Residual: authenticated JWT may still select all columns on owned rows via REST.
-- Kept because portalRecordSignupFee ownership proof depends on this SELECT path.
drop policy if exists students_select_intake_registrar on public.students;
create policy students_select_intake_registrar
  on public.students
  for select
  to authenticated
  using (registered_by = auth.uid());

-- Stamp ownership on INSERT; lock changes except admin.
-- When auth.uid() is null (service_role batch jobs), preserve the provided value.
create or replace function public.enforce_students_registered_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      return new;
    end if;
    if public.is_admin() then
      if new.registered_by is null then
        new.registered_by := auth.uid();
      end if;
    else
      new.registered_by := auth.uid();
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.registered_by is distinct from old.registered_by
       and not public.is_admin() then
      raise exception 'registered_by cannot be changed';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists students_enforce_registered_by on public.students;
create trigger students_enforce_registered_by
  before insert or update on public.students
  for each row execute function public.enforce_students_registered_by();

-- Merge staff-field enforcement (must preserve fee-verifier path from
-- 20261013020000_signup_fee_verify_activate_rpc.sql):
--  - admin / assigned consultant: unrestricted (registered_by still locked above for non-admin)
--  - fee verifiers: allowlist portal_activated_at (+ updated_at from set_updated_at)
--  - intake registrar: allowlist assigned_consultant_id (+ updated_at) on owned rows
--  - owning student: cannot change staff-controlled fields (incl. portal_activated_at)
-- front_desk_assign_counsellor is SECURITY DEFINER but still fires this BEFORE UPDATE
-- trigger with the caller's auth.uid().
create or replace function public.enforce_student_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.registered_by is distinct from old.registered_by and not public.is_admin() then
    raise exception 'registered_by cannot be changed';
  end if;

  if public.is_admin() or public.is_assigned_consultant(old.id) then
    return new;
  end if;

  -- Restored from signup-fee verify/activate migration (do not drop on Phase 2 replace).
  if public.can_verify_signup_fee() then
    if (to_jsonb(new) - 'portal_activated_at' - 'updated_at')
       is distinct from (to_jsonb(old) - 'portal_activated_at' - 'updated_at') then
      raise exception 'Fee verifiers may only set portal_activated_at on students';
    end if;
    return new;
  end if;

  -- Intake registrar: counsellor assignment only (RPC path). Allowlist — not denylist.
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

-- Registrar may update only via RPC for assignment (no broad UPDATE grant for FD).
-- Existing students_update_staff / students_update_self_contact policies unchanged.

create or replace function public.is_front_desk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.business_role = 'front_desk_student_affairs'
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_front_desk() from public;
revoke all on function public.is_front_desk() from anon;
grant execute on function public.is_front_desk() to authenticated;

-- Narrow intake summary for Front Desk (and admin). Never returns unrelated students
-- for Front Desk; admin path is org-wide (admin already has students SELECT).
create or replace function public.list_front_desk_intake_summaries()
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

-- Front Desk / admin assign counsellor for rows they registered (or admin any).
create or replace function public.front_desk_assign_counsellor(
  p_student_id uuid,
  p_consultant_id uuid
)
returns public.students
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.students;
  desk_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_admin() or public.is_front_desk()) then
    raise exception 'Not authorized';
  end if;

  if p_consultant_id is null then
    raise exception 'Counsellor is required';
  end if;

  select exists (
    select 1
    from public.consultants c
    join public.profiles p on p.id = c.id
    where c.id = p_consultant_id
      and c.status = 'active'
      and p.business_role = 'counsellor_consultant'
  ) into desk_ok;

  if not desk_ok then
    raise exception 'Counsellor must be an active Counsellor / Consultant desk';
  end if;

  update public.students stu
  set assigned_consultant_id = p_consultant_id,
      updated_at = now()
  where stu.id = p_student_id
    and (public.is_admin() or stu.registered_by = auth.uid())
  returning * into s;

  if s.id is null then
    raise exception 'Student not found or not owned by registrar';
  end if;

  return s;
end;
$$;

revoke all on function public.front_desk_assign_counsellor(uuid, uuid) from public;
revoke all on function public.front_desk_assign_counsellor(uuid, uuid) from anon;
grant execute on function public.front_desk_assign_counsellor(uuid, uuid) to authenticated;

-- Eligible counsellor desks for Front Desk / admin / manager picker.
-- Manager has students Full in the business matrix and may reassign via app assign path;
-- align RPC with that intended model (not all consultants).
create or replace function public.list_active_counsellor_desks()
returns table (
  id uuid,
  full_name text,
  email text,
  department text,
  job_title text
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

  if not (
    public.is_admin()
    or public.is_front_desk()
    or coalesce(
      (select p.business_role = 'manager'
         from public.profiles p
        where p.id = auth.uid()),
      false
    )
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    c.id,
    p.full_name,
    p.email,
    c.department,
    c.job_title
  from public.consultants c
  join public.profiles p on p.id = c.id
  where c.status = 'active'
    and p.business_role = 'counsellor_consultant'
  order by p.full_name;
end;
$$;

revoke all on function public.list_active_counsellor_desks() from public;
revoke all on function public.list_active_counsellor_desks() from anon;
grant execute on function public.list_active_counsellor_desks() to authenticated;
