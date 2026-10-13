-- =============================================================================
-- Global Roots — Milestone 1: intake, signup fee gate, agreement, handover
-- Forward-only additive migration. DO NOT apply without owner approval.
-- Local file is not proof of remote apply.
-- =============================================================================

-- Business role (matrix) distinct from technical app_role / portal path.
do $$ begin
  create type public.business_role as enum (
    'front_desk_student_affairs',
    'counsellor_consultant',
    'admission_team',
    'student_portal',
    'accounts_banking_finance',
    'hr_system',
    'digital_manager',
    'office_ops',
    'manager',
    'admin'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.signup_fee_status as enum (
    'unpaid', 'claimed', 'verified', 'waived', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.inquiry_channel as enum ('physical', 'online');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.counselling_session_mode as enum ('physical', 'online');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.handover_status as enum ('submitted', 'accepted', 'returned');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists business_role public.business_role;

comment on column public.profiles.business_role is
  'Approved matrix business role; technical app_role still drives portal path.';

alter table public.students
  add column if not exists inquiry_source text,
  add column if not exists inquiry_channel public.inquiry_channel,
  add column if not exists intake_date date,
  add column if not exists registration_notes text,
  add column if not exists portal_activated_at timestamptz;

create index if not exists students_portal_activated_idx
  on public.students (portal_activated_at);

-- Signup fee (NOT offer deposits). One current row per student.
create table if not exists public.signup_fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.students (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'PKR',
  payment_method text,
  reference_receipt text,
  status public.signup_fee_status not null default 'unpaid',
  recorded_by uuid references public.profiles (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists signup_fee_payments_set_updated_at on public.signup_fee_payments;
create trigger signup_fee_payments_set_updated_at
  before update on public.signup_fee_payments
  for each row execute function public.set_updated_at();

create index if not exists signup_fee_payments_status_idx
  on public.signup_fee_payments (status);

create table if not exists public.counselling_agreements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  consented boolean not null default false,
  consent_label text not null default 'Counselling agreement / consent recorded',
  session_date date,
  session_mode public.counselling_session_mode,
  attendance text,
  summary text,
  outcome text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists counselling_agreements_student_idx
  on public.counselling_agreements (student_id, created_at desc);

create table if not exists public.admission_handovers (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  from_consultant_id uuid references public.consultants (id) on delete set null,
  to_owner_id uuid references public.consultants (id) on delete set null,
  status public.handover_status not null default 'submitted',
  checklist jsonb not null default '{}'::jsonb,
  summary text not null default '',
  missing_information text,
  handed_over_by uuid references public.profiles (id) on delete set null,
  handed_over_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists admission_handovers_set_updated_at on public.admission_handovers;
create trigger admission_handovers_set_updated_at
  before update on public.admission_handovers
  for each row execute function public.set_updated_at();

create index if not exists admission_handovers_student_idx
  on public.admission_handovers (student_id, handed_over_at desc);
create index if not exists admission_handovers_status_idx
  on public.admission_handovers (status);

-- Helpers for fee verification (Accounts business role or admin).
create or replace function public.current_business_role()
returns public.business_role
language sql
stable
security definer
set search_path = public
as $$
  select business_role from public.profiles where id = auth.uid();
$$;

create or replace function public.can_verify_signup_fee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in ('accounts_banking_finance', 'manager', 'admin'),
      false
    );
$$;

create or replace function public.can_record_intake()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.is_consultant()
    or coalesce(
      public.current_business_role() in (
        'front_desk_student_affairs',
        'counsellor_consultant',
        'admission_team',
        'manager',
        'admin'
      ),
      false
    );
$$;

alter table public.signup_fee_payments enable row level security;
alter table public.counselling_agreements enable row level security;
alter table public.admission_handovers enable row level security;

drop policy if exists signup_fee_select on public.signup_fee_payments;
create policy signup_fee_select on public.signup_fee_payments
  for select to authenticated
  using (public.can_access_student(student_id));

drop policy if exists signup_fee_insert on public.signup_fee_payments;
create policy signup_fee_insert on public.signup_fee_payments
  for insert to authenticated
  with check (
    public.can_record_intake()
    and public.can_access_student(student_id)
  );

drop policy if exists signup_fee_update on public.signup_fee_payments;
create policy signup_fee_update on public.signup_fee_payments
  for update to authenticated
  using (
    public.can_access_student(student_id)
    and (
      public.can_verify_signup_fee()
      or public.can_staff_mutate_student(student_id)
    )
  )
  with check (public.can_access_student(student_id));

drop policy if exists counselling_agreements_select on public.counselling_agreements;
create policy counselling_agreements_select on public.counselling_agreements
  for select to authenticated
  using (public.can_access_student(student_id));

drop policy if exists counselling_agreements_insert on public.counselling_agreements;
create policy counselling_agreements_insert on public.counselling_agreements
  for insert to authenticated
  with check (
    public.can_staff_mutate_student(student_id)
    or public.is_admin()
  );

drop policy if exists admission_handovers_select on public.admission_handovers;
create policy admission_handovers_select on public.admission_handovers
  for select to authenticated
  using (public.can_access_student(student_id));

drop policy if exists admission_handovers_insert on public.admission_handovers;
create policy admission_handovers_insert on public.admission_handovers
  for insert to authenticated
  with check (
    public.can_staff_mutate_student(student_id)
    or public.is_admin()
  );

drop policy if exists admission_handovers_update on public.admission_handovers;
create policy admission_handovers_update on public.admission_handovers
  for update to authenticated
  using (public.can_access_student(student_id) and (public.is_admin() or public.is_consultant()))
  with check (public.can_access_student(student_id));

grant select, insert, update on public.signup_fee_payments to authenticated;
grant select, insert on public.counselling_agreements to authenticated;
grant select, insert, update on public.admission_handovers to authenticated;
grant execute on function public.current_business_role() to authenticated;
grant execute on function public.can_verify_signup_fee() to authenticated;
grant execute on function public.can_record_intake() to authenticated;
