-- =============================================================================
-- Blog platform foundation — authors, categories, tags, posts + public readers
-- Forward-only. Owner apply on staging before Admin Blog / public /blog work.
-- Reuses website-media bucket + can_mutate_cms() from website CMS foundation.
-- =============================================================================

create table if not exists public.blog_authors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  bio text not null default '',
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_authors_name_len check (
    char_length(btrim(display_name)) >= 2 and char_length(display_name) <= 120
  ),
  constraint blog_authors_bio_len check (char_length(bio) <= 1000)
);

drop trigger if exists blog_authors_set_updated_at on public.blog_authors;
create trigger blog_authors_set_updated_at
  before update on public.blog_authors
  for each row execute function public.set_updated_at();

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint blog_categories_slug_unique unique (slug),
  constraint blog_categories_name_len check (
    char_length(btrim(name)) >= 2 and char_length(name) <= 80
  ),
  constraint blog_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint blog_tags_slug_unique unique (slug),
  constraint blog_tags_name_len check (
    char_length(btrim(name)) >= 2 and char_length(name) <= 60
  ),
  constraint blog_tags_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  slug text not null,
  excerpt text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  featured_image_url text,
  featured_image_alt text not null default '',
  category_id uuid references public.blog_categories (id) on delete set null,
  author_id uuid references public.blog_authors (id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  published_at timestamptz,
  scheduled_for timestamptz,
  reading_time_minutes integer not null default 1 check (reading_time_minutes >= 1 and reading_time_minutes <= 120),
  is_featured boolean not null default false,
  seo_title text not null default '',
  seo_description text not null default '',
  focus_keyword text not null default '',
  og_title text not null default '',
  og_description text not null default '',
  og_image_url text,
  canonical_path text,
  robots_index boolean not null default true,
  draft_version integer not null default 1 check (draft_version >= 1),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_slug_unique unique (slug),
  constraint blog_posts_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint blog_posts_title_len check (char_length(title) <= 200),
  constraint blog_posts_excerpt_len check (char_length(excerpt) <= 500),
  constraint blog_posts_seo_title_len check (char_length(seo_title) <= 120),
  constraint blog_posts_seo_desc_len check (char_length(seo_description) <= 320)
);

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

create index if not exists blog_posts_status_published_idx
  on public.blog_posts (status, published_at desc nulls last);

create index if not exists blog_posts_category_idx on public.blog_posts (category_id);
create index if not exists blog_posts_author_idx on public.blog_posts (author_id);
create index if not exists blog_posts_updated_idx on public.blog_posts (updated_at desc);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  tag_id uuid not null references public.blog_tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.blog_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts (id) on delete cascade,
  version integer not null check (version >= 1),
  title text not null default '',
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  kind text not null check (kind in ('draft_snapshot', 'published')),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists blog_post_revisions_post_idx
  on public.blog_post_revisions (post_id, created_at desc);

-- Promote due scheduled posts (called from app; safe to run repeatedly)
create or replace function public.promote_scheduled_blog_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.blog_posts
  set
    status = 'published',
    published_at = coalesce(published_at, now())
  where status = 'scheduled'
    and scheduled_for is not null
    and scheduled_for <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.get_published_blog_posts(
  p_limit integer default 12,
  p_offset integer default 0,
  p_category_slug text default null,
  p_search text default null
)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  featured_image_url text,
  featured_image_alt text,
  published_at timestamptz,
  reading_time_minutes integer,
  is_featured boolean,
  category_name text,
  category_slug text,
  author_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total bigint;
begin
  perform public.promote_scheduled_blog_posts();

  select count(*) into v_total
  from public.blog_posts p
  left join public.blog_categories c on c.id = p.category_id
  where p.status = 'published'
    and p.published_at is not null
    and p.published_at <= now()
    and (p_category_slug is null or c.slug = p_category_slug)
    and (
      p_search is null
      or p_search = ''
      or p.title ilike '%' || p_search || '%'
      or p.excerpt ilike '%' || p_search || '%'
    );

  return query
  select
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.featured_image_url,
    p.featured_image_alt,
    p.published_at,
    p.reading_time_minutes,
    p.is_featured,
    c.name,
    c.slug,
    a.display_name,
    v_total
  from public.blog_posts p
  left join public.blog_categories c on c.id = p.category_id
  left join public.blog_authors a on a.id = p.author_id
  where p.status = 'published'
    and p.published_at is not null
    and p.published_at <= now()
    and (p_category_slug is null or c.slug = p_category_slug)
    and (
      p_search is null
      or p_search = ''
      or p.title ilike '%' || p_search || '%'
      or p.excerpt ilike '%' || p_search || '%'
    )
  order by p.is_featured desc, p.published_at desc
  limit greatest(1, least(coalesce(p_limit, 12), 50))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create or replace function public.get_published_blog_post(p_slug text)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  content_html text,
  featured_image_url text,
  featured_image_alt text,
  published_at timestamptz,
  reading_time_minutes integer,
  is_featured boolean,
  category_name text,
  category_slug text,
  author_name text,
  author_bio text,
  author_avatar_url text,
  seo_title text,
  seo_description text,
  focus_keyword text,
  og_title text,
  og_description text,
  og_image_url text,
  canonical_path text,
  robots_index boolean,
  tag_names text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.promote_scheduled_blog_posts();

  return query
  select
    p.id,
    p.title,
    p.slug,
    p.excerpt,
    p.content_html,
    p.featured_image_url,
    p.featured_image_alt,
    p.published_at,
    p.reading_time_minutes,
    p.is_featured,
    c.name,
    c.slug,
    a.display_name,
    a.bio,
    a.avatar_url,
    p.seo_title,
    p.seo_description,
    p.focus_keyword,
    p.og_title,
    p.og_description,
    p.og_image_url,
    p.canonical_path,
    p.robots_index,
    coalesce(
      (
        select array_agg(t.name order by t.name)
        from public.blog_post_tags pt
        join public.blog_tags t on t.id = pt.tag_id
        where pt.post_id = p.id
      ),
      array[]::text[]
    )
  from public.blog_posts p
  left join public.blog_categories c on c.id = p.category_id
  left join public.blog_authors a on a.id = p.author_id
  where p.slug = p_slug
    and p.status = 'published'
    and p.published_at is not null
    and p.published_at <= now()
  limit 1;
end;
$$;

create or replace function public.get_published_blog_slugs()
returns table (slug text, published_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.slug, p.published_at
  from public.blog_posts p
  where p.status = 'published'
    and p.published_at is not null
    and p.published_at <= now()
    and p.robots_index = true
  order by p.published_at desc;
$$;

alter table public.blog_authors enable row level security;
alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_post_revisions enable row level security;

drop policy if exists blog_authors_admin_all on public.blog_authors;
create policy blog_authors_admin_all on public.blog_authors
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists blog_categories_admin_all on public.blog_categories;
create policy blog_categories_admin_all on public.blog_categories
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists blog_tags_admin_all on public.blog_tags;
create policy blog_tags_admin_all on public.blog_tags
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists blog_posts_admin_all on public.blog_posts;
create policy blog_posts_admin_all on public.blog_posts
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists blog_post_tags_admin_all on public.blog_post_tags;
create policy blog_post_tags_admin_all on public.blog_post_tags
  for all to authenticated
  using (public.can_mutate_cms())
  with check (public.can_mutate_cms());

drop policy if exists blog_post_revisions_admin_select on public.blog_post_revisions;
create policy blog_post_revisions_admin_select on public.blog_post_revisions
  for select to authenticated
  using (public.can_view_cms_admin());

drop policy if exists blog_post_revisions_admin_insert on public.blog_post_revisions;
create policy blog_post_revisions_admin_insert on public.blog_post_revisions
  for insert to authenticated
  with check (public.can_mutate_cms());

revoke all on table public.blog_authors from public, anon, authenticated;
revoke all on table public.blog_categories from public, anon, authenticated;
revoke all on table public.blog_tags from public, anon, authenticated;
revoke all on table public.blog_posts from public, anon, authenticated;
revoke all on table public.blog_post_tags from public, anon, authenticated;
revoke all on table public.blog_post_revisions from public, anon, authenticated;

grant select, insert, update, delete on table public.blog_authors to authenticated;
grant select, insert, update, delete on table public.blog_categories to authenticated;
grant select, insert, update, delete on table public.blog_tags to authenticated;
grant select, insert, update, delete on table public.blog_posts to authenticated;
grant select, insert, update, delete on table public.blog_post_tags to authenticated;
grant select, insert on table public.blog_post_revisions to authenticated;

grant execute on function public.promote_scheduled_blog_posts() to authenticated;
grant execute on function public.get_published_blog_posts(integer, integer, text, text) to anon, authenticated;
grant execute on function public.get_published_blog_post(text) to anon, authenticated;
grant execute on function public.get_published_blog_slugs() to anon, authenticated;

insert into public.blog_categories (name, slug, description, sort_order)
values
  ('Study Abroad', 'study-abroad', 'Guides and destination insights', 10),
  ('Visa Guidance', 'visa-guidance', 'Student visa process and tips', 20),
  ('Scholarships', 'scholarships', 'Funding opportunities and advice', 30),
  ('Student Life', 'student-life', 'Campus and settling-in advice', 40)
on conflict (slug) do nothing;

comment on table public.blog_posts is
  'Editorial blog posts. Public visitors read published rows only via security-definer RPCs.';
