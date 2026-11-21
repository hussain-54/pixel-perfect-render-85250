-- Forward-only hardening for blog schedule promote + public website-media MIME.
-- Phase 3: committed to the repo for owner apply later — NOT EXECUTED by agents.
-- Depends on: 20261108120000 (can_mutate_cms, website-media), 20261108140000 (promote RPC).

-- 1) Gate promote updates: CMS admins (can_mutate_cms) or service_role only.
--    Unauthorized callers get 0 (no-op) so nested public readers do not error.
create or replace function public.promote_scheduled_blog_posts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not (
    coalesce(public.can_mutate_cms(), false)
    or coalesce(auth.role(), '') = 'service_role'
  ) then
    return 0;
  end if;

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

-- 2) Narrow EXECUTE: authenticated must not call promote directly.
revoke all on function public.promote_scheduled_blog_posts() from public;
revoke all on function public.promote_scheduled_blog_posts() from anon;
revoke all on function public.promote_scheduled_blog_posts() from authenticated;
grant execute on function public.promote_scheduled_blog_posts() to service_role;

-- 3) Drop SVG from public website-media bucket allowlist (XSS surface).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
where id = 'website-media';

-- Align cms_media check constraint with the same raster-only policy (no new tables).
alter table public.cms_media drop constraint if exists cms_media_mime;
alter table public.cms_media add constraint cms_media_mime check (
  mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
);
