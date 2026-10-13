-- =============================================================================
-- Global Roots — Phase 2C Owner SQL Verification Package
-- =============================================================================
-- Target project ref: gjasuvlqfofpvrqvvnyz
-- Mode: READ-ONLY inspection only.
--
-- Safety:
--   - SELECT / catalog inspection only
--   - No INSERT, UPDATE, DELETE, or table-clearing commands
--   - No CREATE, ALTER, DROP, or object-comment DDL
--   - No privilege-change statements
--   - No migration apply commands
--   - Do not CALL privileged RPCs to "test" them
--   - Do not return PII (names, emails, UUIDs of users/students)
--
-- How to run:
--   Run EACH SECTION independently in Supabase SQL Editor for
--   project gjasuvlqfofpvrqvvnyz. A failure in one section must not
--   stop you from running the others.
--
-- Local repo migrations are references only — not proof of remote apply.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- SECTION A — Migration history
-- Expected privilege: SQL Editor / postgres (or role that can read supabase_migrations)
-- If relation missing or denied: record exact error; do NOT infer "no migrations".
-- Run A0 first. Only run A2 if A0 reports the table as present.
-- Known outcome on some projects: 42P01 relation schema_migrations does not exist.
-- -----------------------------------------------------------------------------

-- A0) Safe existence probes (never query a missing relation)
select
  exists (
    select 1 from information_schema.schemata where schema_name = 'supabase_migrations'
  ) as has_supabase_migrations_schema,
  to_regclass('supabase_migrations.schema_migrations') is not null
    as has_schema_migrations_table,
  to_regclass('supabase_migrations.schema_migrations') is not null
    as can_query_schema_migrations;

-- A1) List any migration-like schemas/tables visible in catalogs (metadata only)
select table_schema, table_name
from information_schema.tables
where table_type = 'BASE TABLE'
  and (
    table_schema ilike '%migration%'
    or table_name ilike '%migration%'
    or table_name ilike '%schema_migrations%'
  )
order by table_schema, table_name;

-- A2) OPTIONAL — run ONLY if A0.has_schema_migrations_table = true
-- If A0 is false, skip A2 and record: migration catalog not exposed / not present.
-- select version, name, inserted_at
-- from supabase_migrations.schema_migrations
-- order by version;


-- -----------------------------------------------------------------------------
-- SECTION B — Role enum (app_role labels)
-- Verify presence/absence of: student, consultant, admin, super_admin,
-- admission_officer (and any other labels). Report actual rows only.
-- -----------------------------------------------------------------------------
select e.enumlabel as app_role_label, e.enumsortorder as sort_order
from pg_enum e
join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname = 'app_role'
order by e.enumsortorder;

-- Presence checks as booleans (no assumption that labels exist)
select
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'student'
  ) as has_student,
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'consultant'
  ) as has_consultant,
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'admin'
  ) as has_admin,
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'super_admin'
  ) as has_super_admin,
  exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'app_role' and e.enumlabel = 'admission_officer'
  ) as has_admission_officer;


-- -----------------------------------------------------------------------------
-- SECTION C — Profiles schema (role column + constraints)
-- -----------------------------------------------------------------------------
select column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;

select conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class rel on rel.oid = c.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public'
  and rel.relname = 'profiles'
order by conname;


-- -----------------------------------------------------------------------------
-- SECTION D — Profile role distribution (aggregates ONLY — no PII)
-- -----------------------------------------------------------------------------
select role::text as role_label, count(*)::bigint as profile_count
from public.profiles
group by role
order by role::text;


-- -----------------------------------------------------------------------------
-- SECTION E — Triggers (auth/profile, applications, documents, consultation, audit)
-- -----------------------------------------------------------------------------
select event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where (
    event_object_schema = 'auth'
    and event_object_table = 'users'
  )
  or (
    event_object_schema = 'public'
    and event_object_table in (
      'profiles',
      'students',
      'applications',
      'application_stage_history',
      'student_documents',
      'document_versions',
      'document_reviews',
      'offers',
      'deposits',
      'consultation_requests',
      'audit_events',
      'internal_notes',
      'visa_milestones'
    )
  )
order by event_object_schema, event_object_table, trigger_name;


-- -----------------------------------------------------------------------------
-- SECTION F — Security-sensitive functions (definitions; DO NOT EXECUTE)
-- Includes SECURITY DEFINER and proconfig (search_path) when set.
-- -----------------------------------------------------------------------------
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as proconfig_search_path_etc,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_app_role',
    'is_admin',
    'is_consultant',
    'is_student',
    'admin_set_user_role',
    'is_assigned_consultant',
    'can_access_student',
    'handle_new_user',
    'enforce_profile_role_guard',
    'write_audit_event',
    'reject_audit_mutation',
    'apply_document_review',
    'audit_document_review',
    'log_application_stage_change',
    'validate_application_stage_transition',
    'storage_student_id_from_path'
  )
order by p.proname, args;


-- -----------------------------------------------------------------------------
-- SECTION G — Function EXECUTE grants (especially admin_set_user_role)
-- -----------------------------------------------------------------------------
select routine_schema, routine_name, grantee, privilege_type, is_grantable
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'admin_set_user_role',
    'current_app_role',
    'is_admin',
    'is_consultant',
    'is_student',
    'is_assigned_consultant',
    'can_access_student',
    'write_audit_event'
  )
order by routine_name, grantee, privilege_type;


-- -----------------------------------------------------------------------------
-- SECTION H — RLS enabled / forced on relevant tables (if present)
-- -----------------------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  true as relation_exists
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'consultants',
    'students',
    'applications',
    'application_stage_history',
    'student_documents',
    'document_versions',
    'document_reviews',
    'document_checklist_templates',
    'offers',
    'offer_conditions',
    'deposits',
    'cas_i20_records',
    'visa_milestones',
    'tasks',
    'appointments',
    'notifications',
    'audit_events',
    'consultation_requests',
    'internal_notes'
  )
order by c.relname;

-- Explicit existence flags for critical tables (independent of RLS join)
select
  to_regclass('public.profiles') is not null as has_profiles,
  to_regclass('public.students') is not null as has_students,
  to_regclass('public.applications') is not null as has_applications,
  to_regclass('public.student_documents') is not null as has_student_documents,
  to_regclass('public.document_reviews') is not null as has_document_reviews,
  to_regclass('public.offers') is not null as has_offers,
  to_regclass('public.deposits') is not null as has_deposits,
  to_regclass('public.audit_events') is not null as has_audit_events,
  to_regclass('public.consultation_requests') is not null as has_consultation_requests,
  to_regclass('public.document_checklist_templates') is not null as has_document_checklist_templates;


-- -----------------------------------------------------------------------------
-- SECTION I — Policies (public schema + storage)
-- -----------------------------------------------------------------------------
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'consultants',
    'students',
    'applications',
    'application_stage_history',
    'student_documents',
    'document_versions',
    'document_reviews',
    'document_checklist_templates',
    'offers',
    'offer_conditions',
    'deposits',
    'audit_events',
    'consultation_requests',
    'tasks',
    'appointments',
    'notifications',
    'internal_notes',
    'visa_milestones',
    'cas_i20_records'
  )
order by tablename, policyname;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
order by tablename, policyname;


-- -----------------------------------------------------------------------------
-- SECTION J — Application / document / offer / deposit schema
-- Columns, constraints, indexes; specific field existence checks.
-- -----------------------------------------------------------------------------

-- J1 columns
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'applications',
    'student_documents',
    'document_versions',
    'document_reviews',
    'offers',
    'deposits',
    'document_checklist_templates'
  )
order by table_name, ordinal_position;

-- J2 targeted field existence (true/false — do not assume)
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'intake'
  ) as applications_has_intake,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'applications' and column_name = 'deadline'
  ) as applications_has_deadline,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_documents' and column_name = 'awaiting_upload'
  ) as student_documents_has_awaiting_upload,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_documents' and column_name = 'expires_on'
  ) as student_documents_has_expires_on,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'student_documents' and column_name = 'linked_application_id'
  ) as student_documents_has_linked_application_id;

-- J3 constraints (only if tables exist — run after J existence flags)
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  to_regclass('public.applications'),
  to_regclass('public.student_documents'),
  to_regclass('public.document_versions'),
  to_regclass('public.document_reviews'),
  to_regclass('public.offers'),
  to_regclass('public.deposits'),
  to_regclass('public.document_checklist_templates')
)
order by 1, 2;

-- J4 indexes
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'applications',
    'student_documents',
    'document_versions',
    'document_reviews',
    'offers',
    'deposits',
    'document_checklist_templates'
  )
order by tablename, indexname;


-- -----------------------------------------------------------------------------
-- SECTION K — Storage bucket student-documents (+ related metadata)
-- Do not create or alter buckets/policies.
-- -----------------------------------------------------------------------------
select id, name, public, file_size_limit, allowed_mime_types, created_at
from storage.buckets
where id = 'student-documents';

select
  exists (select 1 from storage.buckets where id = 'student-documents') as student_documents_bucket_exists;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    policyname ilike '%student%document%'
    or coalesce(qual, '') ilike '%student-documents%'
    or coalesce(with_check, '') ilike '%student-documents%'
  )
order by policyname;


-- -----------------------------------------------------------------------------
-- SECTION L — Consultation submission security (grants + policies)
-- Infer anon INSERT from grants/policies only. Do NOT insert test rows.
-- -----------------------------------------------------------------------------
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'consultation_requests'
order by grantee, privilege_type;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'consultation_requests'
order by policyname;

select
  exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'consultation_requests'
      and grantee in ('anon', 'public')
      and privilege_type = 'INSERT'
  ) as grant_insert_visible_to_anon_or_public,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'consultation_requests'
      and cmd = 'INSERT'
  ) as has_insert_policy;


-- -----------------------------------------------------------------------------
-- SECTION M — Audit and document-related triggers / functions inventory
-- -----------------------------------------------------------------------------
select event_object_schema, event_object_table, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and (
    event_object_table in (
      'audit_events',
      'document_reviews',
      'document_versions',
      'student_documents',
      'applications',
      'application_stage_history'
    )
    or trigger_name ilike '%audit%'
    or trigger_name ilike '%document%'
    or trigger_name ilike '%review%'
    or trigger_name ilike '%stage%'
  )
order by event_object_table, trigger_name;

select p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosecdef
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%audit%'
    or p.proname ilike '%document%review%'
    or p.proname in (
      'apply_document_review',
      'audit_document_review',
      'reject_audit_mutation',
      'write_audit_event',
      'log_application_stage_change',
      'validate_application_stage_transition'
    )
  )
order by p.proname;


-- -----------------------------------------------------------------------------
-- SECTION N — Schema dependencies affecting future additive work
-- Inspection only — no migration design/apply here.
-- Surfaces FKs and unique indexes that future fee/role/workflow columns must respect.
-- -----------------------------------------------------------------------------

-- N1 foreign keys touching students / applications / profiles / consultants
select
  conrelid::regclass::text as from_table,
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and (
    conrelid in (
      to_regclass('public.students'),
      to_regclass('public.applications'),
      to_regclass('public.student_documents'),
      to_regclass('public.offers'),
      to_regclass('public.deposits'),
      to_regclass('public.profiles'),
      to_regclass('public.consultants'),
      to_regclass('public.consultation_requests')
    )
    or confrelid in (
      to_regclass('public.students'),
      to_regclass('public.applications'),
      to_regclass('public.profiles'),
      to_regclass('public.consultants')
    )
  )
order by 1, 2;

-- N2 unique / primary constraints on students & applications (activation / workflow keys)
select conrelid::regclass::text as table_name, conname, contype, pg_get_constraintdef(oid) as definition
from pg_constraint
where contype in ('p', 'u')
  and conrelid in (
    to_regclass('public.students'),
    to_regclass('public.applications'),
    to_regclass('public.profiles'),
    to_regclass('public.student_documents')
  )
order by 1, 2;

-- N3 columns that may relate to fee / activation / assignment (existence only)
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    column_name ilike '%fee%'
    or column_name ilike '%activ%'
    or column_name ilike '%deposit%'
    or column_name ilike '%assign%'
    or column_name in (
      'assigned_consultant_id',
      'owned_by_consultant_id',
      'journey_stage',
      'stage',
      'status',
      'profile_id',
      'archived_at'
    )
  )
order by table_name, column_name;


-- -----------------------------------------------------------------------------
-- SECTION O — Authentication role source (Dashboard instructions; no SQL export)
-- -----------------------------------------------------------------------------
-- Run manually in Supabase Dashboard (do not paste user rows into tickets):
--
-- 1) Authentication → Users: open ONE non-production or known staff account.
-- 2) Inspect Raw App Meta Data / app_metadata for a `role` claim if present.
-- 3) Inspect Raw User Meta Data / user_metadata — MUST NOT be used for authorization.
-- 4) Compare app_metadata.role (if any) with public.profiles.role for the same user
--    using a COUNT-only or single-row check you perform privately; do not export PII.
-- 5) Record for engineering (redacted):
--      - Whether app_metadata.role is populated for staff accounts
--      - Whether profiles.role is the system of record
--      - Whether any mismatch was observed (yes/no only)
--
-- Application intent (local code): trusted role from JWT validation + profiles /
-- app_metadata via portal-auth resolveTrustedRole — never user_metadata.
--
-- End of package.