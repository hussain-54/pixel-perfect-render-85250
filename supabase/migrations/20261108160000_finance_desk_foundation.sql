-- =============================================================================
-- Finance desk foundation — office ledger drafts for Banking & Finance.
-- Distinct from signup_fee_payments / university_fee_obligations (student fees).
-- Forward-only. Owner apply on staging before Admin Banking desk ledger tabs.
-- =============================================================================

create table if not exists public.finance_desk_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'PKR',
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'reversed')),
  entry_date date not null default (timezone('utc', now()))::date,
  detail jsonb not null default '{}'::jsonb,
  student_id uuid references public.students (id) on delete set null,
  parent_id uuid references public.finance_desk_entries (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  posted_by uuid references public.profiles (id) on delete set null,
  posted_at timestamptz,
  reversed_by uuid references public.profiles (id) on delete set null,
  reversed_at timestamptz,
  reverse_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_desk_entries_kind_len check (
    char_length(btrim(kind)) >= 2 and char_length(kind) <= 40
  ),
  constraint finance_desk_entries_title_len check (
    char_length(btrim(title)) >= 2 and char_length(title) <= 200
  ),
  constraint finance_desk_entries_currency_len check (char_length(currency) between 3 and 8)
);

drop trigger if exists finance_desk_entries_set_updated_at on public.finance_desk_entries;
create trigger finance_desk_entries_set_updated_at
  before update on public.finance_desk_entries
  for each row execute function public.set_updated_at();

create index if not exists finance_desk_entries_kind_status_idx
  on public.finance_desk_entries (kind, status, entry_date desc);

create index if not exists finance_desk_entries_status_idx
  on public.finance_desk_entries (status, updated_at desc);

create table if not exists public.finance_desk_audits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  target text not null default '',
  detail text not null default '',
  entry_id uuid references public.finance_desk_entries (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint finance_desk_audits_action_len check (char_length(btrim(action)) >= 2)
);

create index if not exists finance_desk_audits_created_idx
  on public.finance_desk_audits (created_at desc);

alter table public.finance_desk_entries enable row level security;
alter table public.finance_desk_audits enable row level security;

-- Reuse CMS-style admin gate when available; otherwise admin app role.
create or replace function public.can_view_finance_desk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.business_role in ('accounts_banking_finance', 'manager', 'admin')
    );
$$;

create or replace function public.can_mutate_finance_desk()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.business_role in ('accounts_banking_finance', 'manager', 'admin')
    );
$$;

drop policy if exists finance_desk_entries_select on public.finance_desk_entries;
create policy finance_desk_entries_select on public.finance_desk_entries
  for select to authenticated
  using (public.can_view_finance_desk());

drop policy if exists finance_desk_entries_insert on public.finance_desk_entries;
create policy finance_desk_entries_insert on public.finance_desk_entries
  for insert to authenticated
  with check (public.can_mutate_finance_desk());

drop policy if exists finance_desk_entries_update on public.finance_desk_entries;
create policy finance_desk_entries_update on public.finance_desk_entries
  for update to authenticated
  using (public.can_mutate_finance_desk())
  with check (public.can_mutate_finance_desk());

drop policy if exists finance_desk_audits_select on public.finance_desk_audits;
create policy finance_desk_audits_select on public.finance_desk_audits
  for select to authenticated
  using (public.can_view_finance_desk());

drop policy if exists finance_desk_audits_insert on public.finance_desk_audits;
create policy finance_desk_audits_insert on public.finance_desk_audits
  for insert to authenticated
  with check (public.can_mutate_finance_desk());

revoke all on table public.finance_desk_entries from public, anon, authenticated;
revoke all on table public.finance_desk_audits from public, anon, authenticated;
grant select, insert, update on table public.finance_desk_entries to authenticated;
grant select, insert on table public.finance_desk_audits to authenticated;
grant execute on function public.can_view_finance_desk() to authenticated;
grant execute on function public.can_mutate_finance_desk() to authenticated;

comment on table public.finance_desk_entries is
  'Office finance desk drafts/posts. Not student signup or university fee verification rows.';
comment on table public.finance_desk_audits is
  'Append-only audit trail for finance desk actions.';
