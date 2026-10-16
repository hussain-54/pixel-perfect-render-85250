-- =============================================================================
-- Allow authenticated DELETE on universities / programs (staff only via RLS).
-- Foundation granted SELECT/INSERT/UPDATE but not DELETE; write policies are FOR ALL.
-- Does not weaken RLS (is_admin / is_consultant still required).
-- DO NOT apply without owner confirmation.
-- =============================================================================

grant delete on table public.universities to authenticated;
grant delete on table public.programs to authenticated;
