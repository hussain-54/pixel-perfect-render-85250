-- Align students SELECT with can_access_student (Admission Team handover visibility).
-- Extend can_staff_mutate_student for accepted admission ownership (least privilege).
-- Publish CRM realtime tables used by counsellor / admission / student workbenches.
-- Does NOT extend can_access_student with registered_by (Front Desk stays on DEFINER RPCs).
-- Does NOT grant mutate on submitted-only handovers.
-- Does NOT change fee verification or portal activation rules.

-- 1) Students SELECT must match can_access_student so Admission Team can load
-- handed-over students via listVisibleStudentsDb / assertStudentVisibleDb.
drop policy if exists students_select_access on public.students;
create policy students_select_access on public.students
  for select
  to authenticated
  using (public.can_access_student(id));

comment on policy students_select_access on public.students is
  'SELECT via can_access_student: self, assigned consultant, admin, or Admission Team/Manager on submitted|accepted handovers. Fee verifiers use students_select_fee_verifier separately.';

-- 2) Mutate helper: admin, assigned consultant, or Admission Team/Manager who accepted
-- the handover (to_owner_id = auth.uid()). Submitted-only does not grant mutate.
create or replace function public.can_staff_mutate_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.is_assigned_consultant(p_student_id)
    or (
      coalesce(
        public.current_business_role() in ('admission_team', 'manager'),
        false
      )
      and exists (
        select 1
        from public.admission_handovers h
        where h.student_id = p_student_id
          and h.status = 'accepted'
          and h.to_owner_id = auth.uid()
      )
    );
$$;

comment on function public.can_staff_mutate_student(uuid) is
  'Staff mutate: admin, assigned consultant, or Admission Team/Manager who accepted ownership (to_owner_id).';

-- 3) Students UPDATE staff policy previously used only is_assigned_consultant /
-- is_admin, so journey_stage updates after accept could fail silently under RLS.
drop policy if exists students_update_staff on public.students;
create policy students_update_staff on public.students
  for update
  to authenticated
  using (public.can_staff_mutate_student(id))
  with check (public.can_staff_mutate_student(id));

comment on policy students_update_staff on public.students is
  'Staff UPDATE via can_staff_mutate_student (includes accepted Admission ownership). Self-contact remains students_update_self_contact.';

-- 4) Realtime publications for workbench subscriptions (additive; ignore if already present).
do $$
begin
  begin
    alter publication supabase_realtime add table public.students;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'supabase_realtime publication missing — skip students';
  end;
  begin
    alter publication supabase_realtime add table public.admission_handovers;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'supabase_realtime publication missing — skip admission_handovers';
  end;
  begin
    alter publication supabase_realtime add table public.applications;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'supabase_realtime publication missing — skip applications';
  end;
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'supabase_realtime publication missing — skip notifications';
  end;
  begin
    alter publication supabase_realtime add table public.tasks;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'supabase_realtime publication missing — skip tasks';
  end;
  begin
    alter publication supabase_realtime add table public.student_documents;
  exception
    when duplicate_object then null;
    when undefined_object then
      raise notice 'supabase_realtime publication missing — skip student_documents';
  end;
end $$;
