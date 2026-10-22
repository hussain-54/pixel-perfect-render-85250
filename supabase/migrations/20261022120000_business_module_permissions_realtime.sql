-- =============================================================================
-- Publish business_module_permissions for Supabase Realtime (staff matrix refresh)
-- Forward-only. Local file is not proof of remote apply.
--
-- Clients treat events as invalidation only — never as authorization.
-- SELECT remains authenticated (authz); INSERT/UPDATE remain admin-only.
-- =============================================================================

do $$
begin
  alter publication supabase_realtime add table public.business_module_permissions;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing — skip (hosted Realtime may differ)';
end $$;

comment on table public.business_module_permissions is
  'Business-role × module permission levels. SELECT: authenticated (authz). INSERT/UPDATE: admin only. Realtime: invalidation signal for staff effective-access refetch.';
