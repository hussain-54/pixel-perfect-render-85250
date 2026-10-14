# Phase 2 — Front Desk intake ownership migration preflight

**Migration:** `supabase/migrations/20261014020000_front_desk_intake_ownership.sql`  
**Status:** Final read-only gate complete (2026-10-14). **No DDL executed.** Remote RPCs already present (unknown revision); hardened local SQL not confirmed on remote.  
**Date:** 2026-10-14

## Apply method (do not run without explicit authorization)

Intended project: whatever `VITE_SUPABASE_URL` / linked Supabase project points to (host only; never commit or print keys).

Recommended paths (pick one after owner confirmation):

1. **Supabase CLI (preferred):** from repo root, with project linked and DB password available via CLI login — `supabase db push` (applies pending migrations in order). Confirm Phase 1 `20261014010000_business_module_permissions.sql` is already on remote before push.
2. **Dashboard SQL Editor:** paste the full contents of `20261014020000_front_desk_intake_ownership.sql` into the **intended** project’s SQL editor and run once. Record the project ref in the apply log.
3. **CI / hosted pipeline:** only if the pipeline is wired to the same project and migrations are gated on manual approval.

Do **not** use the publishable/anon key to apply DDL. Do **not** apply to production without an explicit “apply to \<project-ref\>” instruction.

## Phase 1 compatibility

| Check | Result |
| --- | --- |
| Touches `business_module_permissions` | No |
| Depends on `profiles.business_role` / `business_role` enum | Yes (`front_desk_student_affairs`, `counsellor_consultant`) — same foundation as Phase 1 |
| Depends on `is_admin()`, `is_consultant()`, `is_assigned_consultant()`, `set_updated_at` | Yes (AO foundation + RLS hardening) |
| Depends on `students`, `consultants`, `signup_fee_payments` | Yes |
| Extends `can_access_student` | **No** (intentional — avoids child-table leak) |
| Silently drops unrelated Phase 1 policies | **No** |

## Destructive / mutating statements

| Statement | Risk |
| --- | --- |
| `alter table students add column if not exists registered_by` | Additive, nullable; historical rows stay `null` (FD-invisible until backfill — none in this migration) |
| `drop policy if exists students_select_intake_registrar` + recreate | Idempotent; only this migration’s policy |
| `create or replace function enforce_student_staff_fields` | **Replaces** existing trigger function body (necessary so assign RPC is not blocked; preserves admin / assigned-consultant / student self paths) |
| `create or replace` RPCs / `is_front_desk` | Additive / replace if re-run |
| `revoke all … from public/anon` + `grant execute … to authenticated` | Privilege tightening on new/replaced functions |
| No `drop table`, no data deletes, no `can_access_student` rewrite | — |

## Security review summary

| Control | Assessment |
| --- | --- |
| SECURITY DEFINER + `search_path = public` | Present on all new/replaced functions |
| `auth.uid()` null checks on RPCs | Present |
| Role gates (`is_front_desk` / `is_admin`) | Present on list/assign/picker RPCs |
| Counsellor eligibility (active + `counsellor_consultant`) | Enforced in `front_desk_assign_counsellor` |
| Ownership on assign (`registered_by = auth.uid()` unless admin) | Enforced in UPDATE WHERE |
| EXECUTE grants | authenticated only; revoked from `public` and `anon` |
| `registered_by` client spoofing | Mitigated by `enforce_students_registered_by` (non-admin forced to `auth.uid()`; service_role with null uid preserves provided value) |
| Assign RPC vs staff UPDATE trigger | Mitigated by registrar branch in `enforce_student_staff_fields` |
| Column exposure via `students_select_intake_registrar` | **Residual risk:** SELECT allows all columns on owned rows; app must not `select('*')` for FD — use RPC / column lists |
| Admin list RPC | Admin sees up to 500 students org-wide (admin already has broader access) |
| Child tables (apps, docs, offers, finance) | Not opened by `registered_by` (no `can_access_student` change) |

## Residual risks (accept or follow up)

1. Direct PostgREST `select * from students` as FD still returns full row for own registrations (RLS row-level only).
2. No historical backfill of `registered_by` — pre-migration rows remain FD-invisible.
3. Live authenticated role matrix is **UNVERIFIED** until migration is applied and JWT tests run.

## Rollback considerations

Forward-only preferred. If emergency rollback after apply:

1. `revoke execute` on the four functions from `authenticated` (or `drop function` the RPCs / `is_front_desk`).
2. `drop policy students_select_intake_registrar`.
3. `drop trigger students_enforce_registered_by`; optionally restore prior `enforce_student_staff_fields` body from `20261010153000_rls_security_hardening.sql`.
4. Leaving `registered_by` column in place is usually safest (nullable, unused).

Restoring the old trigger body **without** the registrar branch will break counsellor assign for Front Desk.

## Live probe results (anon / publishable key only — 2026-10-14)

Target host: `gjasuvlqfofpvrqvvnyz.supabase.co` (from local env URL; no secrets printed).

| Probe | Result | Verdict |
| --- | --- | --- |
| Phase 1 `business_module_permissions` SELECT | HTTP 200 | **PASS** — table present |
| `students.registered_by` via REST | HTTP 401 `permission denied for table students` (anon has no GRANT) | **UNVERIFIED** — cannot confirm column without authenticated/service SQL |
| OpenAPI `/rest/v1/` | HTTP 401 | **UNVERIFIED** — schema not readable anonymously |
| `is_front_desk()` | HTTP 200 → `false` | **PASS** function exists; **FAIL**/risk: callable with anon JWT (harden revoke may not be applied yet) |
| `list_front_desk_intake_summaries` | HTTP 400 `Not authenticated` | **PASS** — function exists; anon identity rejected |
| `front_desk_assign_counsellor` | HTTP 400 `Not authenticated` | **PASS** — function exists; anon identity rejected |
| `list_active_counsellor_desks` | HTTP 400 `Not authenticated` | **PASS** — function exists; anon identity rejected |
| DDL apply by this review | Not attempted | **PASS** (authorization gate held) |

**Important discrepancy:** Owner message said the migration has not been applied, but remote already exposes the three Phase 2 RPCs + `is_front_desk`. Treat remote as **partially applied or previously applied (unknown revision)**. Re-run the **hardened** SQL (this file) after authorization so triggers, `enforce_student_staff_fields` registrar branch, anon revokes, and narrowed counsellor-desk gate are guaranteed.

## Live verification checklist (post-authorize)

Use dedicated synthetic accounts only. Never claim PASS without execution.

| # | Check | Status |
| --- | --- | --- |
| 1 | Remote `registered_by` column present | **UNVERIFIED** |
| 2 | RPCs present + anon/`auth.uid()` denied | **PASS** (presence + null-uid deny); anon EXECUTE on `is_front_desk` still open |
| 3 | Hardened triggers / staff-field body on remote | **UNVERIFIED** |
| 4 | FD-A registers synthetic student; `registered_by` = FD-A | **UNVERIFIED** |
| 5 | FD-A assigns active counsellor desk | **UNVERIFIED** |
| 6 | FD-A sees own intake summary only | **UNVERIFIED** |
| 7 | FD-B cannot read FD-A’s registration | **UNVERIFIED** |
| 8 | Assigned counsellor can access student via existing workflows | **UNVERIFIED** |
| 9 | FD denied admission / doc review / offer-visa / finance-approval ops | **UNVERIFIED** |
| 10 | Admin retains intended access | **UNVERIFIED** |
| 11 | Direct table/RPC bypass attempts fail for unauthorized roles | **UNVERIFIED** |

## Probe commands (read-only, no DDL)

```bash
node scripts/probe-fd-migration-preflight.mjs
node scripts/probe-fd-migration-openapi.mjs
node scripts/probe-fd-migration-readonly-compare.mjs
```

## Final read-only gate (pre-production authorize)

### Hardening present in local SQL

| Fix | Present |
| --- | --- |
| Server-stamped `registered_by` (`enforce_students_registered_by`) | Yes |
| Restricted registrar UPDATE fields (`enforce_student_staff_fields`) | Yes |
| Narrowed counsellor desk picker (`is_admin` / `is_front_desk` only) | Yes |
| `revoke all` from `public` + `anon`; `grant execute` to `authenticated` | Yes (all four functions) |

### SECURITY DEFINER inventory (local)

All six functions use `security definer` + `set search_path = public`. RPCs check `auth.uid() is null` then `is_admin() or is_front_desk()`; assign also validates active `counsellor_consultant` and ownership in `UPDATE … WHERE`.

### Remote compare

| Item | Result |
| --- | --- |
| Host | `gjasuvlqfofpvrqvvnyz.supabase.co` |
| Service-role / SQL catalog / migration history | **UNVERIFIED** — no service role key in agent env; no linked `supabase link` project-ref |
| RPC presence (anon) | Present; list/assign/desks deny null uid; `is_front_desk` still executable as anon → `false` |
| Function body / triggers / `registered_by` column | **UNVERIFIED** |
| DDL this gate | **Not executed** |

### Idempotency

Safe to re-run SQL Editor paste: `IF NOT EXISTS` column/index, `DROP POLICY/TRIGGER IF EXISTS` + recreate, `CREATE OR REPLACE` same signatures. **Caveat:** if `20261014020000` is already in remote migration history, `supabase db push` will **not** re-apply hardened body — use SQL Editor (or a new forward migration) instead.

### Post-authorization apply step

```bash
# Preferred only if version NOT already recorded remotely:
npx supabase link --project-ref gjasuvlqfofpvrqvvnyz
npx supabase db push

# If version already recorded OR to guarantee hardened body:
# Dashboard → SQL Editor → run full file
# supabase/migrations/20261014020000_front_desk_intake_ownership.sql
```
