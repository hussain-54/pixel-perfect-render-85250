# Database owner docs

**Target project ref:** `gjasuvlqfofpvrqvvnyz`  
Local migration files do **not** prove remote apply. M1–M4 apply status on remote is **unconfirmed**.

| Doc                                                                              | Purpose                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`M1-M4-OWNER-RUNBOOK.md`](./M1-M4-OWNER-RUNBOOK.md)                             | **Primary** ordered apply + verify + recovery checklist |
| [`STAGING-OWNER-VERIFICATION.sql`](./STAGING-OWNER-VERIFICATION.sql)             | **Staging gate** — consolidated read-only SQL (S0–S9)   |
| [`STAGING-E2E-TEST-MATRIX.md`](./STAGING-E2E-TEST-MATRIX.md)                     | Disposable-account E2E matrix (all NOT RUN until live)  |
| [`SIGNUP-FEE-SECURITY-REVIEW.md`](./SIGNUP-FEE-SECURITY-REVIEW.md)               | Review of `…13010000` / `…13020000` (unapplied)         |
| [`CLIENT-ACCEPTANCE-CHECKLIST.md`](./CLIENT-ACCEPTANCE-CHECKLIST.md)             | Live role-based acceptance + negative tests             |
| [`../testing/STAGING-TEST-ACCOUNTS.md`](../testing/STAGING-TEST-ACCOUNTS.md)     | Active setup: primary admin + Admin → Accounts          |
| [`../testing/DESIGNATE-PRIMARY-ADMIN.sql`](../testing/DESIGNATE-PRIMARY-ADMIN.sql) | Designate `hussaindurrani92@gmail.com` as admin        |
| [`../testing/STAGING-ROLE-MAP-AUDIT.md`](../testing/STAGING-ROLE-MAP-AUDIT.md)   | Schema audit for role / business_role mapping           |
| [`../testing/STAGING-MAP-AUTH-USERS-BY-EMAIL.sql`](../testing/STAGING-MAP-AUTH-USERS-BY-EMAIL.sql) | **OBSOLETE** — retired three-account placeholder SQL |
| [`../testing/PORTAL-VISUAL-E2E-CHECKLIST.md`](../testing/PORTAL-VISUAL-E2E-CHECKLIST.md) | Visual portal E2E (all BLOCKED until owner runs)  |
| [`phase-2c-owner-verification.sql`](./phase-2c-owner-verification.sql)           | Phase 2C read-only inspection                           |
| [`milestone-1-owner-verification.sql`](./milestone-1-owner-verification.sql)     | M1 verify                                               |
| [`milestone-2-owner-verification.sql`](./milestone-2-owner-verification.sql)     | M2 verify                                               |
| [`milestone-3-4-owner-verification.sql`](./milestone-3-4-owner-verification.sql) | M3 HR/Marketing + M4 Ops verify                         |
| [`MILESTONE1-OWNER-APPLY.md`](./MILESTONE1-OWNER-APPLY.md)                       | M1 intake notes                                         |
| [`MILESTONE2-OWNER-APPLY.md`](./MILESTONE2-OWNER-APPLY.md)                       | M2 university finance notes                             |
| [`MILESTONE3-HR-OWNER-APPLY.md`](./MILESTONE3-HR-OWNER-APPLY.md)                 | M3 HR notes                                             |
| [`MILESTONE3-MARKETING-OWNER-APPLY.md`](./MILESTONE3-MARKETING-OWNER-APPLY.md)   | M3 marketing notes                                      |
| [`MILESTONE4-OPS-OWNER-APPLY.md`](./MILESTONE4-OPS-OWNER-APPLY.md)               | M4 office operations notes                              |
| [`REPORTS-PREP.md`](./REPORTS-PREP.md)                                           | Reliable vs unavailable report metrics                  |
| [`../PROJECT_AUDIT.md`](../PROJECT_AUDIT.md)                                     | Full repository audit status                            |
| [`../E2E_TEST_REPORT.md`](../E2E_TEST_REPORT.md)                                 | End-to-end verification report                          |

**Authored, not applied (owner approval required):**

- `supabase/migrations/20261013010000_signup_fee_update_restrict.sql` — signup fee UPDATE / student_id hardening
- `supabase/migrations/20261013020000_signup_fee_verify_activate_rpc.sql` — atomic verify + activate RPC (app not wired until applied)

**Read-only probe notes:** [`REMOTE-STATUS-PROBE-2026-10-13.md`](./REMOTE-STATUS-PROBE-2026-10-13.md)

---

# Phase 2C — Supabase owner SQL verification

**Package:** [`phase-2c-owner-verification.sql`](./phase-2c-owner-verification.sql)  
**Mode:** Read-only inspection. Local migration files do **not** prove remote apply.

## Owner steps

1. Open the Supabase Dashboard for **exactly** project ref `gjasuvlqfofpvrqvvnyz` (confirm the URL / project picker before running anything).
2. Open **SQL Editor**. Confirm the editor is connected to that same project.
3. Open `phase-2c-owner-verification.sql` and run **one section at a time** (A → O notes). Each section is independent.
4. **Section A:** run **A0** (and A1) only. Do **not** run the old direct `schema_migrations` select if A0 shows the table missing. A `42P01` on that catalog means the migration history table is not available in this project — continue with **B** onward; it does **not** prove that no schema was ever applied.
5. If a query fails, record:
   - Section letter/name
   - Exact error text
   - Class: missing relation / missing column / permission denied / other
6. Share **redacted** results only:
   - Keep aggregates, column names, policy names, function definitions as needed for engineering
   - Do **not** share secrets, service-role keys, access tokens, passwords, full user rows, emails, names, phone numbers, or storage paths that identify students
7. Note the **execution context** (SQL Editor / postgres role). Dashboard SQL often sees more than the application anon key.

## What this package does not do

- No `INSERT` / `UPDATE` / `DELETE` / DDL / `GRANT` / migrations
- No privileged RPC “tests” that mutate state
- No bucket creation or policy changes
- No application code changes

## After you return results

Engineering can design Phase 3B additive migrations against **verified** remote facts. Do not apply migrations until that design is approved.
