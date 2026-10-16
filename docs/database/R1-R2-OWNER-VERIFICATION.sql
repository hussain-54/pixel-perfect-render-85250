-- =============================================================================
-- R1 / R2 owner verification (READ-ONLY) — run before approving production apply
-- Project: confirm Dashboard ref matches the intended environment.
-- Does NOT apply migrations. Does NOT mutate data.
-- Does NOT select from students / signup_fee_payments row data (no PII payload).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0) Environment sanity (no row data)
-- ---------------------------------------------------------------------------
select current_database() as db_name, current_user as db_user, now() as checked_at;

-- ---------------------------------------------------------------------------
-- 1) students SELECT policies (R1 residual + access OR)
-- ---------------------------------------------------------------------------
select
  pol.polname as policy_name,
  pol.polcmd as command,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'students'
  and pol.polname in ('students_select_access', 'students_select_fee_verifier')
order by pol.polname;

-- Expect before R1 apply: students_select_fee_verifier USING ≈ can_verify_signup_fee()
-- Expect after  …14090000: USING also requires EXISTS unpaid|claimed signup_fee_payments

-- ---------------------------------------------------------------------------
-- 2) signup_fee_payments SELECT policy (RLS interaction for R1 EXISTS subquery)
-- ---------------------------------------------------------------------------
select
  pol.polname as policy_name,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expr
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'signup_fee_payments'
  and pol.polname = 'signup_fee_select';

-- ---------------------------------------------------------------------------
-- 3) signup_fee_status enum labels (must include unpaid, claimed)
-- ---------------------------------------------------------------------------
select e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname = 'signup_fee_status'
order by e.enumsortorder;

-- ---------------------------------------------------------------------------
-- 4) Function signatures / return types / security definer (R2 focus)
-- ---------------------------------------------------------------------------
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as result_type,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'can_verify_signup_fee',
    'can_access_student',
    'verify_signup_fee_and_activate',
    'front_desk_assign_counsellor'
  )
order by p.proname;

-- Expect before R2 apply: front_desk_assign_counsellor result_type ≈ students
-- Expect after  …14080000: TABLE (id, case_id, full_name, … updated_at) — no dob

-- ---------------------------------------------------------------------------
-- 5) EXECUTE grants for assign RPC (authenticated + service_role expected)
-- ---------------------------------------------------------------------------
select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'front_desk_assign_counsellor'
order by grantee, privilege_type;

-- Optional: confirm anon has no EXECUTE (empty result is good)
select
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'front_desk_assign_counsellor'
  and grantee = 'anon';

-- ---------------------------------------------------------------------------
-- Post-apply JWT REST expectations (NOT runnable as SQL; operator evidence)
-- ---------------------------------------------------------------------------
-- R1 after …14090000:
--   Accounts JWT GET /students?select=*&id=eq.<student_without_unpaid_or_claimed>
--     → empty or 401/403 (FAIL if any row)
--   Accounts JWT GET /students?select=*&id=eq.<student_with_unpaid_or_claimed>
--     → allow (NOTE: full-row columns still present — accepted residual)
--   Accounts JWT rpc verify_signup_fee_and_activate → still succeeds
--   Admin JWT GET /students?select=* → still allow (students_select_access)
--
-- R2 after …14080000:
--   pg_get_function_result(front_desk_assign_counsellor) ≠ students
--   FD JWT rpc response keys MUST NOT include: dob, portal_activated_at,
--     archived_at, registration_notes, profile_id, last_activity_at
--   FD JWT assign on owned row still sets assigned_consultant_id
--   anon EXECUTE → deny; authenticated + service_role EXECUTE → allow
