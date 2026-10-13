-- =============================================================================
-- Milestone 3B — HR reporting manager, leave requests, attendance corrections
-- Forward-only. Requires 20261012040000_milestone3_hr_attendance.sql
-- DO NOT apply without owner approval.
-- =============================================================================

-- Reporting manager + unique profile link (one employee row per profile)
alter table public.hr_employees
  add column if not exists reporting_manager_id uuid references public.hr_employees (id) on delete set null;

create unique index if not exists hr_employees_profile_id_uidx
  on public.hr_employees (profile_id)
  where profile_id is not null;

do $$ begin
  create type public.hr_leave_status as enum (
    'pending',
    'approved',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.hr_leave_type as enum (
    'annual',
    'sick',
    'unpaid',
    'other'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.hr_employees (id) on delete cascade,
  leave_type public.hr_leave_type not null default 'annual',
  start_date date not null,
  end_date date not null,
  reason text not null default '',
  status public.hr_leave_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_leave_dates_ok check (end_date >= start_date)
);

create table if not exists public.hr_attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.hr_attendance_records (id) on delete cascade,
  previous_status public.hr_attendance_status not null,
  new_status public.hr_attendance_status not null,
  reason text not null,
  corrected_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

drop trigger if exists hr_leave_requests_set_updated_at on public.hr_leave_requests;
create trigger hr_leave_requests_set_updated_at
  before update on public.hr_leave_requests
  for each row execute function public.set_updated_at();

create index if not exists hr_leave_requests_status_idx
  on public.hr_leave_requests (status, created_at desc);
create index if not exists hr_leave_requests_employee_idx
  on public.hr_leave_requests (employee_id, start_date desc);
create index if not exists hr_attendance_corrections_attendance_idx
  on public.hr_attendance_corrections (attendance_id, created_at desc);

alter table public.hr_leave_requests enable row level security;
alter table public.hr_attendance_corrections enable row level security;

create or replace function public.can_mutate_hr()
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

create or replace function public.is_own_hr_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hr_employees e
    where e.id = p_employee_id and e.profile_id = auth.uid()
  );
$$;

drop policy if exists hr_leave_select on public.hr_leave_requests;
create policy hr_leave_select on public.hr_leave_requests
  for select to authenticated
  using (public.can_access_hr() or public.is_own_hr_employee(employee_id));

drop policy if exists hr_leave_insert on public.hr_leave_requests;
create policy hr_leave_insert on public.hr_leave_requests
  for insert to authenticated
  with check (
    public.can_mutate_hr()
    or public.is_own_hr_employee(employee_id)
  );

drop policy if exists hr_leave_update on public.hr_leave_requests;
create policy hr_leave_update on public.hr_leave_requests
  for update to authenticated
  using (
    public.can_mutate_hr()
    or (public.is_own_hr_employee(employee_id) and status = 'pending')
  )
  with check (
    public.can_mutate_hr()
    or public.is_own_hr_employee(employee_id)
  );

drop policy if exists hr_attendance_corrections_select on public.hr_attendance_corrections;
create policy hr_attendance_corrections_select on public.hr_attendance_corrections
  for select to authenticated
  using (
    public.can_access_hr()
    or exists (
      select 1
      from public.hr_attendance_records a
      join public.hr_employees e on e.id = a.employee_id
      where a.id = attendance_id and e.profile_id = auth.uid()
    )
  );

drop policy if exists hr_attendance_corrections_insert on public.hr_attendance_corrections;
create policy hr_attendance_corrections_insert on public.hr_attendance_corrections
  for insert to authenticated
  with check (public.can_mutate_hr());

grant select, insert, update on public.hr_leave_requests to authenticated;
grant select, insert on public.hr_attendance_corrections to authenticated;
grant execute on function public.can_mutate_hr() to authenticated;
grant execute on function public.is_own_hr_employee(uuid) to authenticated;
