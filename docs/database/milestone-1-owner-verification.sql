-- =============================================================================
-- Milestone 1 — Owner READ-ONLY verification (run after applying M1 migrations)
-- Target: confirm schema/functions/policies exist. No DML/DDL.
-- Migrations under test:
--   20261012010000_milestone1_intake_activation.sql
--   20261012020000_milestone1_student_profile_claim.sql
-- Prerequisite migration for can_staff_mutate_student:
--   20261010153000_rls_security_hardening.sql
-- =============================================================================

-- V0) Prerequisite helpers
select
  to_regprocedure('public.can_staff_mutate_student(uuid)') is not null as has_can_staff_mutate_student,
  to_regprocedure('public.can_access_student(uuid)') is not null as has_can_access_student,
  to_regprocedure('public.is_admin()') is not null as has_is_admin,
  to_regprocedure('public.set_updated_at()') is not null as has_set_updated_at,
  to_regprocedure('public.claim_own_student_record()') is not null as has_claim_own_student_record,
  to_regprocedure('public.can_verify_signup_fee()') is not null as has_can_verify_signup_fee,
  to_regprocedure('public.can_record_intake()') is not null as has_can_record_intake,
  to_regprocedure('public.current_business_role()') is not null as has_current_business_role;

-- V1) Tables
select
  to_regclass('public.signup_fee_payments') is not null as has_signup_fee_payments,
  to_regclass('public.counselling_agreements') is not null as has_counselling_agreements,
  to_regclass('public.admission_handovers') is not null as has_admission_handovers;

-- V2) students / profiles columns
select column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'students'
  and column_name in (
    'profile_id', 'inquiry_source', 'inquiry_channel', 'intake_date',
    'registration_notes', 'portal_activated_at'
  )
order by column_name;

select column_name, udt_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'business_role';

-- V3) Enums
select t.typname, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in (
    'business_role', 'signup_fee_status', 'inquiry_channel',
    'counselling_session_mode', 'handover_status'
  )
order by t.typname, e.enumsortorder;

-- V4) RLS + policies
select c.relname, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'signup_fee_payments', 'counselling_agreements', 'admission_handovers', 'students'
  )
order by c.relname;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'signup_fee_payments', 'counselling_agreements', 'admission_handovers', 'students'
  )
order by tablename, policyname;

-- V5) Grants (authenticated)
select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in (
    'signup_fee_payments', 'counselling_agreements', 'admission_handovers'
  )
order by table_name, privilege_type;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'claim_own_student_record', 'can_verify_signup_fee', 'can_record_intake', 'current_business_role'
  )
order by routine_name, grantee;

-- V6) anon must not have table writes on fee/handover tables
select
  exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'signup_fee_payments'
      and grantee in ('anon', 'public')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) as anon_or_public_has_signup_fee_writes;
