# Fee-registrar remediation — `…14040000` (missing-only)

**Status:** Plan only. **Not applied.** No remote security verification claimed.  
**Source of truth for DDL:** [`supabase/migrations/20261014040000_signup_fee_fd_registrar_only.sql`](../../supabase/migrations/20261014040000_signup_fee_fd_registrar_only.sql)  
**Evidence ledger:** [`docs/testing/OPTION7-STAGING-EVIDENCE-LEDGER.md`](../testing/OPTION7-STAGING-EVIDENCE-LEDGER.md) Gate A / B3  
**Do not** invent a second migration file; do not re-author policy bodies.

---

## 1. Observed facts vs assumptions

| Claim | Kind | Source |
| --- | --- | --- |
| `is_front_desk_fee_registrar(uuid)` **absent** | **Observed** (operator catalog) | Option 7 Gate A / A3 |
| Fee policies still use `is_intake_registrar(student_id)` for registrar arm | **Observed** (operator) | Option 7 Gate A migration table |
| `…14040000` effects **not** on staging | **Observed mismatch** | Option 7 Confirmed mismatches #1 |
| `supabase_migrations.schema_migrations` **absent** | **Observed** | Option 7 A2 — object-based apply only |
| `…14030000` fee-policy shape present | **Inferred** from policy text (LIKELY), not ledger-proven | Option 7 reconciliation |
| `is_intake_registrar` / `is_front_desk` / `is_admin` exist | **Partially unknown** — helper implied by fee policy text; `is_front_desk` **UNKNOWN** in A3 pack | Must confirm in preflight |
| `students_select_intake_registrar` absent | **Observed**; apply status of `…14060000` **INDETERMINATE** | Separate from fee-registrar fix |
| R2 assign still returns `students` | **Observed** (full-row) | Option 7 — `…14080000` not reflected |
| R1 `students_select_fee_verifier` queue-scope | **UNKNOWN** in A pack; tracked separately | `…14090000` / R1-R2 owner SQL |

---

## 2. What `…14040000` adds (intended)

1. **Helper** `public.is_front_desk_fee_registrar(uuid)` = `is_intake_registrar(p) AND (is_front_desk() OR is_admin())` (SECURITY DEFINER, `search_path = public`).
2. **Grants:** `REVOKE` public/anon; `GRANT EXECUTE` to `authenticated` only.
3. **Replace** (drop + create) policies on `signup_fee_payments` only:
   - `signup_fee_select`
   - `signup_fee_insert`
   - `signup_fee_update`  
   Registrar arm switches from bare `is_intake_registrar` → `is_front_desk_fee_registrar`.
4. **Preserved arms:** `can_verify_signup_fee()`, `can_access_student` (+ `can_staff_mutate_student` on UPDATE), insert status / `verified_*` / `recorded_by` checks, and `enforce_signup_fee_update_guard` (unchanged by this file).

**Security intent:** Counsellor who only `registered_by` a student loses fee SELECT/INSERT/UPDATE via the registrar arm; Front Desk (or admin) registrar keeps it. Assigned counsellor path via `can_access_student` unchanged.

---

## 3. Conflict check vs R1 / R2 (local migration surfaces)

| Change | Touches | Conflict with applying `…14040000`? |
| --- | --- | --- |
| R1 `…14090000` | `students` policy `students_select_fee_verifier` only | **No** — different table/policy. Verifier fee SELECT still via `can_verify_signup_fee()` on `signup_fee_select` (preserved). |
| R2 `…14080000` | `front_desk_assign_counsellor` return shape / grants | **No** — different object. |
| M1 `…14060000` | Drop `students_select_intake_registrar` | **No** — students SELECT, not fee policies. |

Applying `…14040000` **does not** require R1/R2 to be applied first, and **does not** undo R1/R2 if they were already applied.

---

## 4. Preconditions (owner must PASS before DDL)

Run **read-only** on the intended staging project (affirm Dashboard ref first):

```sql
-- P0 environment
select current_database() as db_name, current_user as db_user, now() as checked_at;

-- P1 dependencies (all must be true)
select
  to_regprocedure('public.is_intake_registrar(uuid)') is not null as has_is_intake_registrar,
  to_regprocedure('public.is_front_desk()') is not null as has_is_front_desk,
  to_regprocedure('public.is_admin()') is not null as has_is_admin,
  to_regclass('public.signup_fee_payments') is not null as has_fee_table,
  to_regprocedure('public.can_verify_signup_fee()') is not null as has_can_verify,
  to_regprocedure('public.can_access_student(uuid)') is not null as has_can_access;

-- P2 current fee-registrar mismatch (expect: helper false; policies mention is_intake_registrar)
select to_regprocedure('public.is_front_desk_fee_registrar(uuid)') is not null
  as has_is_front_desk_fee_registrar;

select pol.polname,
       pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expr
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'signup_fee_payments'
  and pol.polname in ('signup_fee_select', 'signup_fee_insert', 'signup_fee_update')
order by pol.polname;
```

**Go / no-go**

| Result | Action |
| --- | --- |
| Any P1 flag `false` | **STOP** — apply / repair dependency migrations first (`…14020000` / `…14030000` / earlier fee foundation); do not apply `…14040000` alone |
| `has_is_front_desk_fee_registrar = true` **and** policy bodies already use `is_front_desk_fee_registrar` | **SKIP** — mismatch already closed; record B3 SKIP |
| Helper absent; fee policies still registrar-arm via `is_intake_registrar` | **GO** for missing-only apply of local `…14040000` file only |

---

## 5. Apply plan (owner-executed; agent must not run)

1. Owner affirms project ref = intended staging.
2. Preflight P0–P2 recorded in Option 7 (booleans + policy names / whether body contains `is_front_desk_fee_registrar` — no PII).
3. Apply **exactly** the contents of `20261014040000_signup_fee_fd_registrar_only.sql` once (Dashboard SQL Editor or approved CLI).  
   - File is already **idempotent**: `CREATE OR REPLACE` helper; `DROP POLICY IF EXISTS` + `CREATE POLICY`.
4. Do **not** re-apply `…14030000` (would widen registrar arm again).  
5. Do **not** bundle R1/R2/`…14060000` in the same change set unless separately approved.
6. Record Gate **B3** in Option 7: applied / skipped / blocked + timestamp (no secrets).

---

## 6. Expected effects

| Object | After apply |
| --- | --- |
| `is_front_desk_fee_registrar(uuid)` | Present; EXECUTE for `authenticated` |
| `signup_fee_select` / `_insert` / `_update` | Registrar arm calls `is_front_desk_fee_registrar` |
| Counsellor registrar (not FD, not assigned) | Fee mutate/select via registrar arm **denied** |
| FD registrar on owned intake | Fee unpaid/claimed path **still allowed** |
| Accounts / `can_verify_signup_fee` | Unchanged |
| Assigned staff via `can_access_student` | Unchanged |
| `students` policies / assign RPC | **Untouched** |

---

## 7. Rollback considerations

- Prefer forward-fix only after JWT proof.
- Manual rollback (not recommended once FD-only is accepted): restore `…14030000` fee policy bodies using `is_intake_registrar` alone; `DROP FUNCTION public.is_front_desk_fee_registrar(uuid)`.
- Rolling back **widens** counsellor-registrar fee access again.

---

## 8. Post-apply read-only verification (catalog)

```sql
select to_regprocedure('public.is_front_desk_fee_registrar(uuid)') is not null
  as has_is_front_desk_fee_registrar;

select pol.polname,
       pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
       pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expr
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'signup_fee_payments'
  and pol.polname in ('signup_fee_select', 'signup_fee_insert', 'signup_fee_update')
order by pol.polname;

-- Grants: authenticated EXECUTE expected; anon should be empty
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'is_front_desk_fee_registrar'
order by grantee, privilege_type;

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'is_front_desk_fee_registrar'
  and grantee = 'anon';
```

**Expect:** helper present; all three policy expressions mention `is_front_desk_fee_registrar`; anon EXECUTE empty.

**Not closed by catalog alone:** Counsellor-deny / FD-allow JWT REST cells in `SIGNUP_FEE_RLS_INTEGRATION_MATRIX` — remain OPEN until owner JWT evidence.

---

## 9. Unresolved decision (actionable)

**Owner decision required:** Authorize missing-only apply of `20261014040000_signup_fee_fd_registrar_only.sql` on the affirmed staging project **after** preflight P1 all-true and P2 confirms helper still absent.

Until then: Option 7 Gate **B3** stays **NOT RUN**; fee-registrar mismatch stays **OPEN**; R1/R2 JWT and `…14060000` remain **separate** OPEN items.
