-- =============================================================================
-- Scholarships SELECT RLS fix (forward-only)
-- Live symptom: anon SELECT → 42501 permission denied for function is_admin
-- Cause: single policy referenced is_admin()/is_consultant() for anon+authenticated.
-- Fix: published-only policy without helpers; staff policy for authenticated only.
-- Does not recreate table/enums. Does not weaken published-only public visibility.
-- DO NOT apply without owner confirmation (live already has 20261016010000).
-- =============================================================================

drop policy if exists scholarships_select on public.scholarships;
drop policy if exists scholarships_select_published on public.scholarships;
drop policy if exists scholarships_select_staff on public.scholarships;

-- Anon + any authenticated role: published rows only (no privilege helpers).
create policy scholarships_select_published on public.scholarships
  for select
  to anon, authenticated
  using (status = 'published'::public.scholarship_status);

-- Staff technical roles: all statuses (draft / published / archived).
create policy scholarships_select_staff on public.scholarships
  for select
  to authenticated
  using (public.is_admin() or public.is_consultant());

-- Ensure authenticated can evaluate staff helper predicates (boolean, security definer).
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_consultant() to authenticated;

comment on table public.scholarships is
  'Admissions scholarship catalog. Anon/auth SELECT published via scholarships_select_published; staff see all via scholarships_select_staff; mutate via insert/update policies + app matrix.';
