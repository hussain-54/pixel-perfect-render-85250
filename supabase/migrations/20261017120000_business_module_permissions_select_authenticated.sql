-- =============================================================================
-- Allow authenticated staff to SELECT business_module_permissions (authorization)
-- Forward-only. DO NOT apply without owner confirmation.
--
-- Symptom: non-admin staff (Counsellor, Front Desk, etc.) see
--   "Permission matrix is temporarily unavailable"
-- because loadAuthorizationMatrix queries this table with the user JWT, while
-- RLS only allowed SELECT via is_admin(). RLS then returns 0 rows → production
-- fail-closed (source=unavailable) → requireModulePermission throws 503.
--
-- Writes (INSERT/UPDATE) remain Admin-only.
-- Does NOT grant table privileges for the anon role or PUBLIC role.
-- =============================================================================

drop policy if exists business_module_permissions_select_admin
  on public.business_module_permissions;
drop policy if exists business_module_permissions_select_authenticated
  on public.business_module_permissions;

-- Org RBAC matrix is not student/financial PII. Every authenticated server
-- authorization path must be able to read it under the caller's JWT.
create policy business_module_permissions_select_authenticated
  on public.business_module_permissions
  for select
  to authenticated
  using (auth.uid() is not null);

comment on table public.business_module_permissions is
  'Business-role × module permission levels. SELECT: authenticated (authz). INSERT/UPDATE: admin only.';
