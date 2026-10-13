-- Milestone 2 — owner read-only verification (run after applying M2 migration).
-- Does not mutate data. Remote apply is confirmed only when these checks pass in your project.

-- 1) Table exists
select to_regclass('public.university_fee_obligations') is not null as has_university_fee_obligations;

-- 2) RLS enabled
select c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'university_fee_obligations';

-- 3) Expected functions still present (M1 deps used by M2)
select
  to_regprocedure('public.can_verify_signup_fee()') is not null as has_can_verify_signup_fee,
  to_regprocedure('public.can_staff_mutate_student(uuid)') is not null as has_can_staff_mutate_student,
  to_regprocedure('public.claim_own_student_record()') is not null as has_claim_own_student_record;

-- 4) Policies on university_fee_obligations
select pol.polname, pol.polcmd
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'university_fee_obligations'
order by pol.polname;

-- 5) Signup fee table remains separate (must still exist)
select to_regclass('public.signup_fee_payments') is not null as has_signup_fee_payments;
