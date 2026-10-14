# Option 6 — Staging verification runbook (authorized operator)

**Audience:** Explicitly authorized operator with staging DB / JWT access.  
**Agents / CI:** Do **not** run this against remote without written owner authorization.  
**M1 claim:** Remains **OPEN / NOT fixed** until Step E (FD owned `select=*`) is evidenced as deny/empty **after** `…14060000`.

**Local contract mirrors:** `src/lib/m1-registrar-select-rules.ts`, `src/lib/intake-register-rules.ts`  
**Evidence ledger (Option 7):** [`OPTION7-STAGING-EVIDENCE-LEDGER.md`](./OPTION7-STAGING-EVIDENCE-LEDGER.md) — fill during authorized staging; all gates start as NOT RUN.

---

## Migration ordering (apply only after Step A PASS)

| Order | File | Purpose |
| --- | --- | --- |
| 1 | `20261014020000_front_desk_intake_ownership.sql` | `registered_by`, registrar SELECT (to be dropped later), FD RPCs |
| 2 | `20261014030000_front_desk_fee_and_business_role_guard.sql` | `is_intake_registrar`, fee RLS arm (later narrowed) |
| 3 | `20261014040000_signup_fee_fd_registrar_only.sql` | `is_front_desk_fee_registrar` |
| 4 | `20261014050000_intake_register_student_rpc.sql` | Narrow registration RPC |
| 5 | `20261014060000_drop_students_select_intake_registrar.sql` | Drop registrar table SELECT |

Do **not** skip ahead. Do **not** edit historical migrations.

---

## Exact signatures (verify / rollback)

### `intake_register_student` (…14050000)

Args (in order):

`text, text, text, text, text, text, text, text, text, uuid, text, public.inquiry_channel, date, text, uuid`

```sql
-- Emergency rollback of Option 4 RPC only (does not restore registrar SELECT):
drop function if exists public.intake_register_student(
  text, text, text, text, text, text, text, text, text, uuid, text,
  public.inquiry_channel, date, text, uuid
);
```

### `students_select_intake_registrar` (…14060000)

```sql
-- Apply (forward):
drop policy if exists students_select_intake_registrar on public.students;

-- Emergency rollback (re-opens M1 residual):
create policy students_select_intake_registrar
  on public.students
  for select
  to authenticated
  using (registered_by = auth.uid());
```

---

## Step A — Catalog / migration-history parity (before any apply)

Mode: **SELECT / catalog only**. Prefer object-based checks if `supabase_migrations.schema_migrations` is missing (`42P01`).

Record PASS/FAIL/UNVERIFIED with evidence (no secrets/PII):

1. Confirm project ref matches intended staging (URL host only).
2. If `schema_migrations` exists: confirm prior versions through at least Phase 1 / AO foundation; note which of `…14020000`–`…14060000` are already present.
3. Object checks (examples):

```sql
select
  to_regprocedure('public.is_front_desk()') is not null as has_is_front_desk,
  to_regprocedure('public.is_intake_registrar(uuid)') is not null as has_is_intake_registrar,
  to_regprocedure('public.is_front_desk_fee_registrar(uuid)') is not null as has_fd_fee_registrar,
  to_regprocedure('public.list_front_desk_intake_summaries()') is not null as has_list_summaries,
  to_regprocedure('public.front_desk_assign_counsellor(uuid,uuid)') is not null as has_assign,
  to_regprocedure(
    'public.intake_register_student(text,text,text,text,text,text,text,text,text,uuid,text,inquiry_channel,date,text,uuid)'
  ) is not null as has_intake_register;

select polname
from pg_policy
where polrelid = 'public.students'::regclass
order by 1;
-- Expect before …14060000: students_select_access, students_select_fee_verifier,
--   students_select_intake_registrar (among others).
-- Expect after …14060000: registrar policy ABSENT.
```

4. Confirm `can_access_student` body does **not** reference `registered_by` (child-table leak guard).

**Gate:** Do not apply further migrations until A is documented for this project.

---

## Step B — Apply pending migrations (owner-authorized only)

**Hard gates before any apply:**

1. Step **A** documented for this project (PASS, or owner-accepted UNVERIFIED with written rationale).
2. Written owner authorization naming the project ref and which filenames may be applied.
3. From A’s inventory, build an explicit **missing-only** list. Do **not** paste or push a migration already confirmed present unless the owner authorizes a deliberate re-run.

**Apply rules:**

| Situation | Action |
| --- | --- |
| File absent on remote (A) | Apply that file only, in order B1→B5 |
| File already present (A) | **Skip** — do not re-paste full SQL “just in case” |
| Remote state unknown | **Stop** — finish A; do not guess |
| `supabase db push` | Allowed only if CLI migration history matches A; review pending set before push |
| Dashboard SQL Editor | Paste **one missing file at a time**; record filename + UTC time after each |

These migrations use `create or replace` / `drop … if exists` in places, so a mistaken re-run may be *syntactically* idempotent — that is **not** permission to skip A or to apply without authorization. Local files are **not** proof of remote apply.

Record B1–B5 outcomes in [`OPTION7-STAGING-EVIDENCE-LEDGER.md`](./OPTION7-STAGING-EVIDENCE-LEDGER.md). **B5** = `…14060000` confirmed (registrar policy absent).

---

## Step C — `intake_register_student` (authz + ownership + minimal columns)

Use FD-A JWT (Front Desk business role). Prefer PostgREST `rpc/intake_register_student`.

| # | Action | Expected |
| --- | --- | --- |
| C1 | Anon / no JWT call RPC | deny |
| C2 | Student JWT call RPC | deny (`not authorized to register intake`) |
| C3 | FD-A valid payload | success; `registered_by` = FD-A uid |
| C4 | Response keys | **no** `dob`, `registration_notes`, `portal_activated_at`, `archived_at`, `profile_id`, `last_activity_at` |
| C5 | Duplicate email | `duplicate student email` / 409-class |
| C6 | Client cannot set another `registered_by` | RPC has no ownership arg; stamp is `auth.uid()` |

---

## Step D — Permissive SELECT OR model (precondition for E)

Postgres permissive policies **OR**. After `…14060000`, remaining `students` SELECT policies:

| Policy | USING | FD typical? |
| --- | --- | --- |
| `students_select_access` | self / assigned consultant / admin | Only if FD is also `assigned_consultant_id` or admin |
| `students_select_fee_verifier` | `can_verify_signup_fee()` | Normally **false** for Front Desk |

**E1 is invalid unless all of the following are evidenced (ledger D0–D6):**

| ID | Precondition | How to prove (no PII / no tokens in ledger) |
| --- | --- | --- |
| D0 | Synthetic row **exists** | Admin (or approved read) `select id` returns exactly that id |
| D1 | `registered_by` = FD-A | Admin boolean/uuid match to FD-A label (not raw email) |
| D2 | `assigned_consultant_id` is null or ≠ FD-A | Admin check |
| D3 | `profile_id` is null or ≠ FD-A | Admin check (blocks self-profile SELECT path) |
| D4 | FD-A is **not** admin | `profiles.role` / app_role for FD-A ≠ admin/super_admin |
| D5 | FD-A is **not** fee verifier | As FD-A, `can_verify_signup_fee()` is false (or role matrix shows no verifier) |
| D6 | **B5** done — `students_select_intake_registrar` **absent** | `pg_policy` list from A/B re-check |

Mirror: `fdOwnedRestSelectShouldDeny({ isAdmin:false, canVerifySignupFee:false, isAssignedConsultantOnRow:false, isStudentSelfProfile:false }) === true`.

---

## Step E — Direct REST `select=*` (M1 PASS gate)

| # | Actor | Request | Expected |
| --- | --- | --- | --- |
| E1 | FD-A | `GET /rest/v1/students?select=*&id=eq.<Stu-Pending-A>` | Explicit deny **or** `200`+`[]` **only if D0–D6 PASS**; must not return full row / `dob` |
| E2 | FD-B | `GET /rest/v1/students?select=*&id=eq.<Stu-Pending-A>` | empty/deny |
| E3 | Anon | `GET /rest/v1/students?select=*` | deny |

**HTTP `200` + `[]` alone does not close M1** — see ledger “Empty result vs denial”.  
**M1 closed on staging only if E1 PASS with D PASS and B5 confirmed.** Unit tests / UI never close M1.  
Closing M1 does **not** resolve R1/R2/R3.

---

## Step F — Preserved legitimate access

| # | Actor | Action | Expected |
| --- | --- | --- | --- |
| F1 | Admin | `GET students?select=*` (or scoped) | allow |
| F2 | Assigned counsellor | `GET students?id=eq.<assigned>` | allow |
| F3 | Student | own row via `profile_id` | allow |
| F4 | Officer / counsellor | app register (`createStudentRecord` + `assigned_consultant_id=self`) | success + RETURNING |

---

## Step G — No unintended child-table access

With FD-A JWT on an owned, unassigned student id:

| # | Request | Expected |
| --- | --- | --- |
| G1 | `GET /rest/v1/applications?student_id=eq.<id>` | empty/deny (no `can_access_student` via `registered_by`) |
| G2 | `GET /rest/v1/student_documents?student_id=eq.<id>` | empty/deny |
| G3 | `GET /rest/v1/offers?student_id=eq.<id>` | empty/deny |
| G4 | `GET /rest/v1/internal_notes?student_id=eq.<id>` | empty/deny |

Fee table may still allow FD via `is_front_desk_fee_registrar` (intentional Option 3) — that is **not** students PII SELECT.

---

## Separate residuals (NOT closed by M1 / Options 5–8)

| ID | Residual | Why open after M1 closure |
| --- | --- | --- |
| **R1** | `students_select_fee_verifier` | Org-wide `select *` for `can_verify_signup_fee()` actors |
| **R2** | `front_desk_assign_counsellor` | `returns public.students` full row (DEFINER), including `dob` |
| **R3** | Permissive OR paths | FD still SELECTs if admin, fee-verifier, assigned-to-self, or self-profile — Gate D only scopes E1 |

Catalog / migration parity is a **prerequisite (Gate A)**, not closed by E1. Keep R1–R3 **OPEN** even if M1 closes.

---

## Claim language

| Evidence | Allowed statement |
| --- | --- |
| Local unit/tsc/eslint only | “Locally prepared; M1 OPEN” |
| A–G with **E1 PASS** + D + B5 | “M1 registrar table SELECT residual closed on staging (evidence …); R1–R3 remain OPEN” |
| Without E1 | **Never** “M1 fixed” |
