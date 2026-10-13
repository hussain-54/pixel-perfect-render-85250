# Milestone 3 — HR & Attendance + Marketing (owner apply)

**Project ref:** `gjasuvlqfofpvrqvvnyz`

## Migrations (apply in order)

1. `supabase/migrations/20261012040000_milestone3_hr_attendance.sql` — employees + attendance + `can_access_hr()`
2. `supabase/migrations/20261012041000_milestone3_hr_leave_corrections.sql` — reporting manager, leave requests, attendance corrections, `can_mutate_hr()`
3. `supabase/migrations/20261012050000_milestone3_digital_marketing.sql` — campaigns + `consultation_requests.campaign_id` attribution

**Note:** `current_business_role()` returns enum `business_role` (nullable). Role checks must use  
`coalesce(current_business_role() in (...), false)` — never `coalesce(current_business_role(), '')`.

Local files are **not** proof of remote apply.

## Prerequisites

M1/M2 applied. Requires `profiles`, `is_admin()`, `is_consultant()`, `current_business_role()`, `set_updated_at()`, `consultation_requests`.

## Verify (read-only)

```sql
select to_regclass('public.hr_employees') is not null as has_hr_employees;
select to_regclass('public.hr_leave_requests') is not null as has_hr_leave;
select to_regclass('public.hr_attendance_corrections') is not null as has_hr_corrections;
select to_regclass('public.marketing_campaigns') is not null as has_marketing_campaigns;
select to_regprocedure('public.can_mutate_hr()') is not null as has_can_mutate_hr;
select to_regprocedure('public.can_mutate_marketing()') is not null as has_can_mutate_marketing;
```

## Business rules (HR)

- Claimed attendance duplicates blocked by unique `(employee_id, work_date)`; corrections write audit history.
- Leave approve/reject is server-side (HR / Manager / Admin matrix); client role alone is never trusted.
- Only **Super Admin** may rehire `terminated` → `active` (Admin ≠ Super Admin).
- No student CRM data in HR tables.

## Business rules (Marketing)

- Metrics count persisted `consultation_requests` linked by `campaign_id` only.
- Conversion to students uses existing Front Desk intake — no second CRM.
