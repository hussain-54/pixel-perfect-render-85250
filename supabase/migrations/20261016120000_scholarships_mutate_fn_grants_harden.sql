-- =============================================================================
-- Harden EXECUTE grants on public.can_mutate_scholarships_catalog()
-- Forward-only. DO NOT apply without owner confirmation.
--
-- Depends on: 20261016110000_scholarships_mutate_rls_tighten.sql
-- Does NOT change function body, scholarships INSERT/UPDATE RLS policies,
-- or SELECT policies. Admission Team / Manager / Admin mutate path unchanged.
--
-- Why: CREATE FUNCTION defaults often leave EXECUTE to PUBLIC, which PostgREST
-- anon can inherit. Mutate helper must not be callable by anon.
-- =============================================================================

revoke all on function public.can_mutate_scholarships_catalog() from public;
revoke all on function public.can_mutate_scholarships_catalog() from anon;

-- RLS policies scholarships_insert / scholarships_update are TO authenticated
-- and call this helper — authenticated must retain EXECUTE.
grant execute on function public.can_mutate_scholarships_catalog() to authenticated;

comment on function public.can_mutate_scholarships_catalog() is
  'Admissions catalog mutate helper (SECURITY DEFINER). EXECUTE: authenticated only — not PUBLIC/anon. Logic: is_admin OR business_role in (admission_team, manager, admin). Server matrix still required.';
