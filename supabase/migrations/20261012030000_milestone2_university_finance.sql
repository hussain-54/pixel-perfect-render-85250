-- =============================================================================
-- Milestone 2 — University fee obligations + payment claims (separate from signup fees)
-- Does NOT replace public.signup_fee_payments or offer deposits.
-- Forward-only. DO NOT apply without owner approval.
-- =============================================================================

do $$ begin
  create type public.university_fee_kind as enum (
    'application_fee',
    'tuition',
    'offer_deposit',
    'visa_fee',
    'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.university_fee_status as enum (
    'due',
    'claimed',
    'verified',
    'waived',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.university_fee_obligations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  kind public.university_fee_kind not null default 'other',
  label text not null default '',
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'PKR',
  due_date date,
  status public.university_fee_status not null default 'due',
  payment_method text,
  reference_receipt text,
  evidence_notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists university_fee_obligations_set_updated_at on public.university_fee_obligations;
create trigger university_fee_obligations_set_updated_at
  before update on public.university_fee_obligations
  for each row execute function public.set_updated_at();

create index if not exists university_fee_obligations_student_idx
  on public.university_fee_obligations (student_id, status);
create index if not exists university_fee_obligations_status_idx
  on public.university_fee_obligations (status, created_at desc);
create index if not exists university_fee_obligations_application_idx
  on public.university_fee_obligations (application_id)
  where application_id is not null;
create index if not exists university_fee_obligations_offer_idx
  on public.university_fee_obligations (offer_id)
  where offer_id is not null;

alter table public.university_fee_obligations enable row level security;

drop policy if exists university_fee_select on public.university_fee_obligations;
create policy university_fee_select on public.university_fee_obligations
  for select to authenticated
  using (public.can_access_student(student_id));

drop policy if exists university_fee_insert on public.university_fee_obligations;
create policy university_fee_insert on public.university_fee_obligations
  for insert to authenticated
  with check (
    public.can_staff_mutate_student(student_id)
    or public.is_admin()
    or public.can_verify_signup_fee()
  );

drop policy if exists university_fee_update on public.university_fee_obligations;
create policy university_fee_update on public.university_fee_obligations
  for update to authenticated
  using (
    public.can_access_student(student_id)
    and (
      public.can_verify_signup_fee()
      or public.can_staff_mutate_student(student_id)
      or public.is_admin()
    )
  )
  with check (public.can_access_student(student_id));

grant select, insert, update on public.university_fee_obligations to authenticated;
