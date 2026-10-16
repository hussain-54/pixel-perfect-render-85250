-- =============================================================================
-- Scholarships catalog (admissions module)
-- Forward-only. DO NOT apply without owner confirmation.
-- Depends on: universities, profiles, is_admin/is_consultant, set_updated_at
-- Does NOT alter offers.scholarship_note.
-- =============================================================================

do $$ begin
  create type public.scholarship_status as enum (
    'draft',
    'published',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.scholarship_funding_type as enum (
    'fully_funded',
    'partial_funding',
    'tuition_waiver'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.scholarships (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  provider text not null default '',
  university_id uuid references public.universities (id) on delete set null,
  country text not null default '',
  study_level text not null default '',
  field_of_study text not null default '',
  funding_type public.scholarship_funding_type not null default 'partial_funding',
  funding_description text not null default '',
  eligibility text not null default '',
  opens_on date,
  closes_on date,
  application_url text,
  status public.scholarship_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scholarships_title_len check (char_length(btrim(title)) >= 2),
  constraint scholarships_dates_ok check (
    closes_on is null or opens_on is null or closes_on >= opens_on
  )
);

drop trigger if exists scholarships_set_updated_at on public.scholarships;
create trigger scholarships_set_updated_at
  before update on public.scholarships
  for each row execute function public.set_updated_at();

create index if not exists scholarships_status_closes_idx
  on public.scholarships (status, closes_on);

create index if not exists scholarships_country_idx
  on public.scholarships (country);

create index if not exists scholarships_university_idx
  on public.scholarships (university_id)
  where university_id is not null;

create index if not exists scholarships_published_idx
  on public.scholarships (status, updated_at desc)
  where status = 'published';

alter table public.scholarships enable row level security;

-- Published-only for anon/authenticated (no is_admin/is_consultant — anon lacks EXECUTE).
-- Staff full SELECT is a separate authenticated policy below.
drop policy if exists scholarships_select on public.scholarships;
drop policy if exists scholarships_select_published on public.scholarships;
drop policy if exists scholarships_select_staff on public.scholarships;
create policy scholarships_select_published on public.scholarships
  for select
  to anon, authenticated
  using (status = 'published'::public.scholarship_status);

create policy scholarships_select_staff on public.scholarships
  for select
  to authenticated
  using (public.is_admin() or public.is_consultant());

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_consultant() to authenticated;

drop policy if exists scholarships_insert on public.scholarships;
create policy scholarships_insert on public.scholarships
  for insert
  to authenticated
  with check (public.is_admin() or public.is_consultant());

drop policy if exists scholarships_update on public.scholarships;
create policy scholarships_update on public.scholarships
  for update
  to authenticated
  using (public.is_admin() or public.is_consultant())
  with check (public.is_admin() or public.is_consultant());

-- No DELETE grant — archive via status instead.
revoke all on table public.scholarships from public;
revoke all on table public.scholarships from anon;
revoke all on table public.scholarships from authenticated;
grant select on table public.scholarships to anon;
grant select, insert, update on table public.scholarships to authenticated;

comment on table public.scholarships is
  'Admissions scholarship catalog. Public/anon may SELECT published rows only; staff mutate via app matrix + RLS.';
