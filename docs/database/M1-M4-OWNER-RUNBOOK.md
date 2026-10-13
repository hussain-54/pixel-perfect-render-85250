# M1 → M4 Owner Migration Runbook

**Target project ref:** `gjasuvlqfofpvrqvvnyz`  
**Status as of engineering delivery:** Migration files exist in the repository only. **Remote apply is not confirmed.** Do not treat local files or CI as proof of remote schema.

**Mode:** Forward-only SQL. Apply one file at a time. After each file, run the matching verification queries and record pass/fail before continuing.

---

## Pre-flight (every session)

1. Open Supabase Dashboard → confirm project ref is exactly **`gjasuvlqfofpvrqvvnyz`** (URL / project picker).
2. SQL Editor connected to that same project.
3. Prefer Dashboard SQL Editor or your approved migration path. Do **not** disable RLS. Do **not** grant `service_role` / broad privileges to `anon` or `authenticated` to “unblock” tests.
4. Keep a log: file name, apply timestamp (UTC), success/error text, verification section results (redacted — no PII, no keys).

### Global recovery rules (any failed migration)

| Situation | Action |
|-----------|--------|
| Syntax / enum cast error mid-file | Do **not** paste “fixed” broad grants. Fix the SQL forward (additive) with owner approval; re-run only the corrected forward migration. |
| Partial apply (`IF NOT EXISTS` left some objects) | Run verification SQL; apply only the missing pieces via a **new** forward migration — do not drop RLS. |
| Policy conflict (`already exists`) | Migration uses `drop policy if exists` in most places; re-run the same file only if it is idempotent for that object. Otherwise stop and report. |
| Wrong project | Stop. Do not continue. Switch to `gjasuvlqfofpvrqvvnyz` and re-verify from prerequisites. |
| Need to roll back | Prefer leave schema as-is and record state; destructive rollback requires explicit owner approval. **Never** “fix” by `ALTER TABLE … DISABLE ROW LEVEL SECURITY` or `GRANT ALL`. |

### Enum safety note (M3+)

`current_business_role()` returns `business_role | null`. Role checks must use:

```sql
coalesce(public.current_business_role() in ('hr_system', 'manager', 'admin'), false)
```

Never `coalesce(current_business_role(), '')` (empty string is invalid for the enum).

---

## Ordered checklist

Apply **strictly** in this order. Skip a step only when verification proves it is already present on remote.

### Step 0 — Foundation (prerequisites for M1)

| # | Filename | Required preceding objects |
|---|----------|----------------------------|
| 0a | `supabase/migrations/20261010010000_admission_officer_foundation.sql` | Auth/`profiles` baseline from project setup |
| 0b | `supabase/migrations/20261010120000_audit_trail_hardening.sql` | Foundation |
| 0c | `supabase/migrations/20261010153000_rls_security_hardening.sql` | Foundation — **must** provide `can_staff_mutate_student(uuid)`, `can_access_student(uuid)`, `is_admin()` |
| 0d | `supabase/migrations/20261010214500_consultation_public_insert.sql` | `consultation_requests` (needed for M3 marketing attribution) |

**Expected (minimum for M1):** tables `profiles`, `students`, `consultation_requests`; functions `is_admin()`, `can_access_student(uuid)`, `can_staff_mutate_student(uuid)`, `set_updated_at()`, `handle_new_user` (or equivalent).

**Verify:**

```sql
select
  to_regclass('public.profiles') is not null as has_profiles,
  to_regclass('public.students') is not null as has_students,
  to_regclass('public.consultation_requests') is not null as has_consultation_requests,
  to_regprocedure('public.is_admin()') is not null as has_is_admin,
  to_regprocedure('public.can_access_student(uuid)') is not null as has_can_access_student,
  to_regprocedure('public.can_staff_mutate_student(uuid)') is not null as has_can_staff_mutate_student,
  to_regprocedure('public.set_updated_at()') is not null as has_set_updated_at;
-- Expect: all true
```

Also run Phase 2C inspection as needed: [`phase-2c-owner-verification.sql`](./phase-2c-owner-verification.sql).

**Recovery:** If foundation objects are missing, apply foundation migrations first (owner approval). Do not start M1.

---

### Step 1 — M1 Intake activation

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012010000_milestone1_intake_activation.sql` |
| **Preceding** | Step 0 complete |
| **Adds** | Enums `business_role` (includes `office_ops`, `digital_manager`, …), `signup_fee_status`, `inquiry_channel`, `counselling_session_mode`, `handover_status`; `profiles.business_role`; student columns `inquiry_source`, `inquiry_channel`, `intake_date`, `registration_notes`, `portal_activated_at`; tables `signup_fee_payments`, `counselling_agreements`, `admission_handovers`; functions `current_business_role()`, `can_verify_signup_fee()`, `can_record_intake()`; RLS + policies on the three new tables; grants to `authenticated` |

**Verify:** [`milestone-1-owner-verification.sql`](./milestone-1-owner-verification.sql) sections V0–V5. Expect all `has_*` true; RLS enabled; policies listed; grants present.

**Recovery:** If policy create fails because helper missing → finish Step 0c. If enum already exists with different labels → stop and report (do not recreate enum destructively).

---

### Step 2 — M1 Student profile claim

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012020000_milestone1_student_profile_claim.sql` |
| **Preceding** | Step 1 |
| **Adds** | `claim_own_student_record()`; `REVOKE` from `public`; `GRANT EXECUTE` to `authenticated` |

**Verify:**

```sql
select to_regprocedure('public.claim_own_student_record()') is not null as has_claim_own_student_record;
-- Expect: true
```

Also re-check M1 verification V0 includes this function.

**Recovery:** Re-run file if function missing (idempotent `create or replace`). Do not grant execute to `anon`.

---

### Step 3 — M2 University finance

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012030000_milestone2_university_finance.sql` |
| **Preceding** | Steps 1–2 (`can_verify_signup_fee`, `can_staff_mutate_student`, `signup_fee_payments` still present) |
| **Adds** | Enums `university_fee_kind`, `university_fee_status`; table `university_fee_obligations`; RLS + policies `university_fee_select/insert/update`; grants to `authenticated` |

**Verify:** [`milestone-2-owner-verification.sql`](./milestone-2-owner-verification.sql). Expect table exists, RLS on, policies present, `signup_fee_payments` still exists (separate from university fees).

**Recovery:** If insert policy references missing helpers → confirm M1. Do not merge university fees into signup fee table.

---

### Step 4 — M3 HR attendance

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012040000_milestone3_hr_attendance.sql` |
| **Preceding** | M1 (`profiles`, `business_role`, `current_business_role`, `is_admin`, `set_updated_at`) |
| **Adds** | Enums `hr_employment_status`, `hr_attendance_status`; tables `hr_employees`, `hr_attendance_records`; `can_access_hr()`; RLS + select/mutate policies; grants |

**Verify:** see [`milestone-3-4-owner-verification.sql`](./milestone-3-4-owner-verification.sql) section **HR-A**.

**Recovery:** Enum coalesce errors → confirm migration uses boolean `coalesce(... in (...), false)`. Do not cast `''` to `business_role`.

---

### Step 5 — M3 HR leave + corrections

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012041000_milestone3_hr_leave_corrections.sql` |
| **Preceding** | Step 4 (`hr_employees`, `hr_attendance_records`) |
| **Adds** | `hr_employees.reporting_manager_id`; enums `hr_leave_status`, `hr_leave_type`; tables `hr_leave_requests`, `hr_attendance_corrections`; `can_mutate_hr()`, `is_own_hr_employee(uuid)`; RLS + policies; grants |

**Verify:** section **HR-B** in `milestone-3-4-owner-verification.sql`.

**Recovery:** If FK to `hr_employees` fails → Step 4 incomplete. Do not disable RLS on leave tables.

---

### Step 6 — M3 Digital marketing (base)

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012050000_milestone3_digital_marketing.sql` |
| **Preceding** | `consultation_requests` (Step 0d); M1 business_role helpers |
| **Adds** | Enum `marketing_campaign_status`; table `marketing_campaigns`; columns `consultation_requests.campaign_id`, `attribution_source`; `can_access_marketing()`, `can_mutate_marketing()`; RLS + policies; grants |

**Verify:** section **MKT-A** in `milestone-3-4-owner-verification.sql`.

**Recovery:** Missing `consultation_requests` → apply Step 0d first. Do not create a second CRM table for inquiries.

---

### Step 7 — M3 Marketing archive + attribution history

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012051000_milestone3_marketing_archive_history.sql` |
| **Preceding** | Step 6 |
| **Adds** | `marketing_campaigns.archived_at`; `consultation_requests.original_attribution_source`; table `marketing_attribution_history`; RLS select/insert; grant select, insert |

**Verify:** section **MKT-B** in `milestone-3-4-owner-verification.sql`.

**Recovery:** If history insert policy fails because `can_mutate_marketing` missing → complete Step 6.

---

### Step 8 — M4 Office operations

| | |
|--|--|
| **Filename** | `supabase/migrations/20261012060000_milestone4_office_operations.sql` |
| **Preceding** | M1 `business_role` includes `office_ops`; `is_admin()`, `current_business_role()`, `set_updated_at()` |
| **Adds** | Enums `ops_supplier_status`, `ops_purchase_status`, `ops_order_status`, `ops_expense_status`, `ops_stock_movement_kind`; `can_access_office_ops()`, `can_mutate_office_ops()`; tables `ops_suppliers`, `ops_inventory_items`, `ops_purchase_orders`, `ops_purchase_lines`, `ops_stock_movements`, `ops_sales_orders`, `ops_expenses`; RLS on all; select/mutate policies (expenses select also allows Accounts); grants |

**Verify:** section **OPS** in `milestone-3-4-owner-verification.sql`.

**Recovery:** Partial loop of dynamic policies → re-run file (uses drop/create). Confirm Accounts can **select** expenses but mutate still requires `can_mutate_office_ops()` — do not widen mutate to Accounts.

---

## Post-apply owner tasks (not SQL alone)

1. Set `profiles.business_role` for **test** staff accounts only (Front Desk, Accounts, HR, Digital Manager, Office Ops, Admission, Manager). Never copy production customer data into test accounts.
2. Confirm Auth email / sign-up works for a disposable student test user.
3. Run [`CLIENT-ACCEPTANCE-CHECKLIST.md`](./CLIENT-ACCEPTANCE-CHECKLIST.md) with separate authorized test accounts.
4. Fill the **Remote application log** below with observed results.

---

## Remote application log (owner fills)

| Step | File | Applied? (Y/N) | Verified? (Y/N) | Notes / error class |
|------|------|----------------|-----------------|---------------------|
| 0a–0d | Foundation… | | | |
| 1 | `…10000_milestone1_intake_activation.sql` | | | |
| 2 | `…20000_milestone1_student_profile_claim.sql` | | | |
| 3 | `…30000_milestone2_university_finance.sql` | | | |
| 4 | `…40000_milestone3_hr_attendance.sql` | | | |
| 5 | `…41000_milestone3_hr_leave_corrections.sql` | | | |
| 6 | `…50000_milestone3_digital_marketing.sql` | | | |
| 7 | `…51000_milestone3_marketing_archive_history.sql` | | | |
| 8 | `…60000_milestone4_office_operations.sql` | | | |

**Engineering claim:** all rows above are blank / unknown until the owner records observed Dashboard results for `gjasuvlqfofpvrqvvnyz`.
