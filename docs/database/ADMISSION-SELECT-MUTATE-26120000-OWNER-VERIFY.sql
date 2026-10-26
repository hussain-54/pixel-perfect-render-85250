-- =============================================================================
-- Owner verification — …26120000 admission SELECT/mutate + realtime pubs
-- Read-only. Paste in Supabase SQL Editor AFTER applying the migration.
-- Local files do NOT prove remote apply.
-- =============================================================================

-- V1) students_select_access must use can_access_student(id)
select policyname, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'students'
  and policyname = 'students_select_access';
-- Expected: qual mentions can_access_student

-- V2) students_update_staff must use can_staff_mutate_student(id)
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'students'
  and policyname = 'students_update_staff';
-- Expected: both qual and with_check mention can_staff_mutate_student

-- V3) can_staff_mutate_student includes accepted handover + to_owner_id
select
  pg_get_functiondef(p.oid) like '%admission_handovers%' as mentions_handovers,
  pg_get_functiondef(p.oid) like '%accepted%' as mentions_accepted,
  pg_get_functiondef(p.oid) like '%to_owner_id%' as mentions_to_owner_id,
  pg_get_functiondef(p.oid) like '%admission_team%' as mentions_admission_team
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'can_staff_mutate_student';
-- Expected: all four true

-- V4) Fee verifier SELECT arm still present (must not be dropped)
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'students'
  and policyname = 'students_select_fee_verifier';
-- Expected: one row

-- V5) Realtime publication membership (best-effort; hosted may differ)
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in (
    'students',
    'admission_handovers',
    'applications',
    'notifications',
    'tasks',
    'student_documents',
    'counselling_fee_verification_requests',
    'signup_fee_payments'
  )
order by tablename;
-- Expected: workbench tables present when publication exists

-- V6) JWT smoke (run as Admission Team user in app / REST — not as postgres)
-- 1. After counsellor submits handover: GET /students?id=eq.<student_id> → 200
-- 2. Before accept: application INSERT for that student → expect deny (no mutate)
-- 3. After accept (to_owner_id = actor): application INSERT / students UPDATE journey → allow
-- 4. Front Desk JWT: still cannot call verify_signup_fee_and_activate
-- 5. Counsellor JWT: still only assigned caseload via can_access_student
