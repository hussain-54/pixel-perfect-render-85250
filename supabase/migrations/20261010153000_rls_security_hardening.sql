-- =============================================================================
-- Phase A2 — RLS / privilege hardening (forward-only corrective migration)
-- Depends on:
--   20261010010000_admission_officer_foundation.sql
--   20261010120000_audit_trail_hardening.sql
-- DO NOT apply without explicit approval. Does not rewrite historical migrations.
-- =============================================================================

create or replace function public.enforce_student_staff_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or public.is_assigned_consultant(old.id) then
    return new;
  end if;

  if old.profile_id is not null and old.profile_id = auth.uid() then
    if new.assigned_consultant_id is distinct from old.assigned_consultant_id
      or new.journey_stage is distinct from old.journey_stage
      or new.case_id is distinct from old.case_id
      or new.profile_id is distinct from old.profile_id
      or new.archived_at is distinct from old.archived_at
      or new.email is distinct from old.email
      or new.full_name is distinct from old.full_name
    then
      raise exception 'Students cannot change staff-controlled student fields';
    end if;
    return new;
  end if;

  raise exception 'Not allowed to update this student record';
end;
$$;

drop trigger if exists students_enforce_staff_fields on public.students;
create trigger students_enforce_staff_fields
  before update on public.students
  for each row execute function public.enforce_student_staff_fields();

drop policy if exists students_update_access on public.students;
drop policy if exists students_update_staff on public.students;
drop policy if exists students_update_self_contact on public.students;
create policy students_update_staff on public.students
  for update to authenticated
  using (public.is_admin() or public.is_assigned_consultant(id))
  with check (public.is_admin() or public.is_assigned_consultant(id));

create policy students_update_self_contact on public.students
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function public.can_staff_mutate_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_assigned_consultant(p_student_id);
$$;

drop policy if exists applications_access on public.applications;
drop policy if exists applications_select_access on public.applications;
drop policy if exists applications_insert_staff on public.applications;
drop policy if exists applications_update_staff on public.applications;
drop policy if exists applications_delete_staff on public.applications;
create policy applications_select_access on public.applications
  for select to authenticated
  using (public.can_access_student(student_id));
create policy applications_insert_staff on public.applications
  for insert to authenticated
  with check (public.can_staff_mutate_student(student_id));
create policy applications_update_staff on public.applications
  for update to authenticated
  using (public.can_staff_mutate_student(student_id))
  with check (public.can_staff_mutate_student(student_id));
create policy applications_delete_staff on public.applications
  for delete to authenticated
  using (public.is_admin());

drop policy if exists offers_access on public.offers;
drop policy if exists offers_select_access on public.offers;
drop policy if exists offers_insert_staff on public.offers;
drop policy if exists offers_update_staff on public.offers;
drop policy if exists offers_delete_staff on public.offers;
create policy offers_select_access on public.offers
  for select to authenticated
  using (public.can_access_student(student_id));
create policy offers_insert_staff on public.offers
  for insert to authenticated
  with check (public.can_staff_mutate_student(student_id));
create policy offers_update_staff on public.offers
  for update to authenticated
  using (public.can_staff_mutate_student(student_id))
  with check (public.can_staff_mutate_student(student_id));
create policy offers_delete_staff on public.offers
  for delete to authenticated
  using (public.is_admin());

drop policy if exists offer_conditions_access on public.offer_conditions;
drop policy if exists offer_conditions_select_access on public.offer_conditions;
drop policy if exists offer_conditions_write_staff on public.offer_conditions;
create policy offer_conditions_select_access on public.offer_conditions
  for select to authenticated
  using (exists (
    select 1 from public.offers o
    where o.id = offer_id and public.can_access_student(o.student_id)
  ));
create policy offer_conditions_write_staff on public.offer_conditions
  for all to authenticated
  using (exists (
    select 1 from public.offers o
    where o.id = offer_id and public.can_staff_mutate_student(o.student_id)
  ))
  with check (exists (
    select 1 from public.offers o
    where o.id = offer_id and public.can_staff_mutate_student(o.student_id)
  ));

drop policy if exists deposits_access on public.deposits;
drop policy if exists deposits_select_access on public.deposits;
drop policy if exists deposits_write_staff on public.deposits;
create policy deposits_select_access on public.deposits
  for select to authenticated
  using (public.can_access_student(student_id));
create policy deposits_write_staff on public.deposits
  for all to authenticated
  using (public.can_staff_mutate_student(student_id))
  with check (public.can_staff_mutate_student(student_id));

drop policy if exists cas_i20_access on public.cas_i20_records;
drop policy if exists cas_i20_select_access on public.cas_i20_records;
drop policy if exists cas_i20_write_staff on public.cas_i20_records;
create policy cas_i20_select_access on public.cas_i20_records
  for select to authenticated
  using (public.can_access_student(student_id));
create policy cas_i20_write_staff on public.cas_i20_records
  for all to authenticated
  using (public.can_staff_mutate_student(student_id))
  with check (public.can_staff_mutate_student(student_id));

drop policy if exists visa_access on public.visa_milestones;
drop policy if exists visa_select_access on public.visa_milestones;
drop policy if exists visa_write_staff on public.visa_milestones;
create policy visa_select_access on public.visa_milestones
  for select to authenticated
  using (public.can_access_student(student_id));
create policy visa_write_staff on public.visa_milestones
  for all to authenticated
  using (public.can_staff_mutate_student(student_id))
  with check (public.can_staff_mutate_student(student_id));

drop policy if exists documents_access on public.student_documents;
drop policy if exists documents_select_access on public.student_documents;
drop policy if exists documents_insert_access on public.student_documents;
drop policy if exists documents_update_staff on public.student_documents;
drop policy if exists documents_update_student_upload on public.student_documents;
create policy documents_select_access on public.student_documents
  for select to authenticated
  using (public.can_access_student(student_id));
create policy documents_insert_access on public.student_documents
  for insert to authenticated
  with check (
    public.can_staff_mutate_student(student_id)
    or exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );
create policy documents_update_staff on public.student_documents
  for update to authenticated
  using (public.can_staff_mutate_student(student_id))
  with check (public.can_staff_mutate_student(student_id));
create policy documents_update_student_upload on public.student_documents
  for update to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = student_id and s.profile_id = auth.uid()
    )
  );

create or replace function public.enforce_document_student_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.can_staff_mutate_student(old.student_id) then
    return new;
  end if;
  if exists (
    select 1 from public.students s
    where s.id = old.student_id and s.profile_id = auth.uid()
  ) then
    if new.student_id is distinct from old.student_id
      or new.doc_type is distinct from old.doc_type
      or new.label is distinct from old.label
      or new.required is distinct from old.required
      or new.linked_application_id is distinct from old.linked_application_id
    then
      raise exception 'Students cannot change document metadata controlled by staff';
    end if;
    if new.status is distinct from old.status
      and new.status is distinct from 'pending_review'::public.document_status
    then
      raise exception 'Students cannot set document review status';
    end if;
    return new;
  end if;
  raise exception 'Not allowed to update this document';
end;
$$;

drop trigger if exists student_documents_enforce_student_update on public.student_documents;
create trigger student_documents_enforce_student_update
  before update on public.student_documents
  for each row execute function public.enforce_document_student_update();

drop policy if exists document_versions_access on public.document_versions;
drop policy if exists document_versions_select_access on public.document_versions;
drop policy if exists document_versions_insert_access on public.document_versions;
drop policy if exists document_versions_delete_staff on public.document_versions;
create policy document_versions_select_access on public.document_versions
  for select to authenticated
  using (exists (
    select 1 from public.student_documents d
    where d.id = document_id and public.can_access_student(d.student_id)
  ));
create policy document_versions_insert_access on public.document_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.student_documents d
    where d.id = document_id
      and (
        public.can_staff_mutate_student(d.student_id)
        or exists (
          select 1 from public.students s
          where s.id = d.student_id and s.profile_id = auth.uid()
        )
      )
  ));
create policy document_versions_delete_staff on public.document_versions
  for delete to authenticated
  using (exists (
    select 1 from public.student_documents d
    where d.id = document_id and public.can_staff_mutate_student(d.student_id)
  ));

drop policy if exists document_reviews_insert_staff on public.document_reviews;
drop policy if exists document_reviews_insert_assigned on public.document_reviews;
create policy document_reviews_insert_assigned on public.document_reviews
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.student_documents d
      where d.id = document_id and public.is_assigned_consultant(d.student_id)
    )
  );

drop policy if exists tasks_write_staff on public.tasks;
drop policy if exists tasks_insert_staff on public.tasks;
drop policy if exists tasks_update_staff on public.tasks;
drop policy if exists tasks_delete_staff on public.tasks;
create policy tasks_insert_staff on public.tasks
  for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_consultant()
      and (student_id is null or public.is_assigned_consultant(student_id))
    )
  );
create policy tasks_update_staff on public.tasks
  for update to authenticated
  using (
    public.is_admin()
    or assignee_id = auth.uid()
    or created_by = auth.uid()
    or (student_id is not null and public.is_assigned_consultant(student_id))
  )
  with check (
    public.is_admin()
    or assignee_id = auth.uid()
    or created_by = auth.uid()
    or (student_id is not null and public.is_assigned_consultant(student_id))
  );
create policy tasks_delete_staff on public.tasks
  for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

drop policy if exists audit_insert_authenticated on public.audit_events;
revoke insert on table public.audit_events from authenticated;
revoke insert on table public.audit_events from anon;
revoke insert on table public.audit_events from public;
grant select on table public.audit_events to authenticated;

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_events is append-only';
end;
$$;
drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update
  before update or delete on public.audit_events
  for each row execute function public.reject_audit_mutation();

create or replace function public.write_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_student_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.audit_events
language plpgsql
security definer
set search_path = public
as $$
declare row public.audit_events;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to write audit events';
  end if;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, student_id, metadata)
  values (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_student_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into row;
  return row;
end;
$$;
revoke all on function public.write_audit_event(text, text, uuid, uuid, jsonb) from public;
grant execute on function public.write_audit_event(text, text, uuid, uuid, jsonb) to authenticated;

drop policy if exists student_documents_storage_select on storage.objects;
create policy student_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-documents'
    and public.storage_student_id_from_path(name) is not null
    and public.can_access_student(public.storage_student_id_from_path(name))
  );

drop policy if exists student_documents_storage_insert on storage.objects;
create policy student_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-documents'
    and public.storage_student_id_from_path(name) is not null
    and (
      public.can_staff_mutate_student(public.storage_student_id_from_path(name))
      or exists (
        select 1 from public.students s
        where s.id = public.storage_student_id_from_path(name)
          and s.profile_id = auth.uid()
      )
    )
  );

drop policy if exists student_documents_storage_update on storage.objects;
create policy student_documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-documents'
    and public.storage_student_id_from_path(name) is not null
    and public.can_staff_mutate_student(public.storage_student_id_from_path(name))
  )
  with check (
    bucket_id = 'student-documents'
    and public.storage_student_id_from_path(name) is not null
    and public.can_staff_mutate_student(public.storage_student_id_from_path(name))
  );

drop policy if exists student_documents_storage_delete on storage.objects;
create policy student_documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-documents'
    and public.storage_student_id_from_path(name) is not null
    and (
      public.is_admin()
      or public.is_assigned_consultant(public.storage_student_id_from_path(name))
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'student-documents',
  'student-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
where not exists (select 1 from storage.buckets where id = 'student-documents');

do $$
declare
  trig_fn text;
begin
  select p.proname into trig_fn
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'on_auth_user_created'
    and not t.tgisinternal
  limit 1;

  if trig_fn is null then
    execute 'create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()';
  elsif trig_fn = 'handle_new_user' then
    null;
  else
    raise notice 'Skipping on_auth_user_created install: existing trigger uses %', trig_fn;
  end if;
end;
$$;

create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  full_name text not null,
  email text not null,
  phone text not null,
  whatsapp text,
  destination text,
  study_level text,
  program text,
  preferred_date date,
  message text,
  status text not null default 'new',
  assigned_consultant_id uuid references public.consultants (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists consultation_requests_created_idx
  on public.consultation_requests (created_at desc);

alter table public.consultation_requests enable row level security;

drop policy if exists consultation_insert_public on public.consultation_requests;
create policy consultation_insert_public on public.consultation_requests
  for insert to anon, authenticated
  with check (
    length(btrim(full_name)) > 1
    and length(btrim(email)) > 3
    and length(btrim(phone)) >= 8
    and reference_code ~ '^REQ-[A-Z0-9]+$'
  );

drop policy if exists consultation_select_staff on public.consultation_requests;
create policy consultation_select_staff on public.consultation_requests
  for select to authenticated
  using (public.is_admin() or public.is_consultant());

drop policy if exists consultation_update_staff on public.consultation_requests;
create policy consultation_update_staff on public.consultation_requests
  for update to authenticated
  using (public.is_admin() or public.is_consultant())
  with check (public.is_admin() or public.is_consultant());

grant select, insert, update on table public.consultation_requests to authenticated;
grant insert on table public.consultation_requests to anon;
