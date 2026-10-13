-- =============================================================================
-- Milestone 3A — HR & Attendance foundation (forward-only)
-- Separate from student CRM / finance. DO NOT apply without owner approval.
-- =============================================================================

do $$ begin
  create type public.hr_employment_status as enum (
    'active',
    'on_leave',
    'terminated'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.hr_attendance_status as enum (
    'present',
    'absent',
    'late',
    'leave',
    'holiday'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  employee_code text not null unique,
  full_name text not null,
  department text not null default '',
  job_title text not null default '',
  status public.hr_employment_status not null default 'active',
  hired_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_attendance_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  work_date date not null,
  status public.hr_attendance_status not null default 'present',
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

drop trigger if exists hr_employees_set_updated_at on public.hr_employees;
create trigger hr_employees_set_updated_at
  before update on public.hr_employees
  for each row execute function public.set_updated_at();

drop trigger if exists hr_attendance_records_set_updated_at on public.hr_attendance_records;
create trigger hr_attendance_records_set_updated_at
  before update on public.hr_attendance_records
  for each row execute function public.set_updated_at();

create index if not exists hr_employees_status_idx on public.hr_employees (status);
create index if not exists hr_attendance_work_date_idx
  on public.hr_attendance_records (work_date desc);

alter table public.hr_employees enable row level security;
alter table public.hr_attendance_records enable row level security;

-- HR module access: admins + profiles.business_role = hr_system (or manager).
create or replace function public.can_access_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in ('hr_system', 'manager', 'admin'),
      false
    );
$$;

drop policy if exists hr_employees_select on public.hr_employees;
create policy hr_employees_select on public.hr_employees
  for select to authenticated
  using (public.can_access_hr() or profile_id = auth.uid());

drop policy if exists hr_employees_mutate on public.hr_employees;
create policy hr_employees_mutate on public.hr_employees
  for all to authenticated
  using (public.can_access_hr())
  with check (public.can_access_hr());

drop policy if exists hr_attendance_select on public.hr_attendance_records;
create policy hr_attendance_select on public.hr_attendance_records
  for select to authenticated
  using (
    public.can_access_hr()
    or exists (
      select 1 from public.hr_employees e
      where e.id = employee_id and e.profile_id = auth.uid()
    )
  );

drop policy if exists hr_attendance_mutate on public.hr_attendance_records;
create policy hr_attendance_mutate on public.hr_attendance_records
  for all to authenticated
  using (public.can_access_hr())
  with check (public.can_access_hr());

grant select, insert, update on public.hr_employees to authenticated;
grant select, insert, update on public.hr_attendance_records to authenticated;
grant execute on function public.can_access_hr() to authenticated;
