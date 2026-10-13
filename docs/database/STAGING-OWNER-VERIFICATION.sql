-- =============================================================================
-- Staging owner verification — READ ONLY
-- Target project ref (MUST match Dashboard URL / picker): gjasuvlqfofpvrqvvnyz
--
-- Mode: SELECT / catalog inspection only. No INSERT/UPDATE/DELETE/DDL/GRANT.
-- Do NOT infer "migration applied" from table presence alone.
-- Redact results: booleans, counts, policy/function names — no PII, no keys.
--
-- How to run:
-- 1) Open Supabase Dashboard → confirm project ref is exactly gjasuvlqfofpvrqvvnyz
-- 2) SQL Editor → run ONE SECTION at a time (S0 → S8)
-- 3) Record pass/fail vs Expected; share redacted results with engineering
-- =============================================================================

-- -----------------------------------------------------------------------------
-- S0) Project context check (manual + session)
-- Expected:
--   - Dashboard URL contains /project/gjasuvlqfofpvrqvvnyz
--   - current_database() returns a non-empty name (often "postgres")
-- Failure:
--   - Wrong project selected → STOP. Do not continue on another ref.
-- -----------------------------------------------------------------------------
select
  current_database() as database_name,
  current_user as session_user,
  current_setting('request.jwt.claim.role', true) as jwt_role_if_any;

-- Manual checkbox (not SQL): [ ] Dashboard project ref = gjasuvlqfofpvrqvvnyz


-- -----------------------------------------------------------------------------
-- S1) Migration history (when available)
-- Expected (if catalog present):
--   - Rows for foundation / M1–M4 version names if your tracker stores them
-- Failure interpretations:
--   - 42P01 relation missing → history table unavailable; continue S2+; status = Unknown
--   - Empty result → no recorded versions (does NOT prove schema absent)
-- -----------------------------------------------------------------------------
select to_regclass('supabase_migrations.schema_migrations') as schema_migrations_regclass;

-- Run only if schema_migrations_regclass is not null:
-- select version, name
-- from supabase_migrations.schema_migrations
-- order by version;


-- -----------------------------------------------------------------------------
-- S2) Foundation + M1 presence (tables / columns / enums)
-- Expected: all has_* true; portal_activated_at + business_role present;
--   signup_fee_status includes unpaid,claimed,verified,waived,rejected
-- Failure: any has_* false → that migration package Missing or Partial
-- -----------------------------------------------------------------------------
select
  to_regclass('public.students') is not null as has_students,
  to_regclass('public.profiles') is not null as has_profiles,
  to_regclass('public.consultants') is not null as has_consultants,
  to_regclass('public.signup_fee_payments') is not null as has_signup_fee_payments,
  to_regclass('public.counselling_agreements') is not null as has_counselling_agreements,
  to_regclass('public.admission_handovers') is not null as has_admission_handovers,
  to_regclass('public.student_assessments') is not null as has_student_assessments,
  to_regclass('public.student_documents') is not null as has_student_documents,
  to_regclass('public.applications') is not null as has_applications,
  to_regclass('public.offers') is not null as has_offers;

select column_name, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'students'
  and column_name in (
    'profile_id', 'portal_activated_at', 'assigned_consultant_id',
    'journey_stage', 'inquiry_source', 'inquiry_channel', 'intake_date'
  )
order by column_name;

select column_name, udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name in ('role', 'business_role', 'full_name')
order by column_name;

select t.typname, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in ('business_role', 'signup_fee_status', 'handover_status', 'app_role')
order by t.typname, e.enumsortorder;


-- -----------------------------------------------------------------------------
-- S3) M2 / M3 / M4 table presence (existence only)
-- Expected: has_* true after those milestones applied
-- Note: anon REST 200 earlier only suggests presence — confirm here
-- -----------------------------------------------------------------------------
select
  to_regclass('public.university_fee_obligations') is not null as has_university_fee_obligations,
  to_regclass('public.hr_employees') is not null as has_hr_employees,
  to_regclass('public.hr_attendance_records') is not null as has_hr_attendance_records,
  to_regclass('public.hr_leave_requests') is not null as has_hr_leave_requests,
  to_regclass('public.marketing_campaigns') is not null as has_marketing_campaigns,
  to_regclass('public.ops_suppliers') is not null as has_ops_suppliers,
  to_regclass('public.ops_purchase_orders') is not null as has_ops_purchase_orders;


-- -----------------------------------------------------------------------------
-- S4) RLS enabled / forced + key policies
-- Expected: rls_enabled true for listed tables
-- Failure: rls_enabled false → BLOCKER (do not broaden; fix apply)
-- Table present + RLS off ≠ "verified applied"
-- -----------------------------------------------------------------------------
select c.relname,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'students', 'profiles', 'signup_fee_payments', 'counselling_agreements',
    'admission_handovers', 'university_fee_obligations',
    'hr_employees', 'marketing_campaigns', 'ops_suppliers',
    'student_documents', 'applications', 'offers'
  )
order by c.relname;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'students', 'signup_fee_payments', 'counselling_agreements',
    'admission_handovers', 'university_fee_obligations',
    'hr_employees', 'marketing_campaigns', 'ops_suppliers'
  )
order by tablename, policyname;


-- -----------------------------------------------------------------------------
-- S5) Helper functions — existence, security, search_path, execute grants
-- Expected: has_* true; can_verify / can_access / can_staff_mutate present;
--   search_path includes public for security definer helpers
-- Failure: missing function → Partial / Missing migration
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.can_access_student(uuid)') is not null as has_can_access_student,
  to_regprocedure('public.can_staff_mutate_student(uuid)') is not null as has_can_staff_mutate_student,
  to_regprocedure('public.can_verify_signup_fee()') is not null as has_can_verify_signup_fee,
  to_regprocedure('public.can_record_intake()') is not null as has_can_record_intake,
  to_regprocedure('public.current_business_role()') is not null as has_current_business_role,
  to_regprocedure('public.is_admin()') is not null as has_is_admin,
  to_regprocedure('public.claim_own_student_record()') is not null as has_claim_own_student_record,
  to_regprocedure('public.enforce_student_staff_fields()') is not null as has_enforce_student_staff_fields,
  to_regprocedure('public.enforce_signup_fee_update_guard()') is not null
    as has_enforce_signup_fee_update_guard,
  to_regprocedure('public.verify_signup_fee_and_activate(uuid,uuid,text,text,boolean)') is not null
    as has_verify_signup_fee_and_activate;

select p.proname,
       p.prosecdef as security_definer,
       pg_get_userbyid(p.proowner) as owner,
       coalesce(p.proconfig::text, '{}') as config_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_access_student', 'can_staff_mutate_student', 'can_verify_signup_fee',
    'enforce_student_staff_fields', 'enforce_signup_fee_update_guard',
    'verify_signup_fee_and_activate', 'claim_own_student_record'
  )
order by p.proname;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'can_verify_signup_fee', 'verify_signup_fee_and_activate',
    'claim_own_student_record', 'can_access_student'
  )
  and grantee in ('authenticated', 'anon', 'PUBLIC', 'public')
order by routine_name, grantee;


-- -----------------------------------------------------------------------------
-- S6) Triggers (enabled state)
-- Expected after …13010000: signup_fee_enforce_update_guard enabled
-- Expected foundation: students_enforce_staff_fields enabled
-- Expected after …13020000: students_select_fee_verifier policy present
-- -----------------------------------------------------------------------------
select c.relname as table_name,
       t.tgname as trigger_name,
       t.tgenabled as enabled_code,
       case t.tgenabled
         when 'O' then 'enabled'
         when 'D' then 'disabled'
         when 'R' then 'replica'
         when 'A' then 'always'
         else t.tgenabled::text
       end as enabled_state
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
  and c.relname in ('students', 'signup_fee_payments', 'admission_handovers')
order by c.relname, t.tgname;


-- -----------------------------------------------------------------------------
-- S7) Signup-fee policy shape (pre vs post …13010000 / …13020000)
-- Expected AFTER …13010000:
--   signup_fee_select / update mention can_verify_signup_fee
--   trigger signup_fee_enforce_update_guard enabled
-- Expected AFTER …13020000:
--   students_select_fee_verifier present
--   enforce_student_staff_fields mentions can_verify + portal_activated_at
-- Classification:
--   - enforce_signup_fee_update_guard missing → …13010000 Missing
--   - policy text lacks verify gate → …13010000 Missing / Partial
-- -----------------------------------------------------------------------------
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'signup_fee_payments'
order by policyname;

select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'students'
  and policyname in (
    'students_select_access',
    'students_select_fee_verifier',
    'students_update_staff',
    'students_update_self_contact'
  )
order by policyname;

select
  pg_get_functiondef(p.oid) like '%portal_activated_at%' as enforce_mentions_portal_activated,
  pg_get_functiondef(p.oid) like '%can_verify_signup_fee%' as enforce_allows_fee_verifier,
  pg_get_functiondef(p.oid) like '%to_jsonb%' as enforce_uses_jsonb_allowlist
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'enforce_student_staff_fields';


-- -----------------------------------------------------------------------------
-- S8) Storage bucket + policies (student-documents)
-- Expected: bucket id student-documents exists; public = false;
--   storage policies present for authenticated paths
-- Failure: no bucket → storage E2E BLOCKED
-- -----------------------------------------------------------------------------
select id, name, public, file_size_limit
from storage.buckets
where id = 'student-documents';

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;


-- -----------------------------------------------------------------------------
-- S9) Grants snapshot (authenticated) — selected tables
-- Expected: SELECT/INSERT/UPDATE as designed; no unexpected anon table grants
-- Anon 200 on empty M2–M4 tables earlier → inspect anon grants below
-- -----------------------------------------------------------------------------
select table_schema, table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'students', 'signup_fee_payments', 'university_fee_obligations',
    'hr_employees', 'marketing_campaigns', 'ops_suppliers'
  )
  and grantee in ('authenticated', 'anon', 'PUBLIC')
order by table_name, grantee, privilege_type;


-- =============================================================================
-- Result classification cheat sheet (per package)
--   Confirmed applied and verified — all expected objects + RLS + policies match
--   Partially applied — some tables/functions present, policies/triggers incomplete
--   Missing — required relation/function absent
--   Applied but verification failed — objects present but RLS off / wrong policy
--   Unknown — history unavailable and results inconclusive
-- =============================================================================
