-- Admission Team handoff visibility (minimal).
-- Why: admission_handovers.to_owner_id was recorded on accept but can_access_student
-- only covered assigned consultants, so Admission Team could not see handed-over
-- students/applications under RLS + listVisibleStudentsDb.
-- Scope: students with handover status submitted|accepted become visible to
-- business_role admission_team or manager (admin already covered by is_admin()).
-- Returned handovers do not grant Admission access (counsellor retains via assignment).
-- Does NOT change Front Desk ownership, fee verification, or counsellor assignment.

create or replace function public.can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.is_assigned_consultant(p_student_id)
    or exists (
      select 1 from public.students s
      where s.id = p_student_id and s.profile_id = auth.uid()
    )
    or (
      coalesce(
        public.current_business_role() in ('admission_team', 'manager'),
        false
      )
      and exists (
        select 1
        from public.admission_handovers h
        where h.student_id = p_student_id
          and h.status in ('submitted', 'accepted')
      )
    );
$$;

comment on function public.can_access_student(uuid) is
  'Student visibility: admin, assigned consultant, own student profile, or Admission Team/Manager via submitted/accepted admission_handovers.';

-- Explicit queue visibility for submitted handovers (Admission Team org queue).
-- Assigned consultants retain can_access_student path; Admission Team can list
-- all submitted rows even when not yet assigned as consultant.
drop policy if exists admission_handovers_select on public.admission_handovers;
create policy admission_handovers_select on public.admission_handovers
  for select to authenticated
  using (
    public.can_access_student(student_id)
    or (
      coalesce(public.current_business_role() in ('admission_team', 'manager', 'admin'), false)
      and status = 'submitted'
    )
  );

drop policy if exists admission_handovers_update on public.admission_handovers;
create policy admission_handovers_update on public.admission_handovers
  for update to authenticated
  using (
    (public.is_admin() or public.is_consultant())
    and (
      public.can_access_student(student_id)
      or (
        coalesce(public.current_business_role() in ('admission_team', 'manager'), false)
        and status = 'submitted'
      )
    )
  )
  with check (
    public.can_access_student(student_id)
    or (
      coalesce(public.current_business_role() in ('admission_team', 'manager'), false)
      and status in ('submitted', 'accepted', 'returned')
    )
  );
