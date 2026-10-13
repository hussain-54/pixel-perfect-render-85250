# Remote status probe — 2026-10-13

**Project URL configured in local `.env`:** `https://gjasuvlqfofpvrqvvnyz.supabase.co`  
**Ref confirmed:** `gjasuvlqfofpvrqvvnyz`  
**Method:** Read-only PostgREST probes with the configured **anon/publishable** key only. No DDL/DML. No service role. No migration apply.

## Observed

| Resource | HTTP | Interpretation |
|----------|------|----------------|
| `students` | 401 / `42501` permission denied for table | Relation **likely exists**; anon lacks SELECT (expected) |
| `signup_fee_payments` | 401 / `42501` | Relation **likely exists**; anon lacks SELECT (expected) |
| `consultation_requests` | 401 / `42501` | Relation **likely exists**; anon lacks SELECT (expected) |
| `university_fee_obligations` | 200, `Content-Range: */0` | Table **exists** (empty or no visible rows for anon) |
| `hr_employees` | 200, `*/0` | Table **exists** |
| `marketing_campaigns` | 200, `*/0` | Table **exists** |
| `ops_suppliers` | 200, `*/0` | Table **exists** |
| OpenAPI `/rest/v1/` | 401 | Cannot list full schema via OpenAPI with this key |

## What this does **not** prove

- Migration history / which files were applied
- RLS policy correctness, grants to `authenticated`, triggers, helper functions
- That `20261013010000_signup_fee_update_restrict.sql` is applied
- Any authenticated user workflow

## Owner next queries (Dashboard SQL Editor on this project only)

Run sections from:

1. `milestone-1-owner-verification.sql`
2. `milestone-2-owner-verification.sql`
3. `milestone-3-4-owner-verification.sql`

Plus:

```sql
-- Confirm fee UPDATE policy shape (expect can_verify / unpaid|claimed staff path after …13010000)
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'signup_fee_payments'
order by policyname;

select to_regprocedure('public.enforce_signup_fee_update_guard()') is not null
  as has_enforce_signup_fee_update_guard;
select to_regprocedure('public.verify_signup_fee_and_activate(uuid,uuid,text,text,boolean)') is not null
  as has_verify_signup_fee_and_activate;
```

Prefer the full script: `STAGING-OWNER-VERIFICATION.sql`.  
Return redacted results (booleans / policy names only). Do not share keys or student PII.
