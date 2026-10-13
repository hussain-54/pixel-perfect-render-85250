-- =============================================================================
-- Designate primary admin: hussaindurrani92@gmail.com
-- OWNER RUN ONLY on project gjasuvlqfofpvrqvvnyz (confirm Dashboard URL first).
--
-- DOES NOT: create Auth user, change password, assign super_admin, disable RLS.
-- DOES: set profiles.role = admin, profiles.business_role = admin, and sync
--       auth.users.raw_app_meta_data.role = admin when Auth user + profile exist.
--
-- After section 1: sign OUT and sign IN again (or hard-refresh) so the portal
-- cookie / JWT path re-reads the updated role. Do not claim success until
-- section 2 (and the app redirect to /admin) are verified live.
--
-- Prerequisites:
--   1) User must already exist under Authentication → Users.
--      If missing: Add user / Invite that email in the Dashboard (set password
--      there or via invite link — never via SQL).
--   2) Profile row should exist via handle_new_user. If missing after Auth
--      create, wait a moment and re-check section 0.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) PREFLIGHT (read-only) — run alone first
-- -----------------------------------------------------------------------------
select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  p.id is not null as has_profile,
  p.role as current_app_role,
  p.business_role as current_business_role,
  u.raw_app_meta_data ->> 'role' as app_metadata_role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('hussaindurrani92@gmail.com');

-- If zero rows: create/invite hussaindurrani92@gmail.com in Authentication → Users, then re-run.
-- If has_profile = false: wait for handle_new_user, or investigate the Auth trigger.


-- -----------------------------------------------------------------------------
-- 1) ASSIGN ADMIN ROLE (run only after section 0 shows Auth user + profile)
-- -----------------------------------------------------------------------------
begin;

do $$
declare
  v_email text := lower(trim('hussaindurrani92@gmail.com'));
  v_uid uuid;
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Missing public.profiles';
  end if;
  if to_regtype('public.business_role') is null then
    raise exception 'Missing public.business_role — apply M1 first';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then
    raise exception
      'Auth user not found for %. Create/invite under Authentication → Users first, then re-run.',
      v_email;
  end if;

  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception
      'Profile missing for %. Sign in once or ensure handle_new_user trigger is installed, then re-run.',
      v_email;
  end if;

  -- SQL Editor has no admin JWT; briefly disable role-change guard only.
  alter table public.profiles disable trigger profiles_role_guard;

  begin
    update public.profiles
    set
      role = 'admin'::public.app_role,
      business_role = 'admin'::public.business_role,
      updated_at = now()
    where id = v_uid;

    -- Keep Auth app_metadata in sync (never user_metadata). Portal prefers profiles
    -- but invite flows and some clients also read app_metadata.role.
    update auth.users
    set
      raw_app_meta_data =
        coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin'),
      updated_at = now()
    where id = v_uid;
  exception
    when others then
      alter table public.profiles enable trigger profiles_role_guard;
      raise;
  end;

  alter table public.profiles enable trigger profiles_role_guard;

  raise notice 'Primary admin designated for % (%)', v_email, v_uid;
end;
$$;

commit;


-- -----------------------------------------------------------------------------
-- 2) VERIFY (read-only) — expect role=admin, business_role=admin, app_metadata admin
-- -----------------------------------------------------------------------------
select
  u.id as auth_user_id,
  u.email,
  p.role as app_role,
  p.business_role,
  u.raw_app_meta_data ->> 'role' as app_metadata_role,
  u.email_confirmed_at is not null as email_confirmed
from auth.users u
join public.profiles p on p.id = u.id
where lower(u.email) = lower('hussaindurrani92@gmail.com');
