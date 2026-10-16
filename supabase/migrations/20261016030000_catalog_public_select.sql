-- =============================================================================
-- Public marketing catalog SELECT for universities / programs
-- Forward-only. Does not alter table shapes or staff write policies.
-- Allows anon to read partner catalog rows (same fields staff already SELECT).
-- DO NOT apply without owner confirmation.
-- =============================================================================

-- Universities: keep authenticated policy; add anon SELECT.
drop policy if exists universities_select_anon on public.universities;
create policy universities_select_anon on public.universities
  for select
  to anon
  using (true);

grant select on table public.universities to anon;

-- Programs: keep authenticated policy; add anon SELECT.
drop policy if exists programs_select_anon on public.programs;
create policy programs_select_anon on public.programs
  for select
  to anon
  using (true);

grant select on table public.programs to anon;

comment on policy universities_select_anon on public.universities is
  'Public marketing catalog read (anon). Staff write policies unchanged.';
comment on policy programs_select_anon on public.programs is
  'Public marketing catalog read (anon). Staff write policies unchanged.';
