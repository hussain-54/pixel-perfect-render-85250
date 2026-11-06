-- =============================================================================
-- Website CMS foundation — draft/publish documents, announcements, media
-- Forward-only. Owner must apply on staging before Admin Website Management works.
--
-- Schema gap proven before this migration:
--   - No cms_* / website_* content tables
--   - Public site content is hardcoded in src/data + route components
--
-- Security model:
--   - Base tables: authenticated admin mutate only (is_admin)
--   - Public visitors: SELECT only via cms_public_* views (published payloads)
--   - Drafts never exposed on public views
-- =============================================================================

create table if not exists public.cms_documents (
  document_key text primary key,
  title text not null,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  draft_version integer not null default 1 check (draft_version >= 1),
  published_version integer not null default 0 check (published_version >= 0),
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_documents_key_format check (
    document_key ~ '^[a-z][a-z0-9_.-]{1,120}$'
  ),
  constraint cms_documents_title_len check (
    char_length(btrim(title)) >= 2 and char_length(title) <= 200
  )
);

drop trigger if exists cms_documents_set_updated_at on public.cms_documents;
create trigger cms_documents_set_updated_at
  before update on public.cms_documents
  for each row execute function public.set_updated_at();

create table if not exists public.cms_revisions (
  id uuid primary key default gen_random_uuid(),
  document_key text not null references public.cms_documents (document_key) on delete cascade,
  version integer not null check (version >= 1),
  payload jsonb not null,
  kind text not null check (kind in ('draft_snapshot', 'published')),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cms_revisions_note_len check (note is null or char_length(note) <= 500)
);

create index if not exists cms_revisions_document_idx
  on public.cms_revisions (document_key, created_at desc);

create table if not exists public.cms_announcements (
  id uuid primary key default gen_random_uuid(),
  internal_title text not null default '',
  body text not null,
  announcement_type text not null default 'general'
    check (announcement_type in (
      'general', 'important', 'admission_deadline', 'new_service', 'event', 'promotional'
    )),
  cta_label text,
  cta_href text,
  style_token text not null default 'navy'
    check (style_token in ('navy', 'royal', 'bright', 'muted', 'danger')),
  display_position text not null default 'top' check (display_position in ('top')),
  dismissible boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cms_announcements_body_len check (
    char_length(btrim(body)) >= 1 and char_length(body) <= 500
  ),
  constraint cms_announcements_title_len check (char_length(internal_title) <= 160),
  constraint cms_announcements_cta_label_len check (cta_label is null or char_length(cta_label) <= 80),
  constraint cms_announcements_cta_href_len check (cta_href is null or char_length(cta_href) <= 500)
);

drop trigger if exists cms_announcements_set_updated_at on public.cms_announcements;
create trigger cms_announcements_set_updated_at
  before update on public.cms_announcements
  for each row execute function public.set_updated_at();

create index if not exists cms_announcements_status_idx
  on public.cms_announcements (status, sort_order, starts_at, ends_at);

create table if not exists public.cms_media (
  id uuid primary key default gen_random_uuid(),
  storage_bucket text not null default 'website-media',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  alt_text text not null default '',
  folder text not null default 'general',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cms_media_path_unique unique (storage_bucket, storage_path),
  constraint cms_media_mime check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml')
  ),
  constraint cms_media_alt_len check (char_length(alt_text) <= 300),
  constraint cms_media_folder_len check (char_length(folder) <= 80)
);

create index if not exists cms_media_folder_idx on public.cms_media (folder, created_at desc);

-- Public-safe readers (security definer — never return draft payloads)
create or replace function public.get_cms_public_documents(p_keys text[] default null)
returns table (
  document_key text,
  payload jsonb,
  published_version integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.document_key,
    d.published as payload,
    d.published_version,
    d.published_at
  from public.cms_documents d
  where d.published is not null
    and (p_keys is null or d.document_key = any (p_keys));
$$;

-- Repair partial applies that created reserved-word column "position"
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_announcements'
      and column_name = 'position'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_announcements'
      and column_name = 'display_position'
  ) then
    alter table public.cms_announcements rename column "position" to display_position;
  end if;
end $$;

create or replace function public.get_cms_public_announcements()
returns table (
  id uuid,
  body text,
  announcement_type text,
  cta_label text,
  cta_href text,
  style_token text,
  display_position text,
  dismissible boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.body,
    a.announcement_type,
    a.cta_label,
    a.cta_href,
    a.style_token,
    a.display_position,
    a.dismissible,
    a.starts_at,
    a.ends_at,
    a.sort_order
  from public.cms_announcements a
  where a.status = 'published'
    and (a.starts_at is null or a.starts_at <= now())
    and (a.ends_at is null or a.ends_at >= now())
  order by a.sort_order asc, a.created_at desc;
$$;

-- Auth helpers
create or replace function public.can_view_cms_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

create or replace function public.can_mutate_cms()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin();
$$;

alter table public.cms_documents enable row level security;
alter table public.cms_revisions enable row level security;
alter table public.cms_announcements enable row level security;
alter table public.cms_media enable row level security;

drop policy if exists cms_documents_admin_all on public.cms_documents;
create policy cms_documents_admin_all on public.cms_documents
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists cms_revisions_admin_select on public.cms_revisions;
create policy cms_revisions_admin_select on public.cms_revisions
  for select to authenticated
  using (public.can_view_cms_admin());

drop policy if exists cms_revisions_admin_insert on public.cms_revisions;
create policy cms_revisions_admin_insert on public.cms_revisions
  for insert to authenticated
  with check (public.can_mutate_cms());

drop policy if exists cms_announcements_admin_all on public.cms_announcements;
create policy cms_announcements_admin_all on public.cms_announcements
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists cms_media_admin_all on public.cms_media;
create policy cms_media_admin_all on public.cms_media
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

-- Public read of published views only
revoke all on table public.cms_documents from public, anon, authenticated;
revoke all on table public.cms_revisions from public, anon, authenticated;
revoke all on table public.cms_announcements from public, anon, authenticated;
revoke all on table public.cms_media from public, anon, authenticated;

grant select, insert, update, delete on table public.cms_documents to authenticated;
grant select, insert on table public.cms_revisions to authenticated;
grant select, insert, update, delete on table public.cms_announcements to authenticated;
grant select, insert, update, delete on table public.cms_media to authenticated;

grant execute on function public.get_cms_public_documents(text[]) to anon, authenticated;
grant execute on function public.get_cms_public_announcements() to anon, authenticated;
grant execute on function public.can_view_cms_admin() to authenticated;
grant execute on function public.can_mutate_cms() to authenticated;

-- Public website media bucket (images only, 10 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'website-media',
  'website-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
where not exists (select 1 from storage.buckets where id = 'website-media');

drop policy if exists website_media_public_read on storage.objects;
create policy website_media_public_read on storage.objects
  for select to public
  using (bucket_id = 'website-media');

drop policy if exists website_media_admin_write on storage.objects;
create policy website_media_admin_write on storage.objects
  for all to authenticated
  using (bucket_id = 'website-media' and public.can_mutate_cms())
  with check (bucket_id = 'website-media' and public.can_mutate_cms());

-- Seed document shells (payloads filled by app defaults until admin publishes)
insert into public.cms_documents (document_key, title, draft, published, draft_version, published_version)
values
  ('site.header', 'Website Header', '{}'::jsonb, null, 1, 0),
  ('site.nav', 'Primary Navigation', '{}'::jsonb, null, 1, 0),
  ('site.footer', 'Website Footer', '{}'::jsonb, null, 1, 0),
  ('site.theme', 'Visual Theme Tokens', '{}'::jsonb, null, 1, 0),
  ('page.home', 'Homepage', '{}'::jsonb, null, 1, 0),
  ('page.about', 'About Us', '{}'::jsonb, null, 1, 0),
  ('page.services', 'Services', '{}'::jsonb, null, 1, 0),
  ('page.contact', 'Contact Us', '{}'::jsonb, null, 1, 0),
  ('page.destinations', 'Study Destinations', '{}'::jsonb, null, 1, 0),
  ('seo.global', 'Global SEO Defaults', '{}'::jsonb, null, 1, 0)
on conflict (document_key) do nothing;

comment on table public.cms_documents is
  'Website CMS documents with isolated draft and published JSON payloads.';
comment on table public.cms_announcements is
  'Public announcement bar items; only published + in-window rows appear on cms_public_announcements.';
comment on table public.cms_media is
  'Metadata for website-media storage objects used by the public site CMS.';
