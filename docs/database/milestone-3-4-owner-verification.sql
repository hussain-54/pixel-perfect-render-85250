-- =============================================================================
-- Milestone 3 (HR + Marketing) & Milestone 4 (Office Ops) — READ-ONLY verification
-- Target project: gjasuvlqfofpvrqvvnyz
-- Run after applying the matching migration. No DML/DDL. Do not disable RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HR-A) After 20261012040000_milestone3_hr_attendance.sql
-- Expect: all true / rls_enabled true / policies present
-- ---------------------------------------------------------------------------
select
  to_regclass('public.hr_employees') is not null as has_hr_employees,
  to_regclass('public.hr_attendance_records') is not null as has_hr_attendance_records,
  to_regprocedure('public.can_access_hr()') is not null as has_can_access_hr;

select c.relname, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('hr_employees', 'hr_attendance_records')
order by c.relname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('hr_employees', 'hr_attendance_records')
order by tablename, policyname;

select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name in ('hr_employees', 'hr_attendance_records')
order by table_name, privilege_type;

-- ---------------------------------------------------------------------------
-- HR-B) After 20261012041000_milestone3_hr_leave_corrections.sql
-- Expect: columns/functions/tables present; RLS on
-- ---------------------------------------------------------------------------
select
  to_regclass('public.hr_leave_requests') is not null as has_hr_leave_requests,
  to_regclass('public.hr_attendance_corrections') is not null as has_hr_attendance_corrections,
  to_regprocedure('public.can_mutate_hr()') is not null as has_can_mutate_hr,
  to_regprocedure('public.is_own_hr_employee(uuid)') is not null as has_is_own_hr_employee;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'hr_employees'
  and column_name = 'reporting_manager_id';
-- Expect: one row

select c.relname, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('hr_leave_requests', 'hr_attendance_corrections')
order by c.relname;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('hr_leave_requests', 'hr_attendance_corrections')
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- MKT-A) After 20261012050000_milestone3_digital_marketing.sql
-- ---------------------------------------------------------------------------
select
  to_regclass('public.marketing_campaigns') is not null as has_marketing_campaigns,
  to_regprocedure('public.can_access_marketing()') is not null as has_can_access_marketing,
  to_regprocedure('public.can_mutate_marketing()') is not null as has_can_mutate_marketing;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'consultation_requests'
  and column_name in ('campaign_id', 'attribution_source')
order by column_name;
-- Expect: campaign_id, attribution_source

select c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'marketing_campaigns';

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'marketing_campaigns'
order by policyname;

-- ---------------------------------------------------------------------------
-- MKT-B) After 20261012051000_milestone3_marketing_archive_history.sql
-- ---------------------------------------------------------------------------
select
  to_regclass('public.marketing_attribution_history') is not null as has_marketing_attribution_history;

select column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'marketing_campaigns' and column_name = 'archived_at')
    or (table_name = 'consultation_requests' and column_name = 'original_attribution_source')
  )
order by table_name, column_name;
-- Expect: archived_at, original_attribution_source

select c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'marketing_attribution_history';

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'marketing_attribution_history'
order by policyname;

select table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'authenticated'
  and table_name = 'marketing_attribution_history'
order by privilege_type;
-- Expect: INSERT, SELECT (not UPDATE/DELETE required)

-- ---------------------------------------------------------------------------
-- OPS) After 20261012060000_milestone4_office_operations.sql
-- ---------------------------------------------------------------------------
select
  to_regclass('public.ops_suppliers') is not null as has_ops_suppliers,
  to_regclass('public.ops_inventory_items') is not null as has_ops_inventory_items,
  to_regclass('public.ops_purchase_orders') is not null as has_ops_purchase_orders,
  to_regclass('public.ops_purchase_lines') is not null as has_ops_purchase_lines,
  to_regclass('public.ops_stock_movements') is not null as has_ops_stock_movements,
  to_regclass('public.ops_sales_orders') is not null as has_ops_sales_orders,
  to_regclass('public.ops_expenses') is not null as has_ops_expenses,
  to_regprocedure('public.can_access_office_ops()') is not null as has_can_access_office_ops,
  to_regprocedure('public.can_mutate_office_ops()') is not null as has_can_mutate_office_ops;

select c.relname, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname like 'ops_%'
order by c.relname;
-- Expect: rls_enabled true for all ops_* tables above

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename like 'ops_%'
order by tablename, policyname;

-- Confirm student fee tables remain separate (must still exist)
select
  to_regclass('public.signup_fee_payments') is not null as has_signup_fee_payments,
  to_regclass('public.university_fee_obligations') is not null as has_university_fee_obligations;

-- ---------------------------------------------------------------------------
-- SAFETY) Confirm RLS still enabled on sensitive student tables (spot check)
-- Expect: true for each
-- ---------------------------------------------------------------------------
select c.relname, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'students', 'signup_fee_payments', 'university_fee_obligations',
    'student_documents', 'applications'
  )
order by c.relname;
