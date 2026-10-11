-- =============================================================================
-- Global Roots — Admission Officer Portal database foundation
-- Remote probe (anon key): no public.* tables existed (PGRST205 on all probes).
-- First version-controlled schema. DO NOT apply without explicit approval.
-- =============================================================================

create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('student', 'consultant', 'admin', 'super_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.consultant_status as enum ('active', 'inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.journey_stage as enum (
  'profile_submitted','consultation_completed','documents_submitted','documents_under_review',
  'university_shortlisting','application_submitted','offer_received','visa_preparation',
  'visa_submitted','visa_approved','travel_preparation','completed'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.application_stage as enum (
  'docs_pending','under_review','ready_to_submit','submitted','offer_received','rejected','withdrawn','draft'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.document_status as enum (
  'pending_review','approved','rejected','needs_correction'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.document_review_action as enum (
  'approved','rejected','needs_correction','reupload_requested'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.offer_type as enum ('conditional','unconditional'); exception when duplicate_object then null; end $$;
do $$ begin create type public.offer_status as enum (
  'awaiting_student','conditions_pending','accepted','declined','expired'
); exception when duplicate_object then null; end $$;
do $$ begin create type public.deposit_status as enum ('due','paid','waived','overdue'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cas_i20_type as enum ('CAS','I-20'); exception when duplicate_object then null; end $$;
do $$ begin create type public.cas_i20_status as enum ('pending','requested','issued','expired'); exception when duplicate_object then null; end $$;
do $$ begin create type public.visa_stage as enum ('doc_prep','filed','biometrics','decision'); exception when duplicate_object then null; end $$;
do $$ begin create type public.visa_decision as enum ('pending','approved','refused'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_status as enum ('open','in_progress','completed','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.task_priority as enum ('low','normal','high','overdue'); exception when duplicate_object then null; end $$;
do $$ begin create type public.appointment_status as enum (
  'requested','confirmed','rescheduled','completed','cancelled','no_show'
); exception when duplicate_object then null; end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'student')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.enforce_profile_role_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller_role public.app_role;
begin
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    select role into caller_role from public.profiles where id = auth.uid();
    if caller_role is null or caller_role not in ('admin', 'super_admin') then
      raise exception 'Role changes require admin privileges';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard before update on public.profiles
for each row execute function public.enforce_profile_role_guard();

create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('admin', 'super_admin'), false);
$$;
create or replace function public.is_consultant()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'consultant', false);
$$;
create or replace function public.is_student()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'student', false);
$$;

create or replace function public.admin_set_user_role(target_user_id uuid, new_role public.app_role)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare updated public.profiles;
begin
  if not public.is_admin() then raise exception 'Only admins can assign roles'; end if;
  update public.profiles set role = new_role, updated_at = now()
  where id = target_user_id returning * into updated;
  if updated.id is null then raise exception 'Profile not found'; end if;
  return updated;
end; $$;
revoke all on function public.admin_set_user_role(uuid, public.app_role) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;

create table if not exists public.consultants (
  id uuid primary key references public.profiles (id) on delete cascade,
  department text, desk text, job_title text,
  status public.consultant_status not null default 'active',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists consultants_set_updated_at on public.consultants;
create trigger consultants_set_updated_at before update on public.consultants
for each row execute function public.set_updated_at();

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  case_id text not null unique,
  full_name text not null,
  email text not null,
  phone text, whatsapp text, city text, dob date,
  destination text, program text, study_level text,
  journey_stage public.journey_stage not null default 'profile_submitted',
  assigned_consultant_id uuid references public.consultants (id) on delete set null,
  last_activity_at timestamptz, archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_assigned_consultant_idx on public.students (assigned_consultant_id);
create index if not exists students_journey_stage_idx on public.students (journey_stage);
create index if not exists students_email_idx on public.students (email);
drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at before update on public.students
for each row execute function public.set_updated_at();

create or replace function public.is_assigned_consultant(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.students s
    where s.id = p_student_id and s.assigned_consultant_id = auth.uid()
  );
$$;
create or replace function public.can_access_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or public.is_assigned_consultant(p_student_id)
    or exists (select 1 from public.students s where s.id = p_student_id and s.profile_id = auth.uid());
$$;

create table if not exists public.student_academic_profiles (
  student_id uuid primary key references public.students (id) on delete cascade,
  highest_qualification text, institution text, graduation_year int,
  gpa_or_percentage text, english_test text, english_score text,
  work_experience_years numeric(4,1), preferred_intake text,
  budget_range text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists student_academic_profiles_set_updated_at on public.student_academic_profiles;
create trigger student_academic_profiles_set_updated_at before update on public.student_academic_profiles
for each row execute function public.set_updated_at();

create table if not exists public.student_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  assessed_by uuid references public.profiles (id) on delete set null,
  summary text not null default '',
  readiness_score int check (readiness_score is null or readiness_score between 0 and 100),
  strengths text, gaps text, recommended_next_steps text,
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_assessments_student_idx on public.student_assessments (student_id);

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null, country text not null, city text,
  website text, logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, country)
);

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  name text not null, level text, duration text, tuition_fee text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, name)
);

create table if not exists public.shortlist_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  university_id uuid references public.universities (id) on delete set null,
  program_id uuid references public.programs (id) on delete set null,
  university_name text not null, program_name text not null,
  country text, tuition_fee text, ranking_note text, reason text,
  sort_order int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shortlist_items_student_idx on public.shortlist_items (student_id);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  university_id uuid references public.universities (id) on delete set null,
  program_id uuid references public.programs (id) on delete set null,
  university_name text not null, program_name text not null, country text,
  intake text not null default '',
  deadline date,
  stage public.application_stage not null default 'docs_pending',
  portal_ref text, submitted_at timestamptz, decision_at timestamptz,
  owned_by_consultant_id uuid references public.consultants (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_student_idx on public.applications (student_id);
create index if not exists applications_stage_idx on public.applications (stage);
create index if not exists applications_owned_by_idx on public.applications (owned_by_consultant_id);
create unique index if not exists applications_business_key_uidx
  on public.applications (
    student_id,
    lower(btrim(university_name)),
    lower(btrim(program_name)),
    lower(btrim(intake))
  );

create table if not exists public.application_stage_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  from_stage public.application_stage, to_stage public.application_stage not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text, changed_at timestamptz not null default now()
);
create index if not exists application_stage_history_app_idx on public.application_stage_history (application_id);

create or replace function public.log_application_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_stage_history (application_id, from_stage, to_stage, changed_by)
    values (new.id, null, new.stage, auth.uid());
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    insert into public.application_stage_history (application_id, from_stage, to_stage, changed_by)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end; $$;
drop trigger if exists applications_stage_history on public.applications;
create trigger applications_stage_history after insert or update of stage on public.applications
for each row execute function public.log_application_stage_change();

-- Validate adjacent submission-pipeline transitions (offer/deposit/visa stay separate tables).
create or replace function public.validate_application_stage_transition()
returns trigger language plpgsql as $$
declare
  allowed public.application_stage[];
begin
  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.stage not in ('docs_pending', 'draft') then
      raise exception 'New applications must start at docs_pending (or draft)';
    end if;
    return new;
  end if;
  -- Terminal / non-pipeline stages: allow only explicit reject/withdraw from pipeline
  if new.stage in ('rejected', 'withdrawn') then
    if old.stage in ('docs_pending','under_review','ready_to_submit','submitted','offer_received','draft') then
      return new;
    end if;
  end if;
  case old.stage
    when 'docs_pending' then allowed := array['under_review']::public.application_stage[];
    when 'under_review' then allowed := array['docs_pending','ready_to_submit']::public.application_stage[];
    when 'ready_to_submit' then allowed := array['under_review','submitted']::public.application_stage[];
    when 'submitted' then allowed := array['ready_to_submit','offer_received']::public.application_stage[];
    when 'offer_received' then allowed := array['submitted']::public.application_stage[];
    when 'draft' then allowed := array['docs_pending']::public.application_stage[];
    else allowed := array[]::public.application_stage[];
  end case;
  if not (new.stage = any(allowed) or new.stage in ('rejected','withdrawn')) then
    raise exception 'Transition from % to % is not allowed', old.stage, new.stage;
  end if;
  return new;
end; $$;
drop trigger if exists applications_stage_transition on public.applications;
create trigger applications_stage_transition before insert or update of stage on public.applications
for each row execute function public.validate_application_stage_transition();

create table if not exists public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  doc_type text not null, label text not null,
  status public.document_status not null default 'pending_review',
  current_version int not null default 0 check (current_version >= 0),
  required boolean not null default true,
  expires_on date,
  linked_application_id uuid references public.applications (id) on delete set null,
  awaiting_upload boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, doc_type)
);
create index if not exists student_documents_student_idx on public.student_documents (student_id);
create index if not exists student_documents_status_idx on public.student_documents (status);
create index if not exists student_documents_expires_idx on public.student_documents (expires_on);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.student_documents (id) on delete cascade,
  version_number int not null check (version_number >= 1),
  storage_bucket text not null default 'student-documents',
  storage_path text not null,
  file_name text not null, mime_type text, file_size_bytes bigint,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (document_id, version_number)
);
create index if not exists document_versions_document_idx on public.document_versions (document_id);

create table if not exists public.document_reviews (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.student_documents (id) on delete cascade,
  version_id uuid references public.document_versions (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  action public.document_review_action not null,
  comments text, reviewed_at timestamptz not null default now(),
  constraint document_reviews_reason_chk check (
    action = 'approved'
    or (comments is not null and length(btrim(comments)) > 0)
  )
);
create index if not exists document_reviews_document_idx on public.document_reviews (document_id);

create or replace function public.apply_document_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.student_documents set
    status = case new.action
      when 'approved' then 'approved'::public.document_status
      when 'rejected' then 'rejected'::public.document_status
      when 'needs_correction' then 'needs_correction'::public.document_status
      when 'reupload_requested' then 'needs_correction'::public.document_status
    end,
    updated_at = now()
  where id = new.document_id;
  return new;
end; $$;
drop trigger if exists document_reviews_apply on public.document_reviews;
create trigger document_reviews_apply after insert on public.document_reviews
for each row execute function public.apply_document_review();

create table if not exists public.document_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  doc_type text not null,
  sort_order int not null default 0,
  unique (country, doc_type)
);
insert into public.document_checklist_templates (country, doc_type, sort_order) values
  ('UK', 'Passport', 1),
  ('UK', 'Academic Transcripts', 2),
  ('UK', 'Academic Certificates', 3),
  ('UK', 'IELTS / English Test', 4),
  ('UK', 'SOP', 5),
  ('UK', 'CV', 6),
  ('UK', 'Recommendation Letter', 7),
  ('UK', 'Financial Documents', 8),
  ('Germany', 'Passport', 1),
  ('Germany', 'Academic Transcripts', 2),
  ('Germany', 'Academic Certificates', 3),
  ('Germany', 'IELTS / English Test', 4),
  ('Germany', 'SOP', 5),
  ('Germany', 'CV', 6),
  ('Italy', 'Passport', 1),
  ('Italy', 'Academic Transcripts', 2),
  ('Italy', 'Portfolio', 3),
  ('Italy', 'IELTS / English Test', 4),
  ('Italy', 'SOP', 5),
  ('Italy', 'Photographs', 6),
  ('Canada', 'Passport', 1),
  ('Canada', 'Academic Transcripts', 2),
  ('Canada', 'IELTS / English Test', 3),
  ('Canada', 'SOP', 4),
  ('Canada', 'Financial Documents', 5),
  ('USA', 'Passport', 1),
  ('USA', 'Academic Transcripts', 2),
  ('USA', 'IELTS / English Test', 3),
  ('USA', 'SOP', 4),
  ('USA', 'Financial Documents', 5),
  ('Australia', 'Passport', 1),
  ('Australia', 'Academic Transcripts', 2),
  ('Australia', 'IELTS / English Test', 3),
  ('Australia', 'SOP', 4),
  ('Australia', 'CV', 5),
  ('*', 'Passport', 1),
  ('*', 'Academic Transcripts', 2),
  ('*', 'IELTS / English Test', 3),
  ('*', 'SOP', 4)
on conflict (country, doc_type) do nothing;

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  offer_type public.offer_type not null default 'conditional',
  status public.offer_status not null default 'awaiting_student',
  offer_date date, response_deadline date, tuition_fee text, scholarship_note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists offers_student_idx on public.offers (student_id);
create index if not exists offers_application_idx on public.offers (application_id);

create table if not exists public.offer_conditions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  description text not null, met boolean not null default false,
  met_at timestamptz, evidence_document_id uuid references public.student_documents (id) on delete set null,
  sort_order int not null default 0, created_at timestamptz not null default now()
);
create index if not exists offer_conditions_offer_idx on public.offer_conditions (offer_id);

create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  amount numeric(12,2), currency text default 'GBP',
  status public.deposit_status not null default 'due',
  due_date date, paid_at timestamptz, reference text, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deposits_student_idx on public.deposits (student_id);
create index if not exists deposits_offer_idx on public.deposits (offer_id);

create table if not exists public.cas_i20_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  offer_id uuid references public.offers (id) on delete set null,
  record_type public.cas_i20_type not null,
  status public.cas_i20_status not null default 'pending',
  reference_number text, issued_at date, expires_at date, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cas_i20_student_idx on public.cas_i20_records (student_id);

create table if not exists public.visa_milestones (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  application_id uuid references public.applications (id) on delete set null,
  cas_i20_id uuid references public.cas_i20_records (id) on delete set null,
  stage public.visa_stage not null default 'doc_prep',
  decision public.visa_decision not null default 'pending',
  filed_at date, biometrics_at date, decision_at date, notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visa_milestones_student_idx on public.visa_milestones (student_id);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students (id) on delete cascade,
  title text not null, description text,
  status public.task_status not null default 'open',
  priority public.task_priority not null default 'normal',
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  due_at timestamptz, completed_at timestamptz,
  reminder_at timestamptz, reminder_ref text,
  related_application_id uuid references public.applications (id) on delete set null,
  related_document_id uuid references public.student_documents (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists tasks_student_idx on public.tasks (student_id);
create index if not exists tasks_due_at_idx on public.tasks (due_at);
create index if not exists tasks_status_idx on public.tasks (status);

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null, pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists internal_notes_student_idx on public.internal_notes (student_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null, body text, link_path text,
  student_id uuid references public.students (id) on delete set null,
  read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  consultant_id uuid references public.consultants (id) on delete set null,
  status public.appointment_status not null default 'requested',
  scheduled_at timestamptz, duration_minutes int default 30,
  meeting_link text, location text, notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_student_idx on public.appointments (student_id);
create index if not exists appointments_consultant_idx on public.appointments (consultant_id);
create index if not exists appointments_scheduled_at_idx on public.appointments (scheduled_at);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid,
  student_id uuid references public.students (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_student_idx on public.audit_events (student_id);
create index if not exists audit_events_entity_idx on public.audit_events (entity_type, entity_id);

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql as $$
begin raise exception 'audit_events is append-only'; end; $$;
drop trigger if exists audit_events_no_update on public.audit_events;
create trigger audit_events_no_update before update or delete on public.audit_events
for each row execute function public.reject_audit_mutation();

create or replace function public.write_audit_event(
  p_action text, p_entity_type text, p_entity_id uuid default null,
  p_student_id uuid default null, p_metadata jsonb default '{}'::jsonb
) returns public.audit_events language plpgsql security definer set search_path = public as $$
declare row public.audit_events;
begin
  insert into public.audit_events (actor_id, action, entity_type, entity_id, student_id, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_student_id, coalesce(p_metadata, '{}'::jsonb))
  returning * into row;
  return row;
end; $$;
revoke all on function public.write_audit_event(text, text, uuid, uuid, jsonb) from public;
grant execute on function public.write_audit_event(text, text, uuid, uuid, jsonb) to authenticated;

create or replace function public.audit_document_review()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select student_id into sid from public.student_documents where id = new.document_id;
  perform public.write_audit_event(
    'document_' || new.action::text,
    'student_document',
    new.document_id,
    sid,
    jsonb_build_object('comments', new.comments)
  );
  return new;
end; $$;
drop trigger if exists document_reviews_audit on public.document_reviews;
create trigger document_reviews_audit after insert on public.document_reviews
for each row execute function public.audit_document_review();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.consultants enable row level security;
alter table public.students enable row level security;
alter table public.student_academic_profiles enable row level security;
alter table public.student_assessments enable row level security;
alter table public.universities enable row level security;
alter table public.programs enable row level security;
alter table public.shortlist_items enable row level security;
alter table public.applications enable row level security;
alter table public.application_stage_history enable row level security;
alter table public.student_documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_reviews enable row level security;
alter table public.document_checklist_templates enable row level security;
alter table public.offers enable row level security;
alter table public.offer_conditions enable row level security;
alter table public.deposits enable row level security;
alter table public.cas_i20_records enable row level security;
alter table public.visa_milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.internal_notes enable row level security;
alter table public.notifications enable row level security;
alter table public.appointments enable row level security;
alter table public.audit_events enable row level security;

-- profiles
drop policy if exists profiles_select_self_or_staff on public.profiles;
create policy profiles_select_self_or_staff on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin() or public.is_consultant());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- consultants
drop policy if exists consultants_select_authenticated on public.consultants;
create policy consultants_select_authenticated on public.consultants for select to authenticated using (true);
drop policy if exists consultants_admin_write on public.consultants;
create policy consultants_admin_write on public.consultants for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- students
drop policy if exists students_select_access on public.students;
create policy students_select_access on public.students for select to authenticated
using (profile_id = auth.uid() or assigned_consultant_id = auth.uid() or public.is_admin());
drop policy if exists students_update_access on public.students;
create policy students_update_access on public.students for update to authenticated
using (assigned_consultant_id = auth.uid() or public.is_admin() or profile_id = auth.uid())
with check (assigned_consultant_id = auth.uid() or public.is_admin() or profile_id = auth.uid());
drop policy if exists students_insert_staff on public.students;
create policy students_insert_staff on public.students for insert to authenticated
with check (public.is_admin() or public.is_consultant());

-- helper: student-scoped policies via can_access_student
drop policy if exists academic_profiles_access on public.student_academic_profiles;
create policy academic_profiles_access on public.student_academic_profiles for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists assessments_select on public.student_assessments;
create policy assessments_select on public.student_assessments for select to authenticated
using (public.can_access_student(student_id));
drop policy if exists assessments_write_staff on public.student_assessments;
create policy assessments_write_staff on public.student_assessments for insert to authenticated
with check ((public.is_admin() or public.is_assigned_consultant(student_id)));
drop policy if exists assessments_update_staff on public.student_assessments;
create policy assessments_update_staff on public.student_assessments for update to authenticated
using (public.is_admin() or public.is_assigned_consultant(student_id))
with check (public.is_admin() or public.is_assigned_consultant(student_id));

drop policy if exists universities_select on public.universities;
create policy universities_select on public.universities for select to authenticated using (true);
drop policy if exists universities_write_staff on public.universities;
create policy universities_write_staff on public.universities for all to authenticated
using (public.is_admin() or public.is_consultant()) with check (public.is_admin() or public.is_consultant());

drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs for select to authenticated using (true);
drop policy if exists programs_write_staff on public.programs;
create policy programs_write_staff on public.programs for all to authenticated
using (public.is_admin() or public.is_consultant()) with check (public.is_admin() or public.is_consultant());

drop policy if exists shortlist_access on public.shortlist_items;
create policy shortlist_access on public.shortlist_items for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists applications_access on public.applications;
create policy applications_access on public.applications for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists application_history_select on public.application_stage_history;
create policy application_history_select on public.application_stage_history for select to authenticated
using (exists (
  select 1 from public.applications a where a.id = application_id and public.can_access_student(a.student_id)
));

drop policy if exists documents_access on public.student_documents;
create policy documents_access on public.student_documents for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists document_versions_access on public.document_versions;
create policy document_versions_access on public.document_versions for all to authenticated
using (exists (
  select 1 from public.student_documents d where d.id = document_id and public.can_access_student(d.student_id)
)) with check (exists (
  select 1 from public.student_documents d where d.id = document_id and public.can_access_student(d.student_id)
));

drop policy if exists document_reviews_select on public.document_reviews;
create policy document_reviews_select on public.document_reviews for select to authenticated
using (exists (
  select 1 from public.student_documents d where d.id = document_id and public.can_access_student(d.student_id)
));
drop policy if exists document_reviews_insert_staff on public.document_reviews;
create policy document_reviews_insert_staff on public.document_reviews for insert to authenticated
with check (
  (public.is_admin() or public.is_consultant())
  and exists (
    select 1 from public.student_documents d where d.id = document_id and public.can_access_student(d.student_id)
  )
);

drop policy if exists checklist_select_staff on public.document_checklist_templates;
create policy checklist_select_staff on public.document_checklist_templates for select to authenticated
using (public.is_admin() or public.is_consultant());

drop policy if exists offers_access on public.offers;
create policy offers_access on public.offers for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists offer_conditions_access on public.offer_conditions;
create policy offer_conditions_access on public.offer_conditions for all to authenticated
using (exists (
  select 1 from public.offers o where o.id = offer_id and public.can_access_student(o.student_id)
)) with check (exists (
  select 1 from public.offers o where o.id = offer_id and public.can_access_student(o.student_id)
));

drop policy if exists deposits_access on public.deposits;
create policy deposits_access on public.deposits for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists cas_i20_access on public.cas_i20_records;
create policy cas_i20_access on public.cas_i20_records for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists visa_access on public.visa_milestones;
create policy visa_access on public.visa_milestones for all to authenticated
using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
using (
  assignee_id = auth.uid() or created_by = auth.uid() or public.is_admin()
  or (student_id is not null and public.can_access_student(student_id))
);
drop policy if exists tasks_write_staff on public.tasks;
create policy tasks_write_staff on public.tasks for all to authenticated
using (public.is_admin() or public.is_consultant() or assignee_id = auth.uid() or created_by = auth.uid())
with check (public.is_admin() or public.is_consultant() or assignee_id = auth.uid() or created_by = auth.uid());

-- Internal notes: staff only (students never see)
drop policy if exists internal_notes_staff on public.internal_notes;
create policy internal_notes_staff on public.internal_notes for all to authenticated
using (
  (public.is_admin() or public.is_assigned_consultant(student_id))
) with check (
  (public.is_admin() or public.is_assigned_consultant(student_id))
);

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_insert_staff on public.notifications;
create policy notifications_insert_staff on public.notifications for insert to authenticated
with check (public.is_admin() or public.is_consultant() or user_id = auth.uid());

drop policy if exists appointments_access on public.appointments;
create policy appointments_access on public.appointments for all to authenticated
using (public.can_access_student(student_id) or consultant_id = auth.uid())
with check (public.can_access_student(student_id) or consultant_id = auth.uid());

drop policy if exists audit_select_staff on public.audit_events;
create policy audit_select_staff on public.audit_events for select to authenticated
using (public.is_admin() or public.is_consultant());
drop policy if exists audit_insert_authenticated on public.audit_events;
create policy audit_insert_authenticated on public.audit_events for insert to authenticated
with check (actor_id = auth.uid() or actor_id is null);

-- ---------------------------------------------------------------------------
-- Private Storage: student-documents
-- Path convention: {student_id}/{document_id}/v{version}_{filename}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-documents', 'student-documents', false, 52428800,
  array['application/pdf','image/jpeg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_student_id_from_path(object_name text)
returns uuid language plpgsql immutable as $$
declare first_segment text;
begin
  first_segment := split_part(object_name, '/', 1);
  if first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;
  return null;
end; $$;

drop policy if exists student_documents_storage_select on storage.objects;
create policy student_documents_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'student-documents'
  and public.can_access_student(public.storage_student_id_from_path(name))
);

drop policy if exists student_documents_storage_insert on storage.objects;
create policy student_documents_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and public.can_access_student(public.storage_student_id_from_path(name))
);

drop policy if exists student_documents_storage_update on storage.objects;
create policy student_documents_storage_update on storage.objects for update to authenticated
using (
  bucket_id = 'student-documents'
  and public.can_access_student(public.storage_student_id_from_path(name))
)
with check (
  bucket_id = 'student-documents'
  and public.can_access_student(public.storage_student_id_from_path(name))
);

drop policy if exists student_documents_storage_delete on storage.objects;
create policy student_documents_storage_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'student-documents'
  and (public.is_admin() or public.is_assigned_consultant(public.storage_student_id_from_path(name)))
);

-- Grants
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant select, insert on public.audit_events to authenticated;
revoke update, delete on public.audit_events from authenticated;
grant usage, select on all sequences in schema public to authenticated;
