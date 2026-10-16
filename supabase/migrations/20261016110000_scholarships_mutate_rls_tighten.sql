-- =============================================================================
-- Scholarships mutate RLS — align with admissions Edit (not every consultant)
-- Forward-only. DO NOT apply without owner confirmation.
-- Does NOT weaken SELECT (published anon + staff SELECT remain).
-- App server already requires admissions ≥ 2 + deny Front Desk; this closes
-- direct PostgREST bypass by ordinary consultant JWTs.
-- =============================================================================

create or replace function public.can_mutate_scholarships_catalog()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or coalesce(
      public.current_business_role() in ('admission_team', 'manager', 'admin'),
      false
    );
$$;

grant execute on function public.can_mutate_scholarships_catalog() to authenticated;

drop policy if exists scholarships_insert on public.scholarships;
create policy scholarships_insert on public.scholarships
  for insert
  to authenticated
  with check (public.can_mutate_scholarships_catalog());

drop policy if exists scholarships_update on public.scholarships;
create policy scholarships_update on public.scholarships
  for update
  to authenticated
  using (public.can_mutate_scholarships_catalog())
  with check (public.can_mutate_scholarships_catalog());

comment on function public.can_mutate_scholarships_catalog() is
  'Admissions catalog mutate: technical admin or business_role admission_team/manager/admin. Server matrix still required.';
