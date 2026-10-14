# M1 follow-up: drop `students_select_intake_registrar` (Option 5/6)

**Status:** Migration **prepared locally** as `20261014060000_drop_students_select_intake_registrar.sql`. **Not applied.** M1 PII residual is **NOT fixed** until this migration is applied on staging and JWT REST proves deny.

**Operator runbook (Option 6):** [`OPTION6-STAGING-VERIFICATION-RUNBOOK.md`](./OPTION6-STAGING-VERIFICATION-RUNBOOK.md)  
**Evidence ledger (Option 7):** [`OPTION7-STAGING-EVIDENCE-LEDGER.md`](./OPTION7-STAGING-EVIDENCE-LEDGER.md)  
**Contract mirror:** `src/lib/m1-registrar-select-rules.ts`

## Policy behavior

### Before (…14020000 still active)

| Policy | USING | Effect |
| --- | --- | --- |
| `students_select_access` | `profile_id = auth.uid()` OR `assigned_consultant_id = auth.uid()` OR `is_admin()` | Self / assigned / admin |
| `students_select_fee_verifier` | `can_verify_signup_fee()` | Org-wide fee-verifier SELECT (separate residual) |
| `students_select_intake_registrar` | `registered_by = auth.uid()` | **Any registrar JWT can `select *` on owned rows (incl. DOB)** |

RLS is **row-level only**. A permitted row exposes all columns the role has table privileges for.

### After (…14060000 applied)

| Policy | Status |
| --- | --- |
| `students_select_access` | Unchanged |
| `students_select_fee_verifier` | Unchanged (org-wide residual remains) |
| `students_select_intake_registrar` | **Dropped** |

Front Desk continues via DEFINER RPCs (`list_front_desk_intake_summaries`, `intake_register_student`, `is_intake_registrar`, `front_desk_assign_counsellor`). Officer `createStudentRecord` RETURNING relies on `students_select_access` because `assigned_consultant_id` is always set.

## Local audit: why drop is workflow-safe

| Workflow | Coverage without registrar SELECT |
| --- | --- |
| FD list / dashboard | `list_front_desk_intake_summaries` |
| FD register | `intake_register_student` |
| FD fee ownership | `is_intake_registrar` / `is_front_desk_fee_registrar` |
| FD assign counsellor | `front_desk_assign_counsellor` |
| Officer register | `createStudentRecord` + assignment SELECT |
| Admin / assigned / student-self | `students_select_access` |

`portal-officer` **does not** depend on `students_select_intake_registrar` (`denyFrontDeskConsultantWorkflows` + required `assigned_consultant_id`).

## Migration ordering

`…14020000` → `…14030000` → `…14040000` → `…14050000` → **`…14060000` (this)**

## Rollback

```sql
create policy students_select_intake_registrar
  on public.students
  for select
  to authenticated
  using (registered_by = auth.uid());
```

Re-opens M1 residual — emergency only.

## Staging evidence still required (PASS criteria)

Follow the full ordered checklist in **OPTION6-STAGING-VERIFICATION-RUNBOOK.md** (Steps A–G). Summary:

1. **Catalog parity first** (Step A) — before applying anything.
2. Apply missing `…14020000`–`…14060000` in order (owner-approved).
3. `intake_register_student`: success, forced `registered_by`, deny unauthorized, **no** `dob` in payload.
4. FD-A REST `select=*` on **owned pending** row (not self-assigned) → **0 rows / deny** after `…14060000`.
5. FD-B REST on FD-A’s row → deny/empty.
6. Admin / assigned counsellor / student-self / officer registration still succeed.
7. Child tables (apps/docs/offers/notes) not opened via `registered_by`.

Until Step E (FD owned `select=*`) is evidenced, claim status remains: **M1 NOT fixed**.

## Out-of-scope residuals (do not conflate with M1)

- `students_select_fee_verifier` — org-wide `select *` for fee verifiers.
- `front_desk_assign_counsellor` returns full `students` row (DEFINER) — RPC column narrowing is a separate hardening step.
- Staging catalog / migration parity still UNVERIFIED without remote SQL.
