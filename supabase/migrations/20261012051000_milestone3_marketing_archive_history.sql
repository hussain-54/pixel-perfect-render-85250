-- =============================================================================
-- Milestone 3C+ — Marketing archive + attribution history (forward-only)
-- Requires 20261012050000_milestone3_digital_marketing.sql
-- DO NOT apply without owner approval.
-- =============================================================================

alter table public.marketing_campaigns
  add column if not exists archived_at timestamptz;

-- Preserve original inquiry source separately from mutable campaign attribution.
alter table public.consultation_requests
  add column if not exists original_attribution_source text;

create table if not exists public.marketing_attribution_history (
  id uuid primary key default gen_random_uuid(),
  consultation_request_id uuid not null references public.consultation_requests (id) on delete cascade,
  previous_campaign_id uuid references public.marketing_campaigns (id) on delete set null,
  new_campaign_id uuid references public.marketing_campaigns (id) on delete set null,
  previous_attribution_source text,
  new_attribution_source text,
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketing_attribution_history_inquiry_idx
  on public.marketing_attribution_history (consultation_request_id, created_at desc);

create index if not exists marketing_campaigns_archived_idx
  on public.marketing_campaigns (archived_at)
  where archived_at is null;

alter table public.marketing_attribution_history enable row level security;

drop policy if exists marketing_attribution_history_select on public.marketing_attribution_history;
create policy marketing_attribution_history_select on public.marketing_attribution_history
  for select to authenticated
  using (public.can_access_marketing());

drop policy if exists marketing_attribution_history_insert on public.marketing_attribution_history;
create policy marketing_attribution_history_insert on public.marketing_attribution_history
  for insert to authenticated
  with check (public.can_mutate_marketing() or public.is_consultant() or public.is_admin());

grant select, insert on public.marketing_attribution_history to authenticated;
