-- =============================================================================
-- Organization settings (admin Settings module) — singleton row
-- Forward-only. DO NOT apply without owner confirmation.
--
-- Schema gap proven before this migration:
--   - No organization_settings / app_settings table existed
--   - profiles has no preferences / org jsonb columns
--   - Preview Settings UI had nowhere safe to persist without inventing profile columns
--
-- Depends on: profiles, is_admin, current_business_role, set_updated_at
-- Does NOT alter auth, password, or permission-matrix tables.
-- =============================================================================

create table if not exists public.organization_settings (
  id smallint primary key default 1 check (id = 1),
  consultancy_name text not null default 'Global Roots Consultants',
  support_email text not null default 'support@globalroots.pk',
  portal_footer_note text not null default 'Global Roots Consultants — secure client portal.',
  email_admins_on_new_leads boolean not null default true,
  student_document_alerts boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_settings_name_len check (
    char_length(btrim(consultancy_name)) >= 2
    and char_length(consultancy_name) <= 200
  ),
  constraint organization_settings_email_len check (
    char_length(btrim(support_email)) >= 3
    and char_length(support_email) <= 254
  ),
  constraint organization_settings_footer_len check (
    char_length(portal_footer_note) <= 1000
  )
);

drop trigger if exists organization_settings_set_updated_at on public.organization_settings;
create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

insert into public.organization_settings (id)
values (1)
on conflict (id) do nothing;

create or replace function public.can_view_organization_settings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in ('manager', 'admin'),
      false
    );
$$;

create or replace function public.can_mutate_organization_settings()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Administrator-only at RLS; matrix Edit (level 2+) is enforced in app server fns.
  select public.is_admin();
$$;

alter table public.organization_settings enable row level security;

drop policy if exists organization_settings_select on public.organization_settings;
create policy organization_settings_select on public.organization_settings
  for select
  to authenticated
  using (public.can_view_organization_settings());

drop policy if exists organization_settings_update on public.organization_settings;
create policy organization_settings_update on public.organization_settings
  for update
  to authenticated
  using (public.can_mutate_organization_settings())
  with check (public.can_mutate_organization_settings());

-- No INSERT/DELETE for clients — singleton seeded by migration.
drop policy if exists organization_settings_insert on public.organization_settings;
drop policy if exists organization_settings_delete on public.organization_settings;

revoke all on table public.organization_settings from public;
revoke all on table public.organization_settings from anon;
revoke all on table public.organization_settings from authenticated;
grant select, update on table public.organization_settings to authenticated;

grant execute on function public.can_view_organization_settings() to authenticated;
grant execute on function public.can_mutate_organization_settings() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_business_role() to authenticated;

comment on table public.organization_settings is
  'Singleton org preferences for Admin Settings. Notification flags store preference only; they do not by themselves send email.';
