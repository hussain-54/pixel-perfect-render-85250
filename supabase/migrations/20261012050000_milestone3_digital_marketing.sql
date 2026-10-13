-- =============================================================================
-- Milestone 3C — Digital Marketing campaigns + inquiry attribution
-- Reuses public.consultation_requests (no second CRM). Forward-only.
-- DO NOT apply without owner approval.
-- =============================================================================

do $$ begin
  create type public.marketing_campaign_status as enum (
    'draft',
    'active',
    'paused',
    'completed'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default '',
  status public.marketing_campaign_status not null default 'draft',
  starts_on date,
  ends_on date,
  budget_note text,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaign_dates_ok check (
    ends_on is null or starts_on is null or ends_on >= starts_on
  )
);

alter table public.consultation_requests
  add column if not exists campaign_id uuid references public.marketing_campaigns (id) on delete set null;

alter table public.consultation_requests
  add column if not exists attribution_source text;

create index if not exists consultation_requests_campaign_idx
  on public.consultation_requests (campaign_id)
  where campaign_id is not null;

drop trigger if exists marketing_campaigns_set_updated_at on public.marketing_campaigns;
create trigger marketing_campaigns_set_updated_at
  before update on public.marketing_campaigns
  for each row execute function public.set_updated_at();

create index if not exists marketing_campaigns_status_idx
  on public.marketing_campaigns (status, created_at desc);

alter table public.marketing_campaigns enable row level security;

create or replace function public.can_access_marketing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in (
        'digital_manager',
        'manager',
        'admin',
        'front_desk_student_affairs'
      ),
      false
    )
    or public.is_consultant();
$$;

create or replace function public.can_mutate_marketing()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in (
        'digital_manager',
        'manager',
        'admin'
      ),
      false
    );
$$;

drop policy if exists marketing_campaigns_select on public.marketing_campaigns;
create policy marketing_campaigns_select on public.marketing_campaigns
  for select to authenticated
  using (public.can_access_marketing());

drop policy if exists marketing_campaigns_insert on public.marketing_campaigns;
create policy marketing_campaigns_insert on public.marketing_campaigns
  for insert to authenticated
  with check (public.can_mutate_marketing());

drop policy if exists marketing_campaigns_update on public.marketing_campaigns;
create policy marketing_campaigns_update on public.marketing_campaigns
  for update to authenticated
  using (public.can_mutate_marketing())
  with check (public.can_mutate_marketing());

grant select, insert, update on public.marketing_campaigns to authenticated;
grant execute on function public.can_access_marketing() to authenticated;
grant execute on function public.can_mutate_marketing() to authenticated;
