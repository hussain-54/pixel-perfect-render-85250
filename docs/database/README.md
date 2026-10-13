# Database owner docs

**Target project ref:** `gjasuvlqfofpvrqvvnyz`  
Local migration files do **not** prove remote apply. M1–M4 apply status on remote is **unconfirmed**.

| Doc                                                                              | Purpose                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [`M1-M4-OWNER-RUNBOOK.md`](./M1-M4-OWNER-RUNBOOK.md)                             | **Primary** ordered apply + verify + recovery checklist |
| [`CLIENT-ACCEPTANCE-CHECKLIST.md`](./CLIENT-ACCEPTANCE-CHECKLIST.md)             | Live role-based acceptance + negative tests             |
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
