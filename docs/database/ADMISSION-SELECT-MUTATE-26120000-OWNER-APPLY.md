# Owner apply — Admission SELECT/mutate + realtime (`…26120000`)

**Forward-only.** Local migration files do **not** prove remote apply.

## What this changes

1. `students_select_access` → `USING (can_access_student(id))` so Admission Team can SELECT handed-over students.
2. `can_staff_mutate_student` → also true for `admission_team` / `manager` when an **accepted** handover has `to_owner_id = auth.uid()`.
3. `students_update_staff` → uses `can_staff_mutate_student` (journey stage after accept).
4. Additive Realtime publication for CRM workbench tables.

**Does not** extend `can_access_student` with `registered_by`, change fee verification, or grant mutate on `submitted`-only handovers.

## Apply (staging first)

### Option A — SQL Editor (preferred when migration history is incomplete)

1. Open Supabase SQL Editor on the **staging** project.
2. Paste and run the full body of:
   `supabase/migrations/20261026120000_admission_select_mutate_and_realtime.sql`
3. Run verification:
   `docs/database/ADMISSION-SELECT-MUTATE-26120000-OWNER-VERIFY.sql`

### Option B — CLI (only if project is linked and history is trusted)

```bash
npx supabase link --project-ref <staging-ref>
npx supabase db push
```

Review the pending migration list before confirming. Do **not** force-push or rewrite history.

## Post-apply JWT proof

| Actor | Check | Expect |
|---|---|---|
| Admission Team | SELECT student after handover `submitted` | allow |
| Admission Team | mutate / app INSERT while still `submitted` | deny |
| Admission Team | accept handover → `to_owner_id` = self → mutate | allow |
| Front Desk | `verify_signup_fee_and_activate` | deny |
| Counsellor | students not assigned to them | deny |

## Production

Apply only after staging verification passes. Same SQL Editor path is acceptable if CLI history is not the source of truth.
