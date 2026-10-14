# Option 7 — Staging evidence ledger (M1 closure gate)

**Purpose:** Record authorized staging observations for gates A–G.  
**Runbook:** [`OPTION6-STAGING-VERIFICATION-RUNBOOK.md`](./OPTION6-STAGING-VERIFICATION-RUNBOOK.md)  
**Local contracts:** `src/lib/m1-registrar-select-rules.ts`  
**Status of this file:** Template prepared locally. **No staging execution has been performed by the agent.** Every gate below is **`NOT RUN`**.  
**Option 8:** Runbook ↔ ledger alignment reviewed; gates remain **NOT RUN** (no invented PASS).

**M1 claim rule:** M1 stays **OPEN** until gate **E1** is recorded as **PASS** with non-secret evidence after **B5** (`…14060000`) is confirmed and **D0–D6** PASS. Local unit/tsc/eslint **never** close M1. Closing M1 does **not** close R1–R3.

---

## Evidence hygiene (mandatory)

| Allowed in this ledger | Forbidden |
| --- | --- |
| Project host / project-ref (no keys) | Access tokens, refresh tokens, service-role keys, passwords |
| Synthetic account labels (`FD-A`, `FD-B`, `Officer-1`) | Real student names, DOB, phones, emails with PII |
| Synthetic UUIDs / case ids created for the test | Production case ids tied to real people |
| HTTP status codes; whether body was `[]` / object / error code | Full JWT payloads |
| Policy names, migration filenames | Secrets from `.env` |

### Empty result vs denial

| Observation | Alone proves? | Additional setup required |
| --- | --- | --- |
| HTTP `401` / `403` / PostgREST permission error | Explicit denial for that request | Record status + error code (no token) |
| HTTP `200` with `[]` | **Not** sufficient by itself | Prove row exists (admin/`service_role` catalog check or prior create), prove FD-A is `registered_by`, prove `assigned_consultant_id` ≠ FD-A, prove FD-A is not admin/fee-verifier, prove `…14060000` applied (registrar policy absent) |
| App UI success/failure | Never | Use direct REST/RPC only for M1 |

### Local vs staging

| Kind | Role |
| --- | --- |
| Unit tests / `tsc` / ESLint | Local contract only — **not** M1 closure |
| This ledger (filled by operator) | Staging integration evidence |

---

## Synthetic identities and data (prepare before C–G)

| Label | Role | Notes |
| --- | --- | --- |
| `FD-A` | Front Desk JWT (`business_role = front_desk_student_affairs`) | Not admin; not fee verifier |
| `FD-B` | Second Front Desk JWT | Distinct from FD-A |
| `Officer-1` | Counsellor / officer JWT with consultants desk | For F4 |
| `Counsellor-Assigned` | Assigned consultant on a known student | For F2 |
| `Admin-1` | Admin JWT | For F1 / catalog assists |
| `Student-Self` | Student JWT linked via `profile_id` | For F3 |
| `Stu-Pending-A` | Synthetic student | `registered_by = FD-A`, **`assigned_consultant_id` null** (or not FD-A) — **required for E1** |
| `Stu-Other-B` | Synthetic student | `registered_by = FD-B` — for E2 cross-registrar |

Do not paste real credentials into this file. Store JWT material only in an approved secret store outside the repo.

---

## Ledger header (operator fills)

| Field | Value |
| --- | --- |
| Staging project host / ref | _TBD_ |
| Operator name | _TBD_ |
| Authorization reference (ticket / email) | _TBD_ |
| Session start (UTC) | _TBD_ |
| Session end (UTC) | _TBD_ |
| Overall M1 status | **OPEN** (do not change until E1 PASS) |

---

## Gate A — Remote catalog / migration-history parity

**Security objective:** Know what is already on staging before applying DDL; never assume local migrations are remote.

| Field | Content |
| --- | --- |
| Gate | **A** |
| Required identity | Operator with catalog SELECT (Dashboard SQL or approved read path). Prefer no JWT student data. |
| Synthetic data | None |
| Exact operation | Catalog / `schema_migrations` if present; else object checks from Option 6 Step A (`to_regprocedure`, `pg_policy` on `public.students`; confirm `can_access_student` has no `registered_by`) |
| Expected | Document which of `…14020000`–`…14060000` objects/policies exist; project ref matches intended staging; no confirmed local↔remote delta that blocks a missing-only apply plan |
| Actual result | **RECONCILED FROM OPERATOR EVIDENCE (NOT PASS).** `supabase_migrations.schema_migrations` **absent**. Object/policy facts recorded below. Confirmed mismatch: `…14040000` effects missing (`is_front_desk_fee_registrar` absent; fee policies still use `is_intake_registrar`). Registrar SELECT policy absent (ambiguous: never created vs dropped by `…14060000`). `intake_register_student` + `verify_signup_fee_and_activate` present with expected signatures. R2 confirmed via `front_desk_assign_counsellor` returns `public.students`. ACL lists `authenticated`/`service_role` EXECUTE only — **anon denial not proven**. |
| Evidence location/reference | Operator-supplied staging catalog results in chat (2026-10-14). Repo docs: intended ref `gjasuvlqfofpvrqvvnyz` (host-only). Application migration ledger: **none established** — see A2. Do **not** treat `auth.schema_migrations` or `realtime.schema_migrations` as app ledger. |
| Pass/fail/block | **FAIL (parity incomplete)** — not PASS; not M1 closure. Blocks blind B apply until missing-only plan is re-derived from this inventory + follow-up reads |
| Operator | Authorized human (catalog); agent reconciliation only |
| Timestamp (UTC) | 2026-10-14T02:45Z (reconciliation) |

**Sub-checks:**

| ID | Check | Actual |
| --- | --- | --- |
| A1 | Project host/ref confirmed | **UNVERIFIED in ledger** — operator must still affirm Dashboard ref matches intended staging |
| A2 | `schema_migrations` present? list versions or record `42P01` / missing | **ABSENT** — `supabase_migrations.schema_migrations` not found. `auth.schema_migrations` / `realtime.schema_migrations` exist but are **not** established as the application migration ledger (repo: use object-based verification when app ledger missing — `docs/database/README.md`) |
| A3 | Object presence for FD helpers / `intake_register_student` | **PARTIAL** — `intake_register_student` **present** (expected signature; authz + ownership stamp + narrow return per operator). `is_front_desk_fee_registrar` **absent**. `verify_signup_fee_and_activate` **present**. `front_desk_assign_counsellor` **present** (full-row return = R2). `is_front_desk` / `list_front_desk_intake_summaries` / `is_intake_registrar` — **not stated in this evidence pack** (UNKNOWN) |
| A4 | `students` policies; `students_select_intake_registrar` | **ABSENT** from observed `public.students` policies. Presence of `students_select_access` / `students_select_fee_verifier` — **not enumerated in supplied pack** (UNKNOWN beyond registrar policy absence) |
| A5 | `can_access_student` does not reference `registered_by` | **PASS (observed)** — no `registered_by` in definition |

### Gate A — Migration-by-migration reconciliation (local intent vs observed)

| Local migration | Intended effects (summary) | Observed staging | Application status |
| --- | --- | --- | --- |
| `…14020000` | `registered_by`; create `students_select_intake_registrar`; FD RPCs (`is_front_desk`, list/assign/desks); stamp triggers; staff-field merge | Registrar SELECT **absent**; assign RPC **present** (R2 full-row). Column `registered_by`, other FD helpers, triggers — **not in this evidence pack** | **INDETERMINATE** — effects partially consistent with applied-then-dropped SELECT **or** never-created SELECT + partial apply; **cannot** confirm from ledger alone |
| `…14030000` | `is_intake_registrar`; fee policies use `is_intake_registrar` for registrar arm; `enforce_profile_role_guard` business_role lock | Fee policies **still** reference `is_intake_registrar(student_id)` for registrar access (matches this file’s fee arm). Helper presence implied by policy text | **LIKELY APPLIED** (fee-policy shape matches `…14030000`, not `…14040000`) — still not ledger-proven |
| `…14040000` | Create `is_front_desk_fee_registrar`; rewrite fee policies to use it | Helper **absent**; fee policies still `is_intake_registrar` | **NOT APPLIED** (confirmed mismatch) — local file remains the intended forward fix; do not re-author |
| `…14050000` | `intake_register_student` narrow DEFINER register | Function **exists** with expected signature; defs show authz + ownership stamp + narrow returns | **LIKELY APPLIED** (object present) — not ledger-proven |
| `…14060000` | `drop policy students_select_intake_registrar` | Policy **absent** | **INDETERMINATE** — absence is necessary but not sufficient (could be never created, or dropped by this file, or manual drop) |
| `…14070000` | Ignore caller `p_profile_id`; link profile by email only | **Local only** — not observed on staging | **NOT APPLIED** (authored locally for Phase 3) |

### Confirmed mismatches

1. **`…14040000` not reflected on staging** — missing `is_front_desk_fee_registrar`; fee RLS still on `is_intake_registrar`.
2. **No authoritative application migration history table** — cannot list which version rows exist.

### Unknowns (need more read-only evidence)

- Whether `registered_by` column / stamp trigger / `is_front_desk` / `list_front_desk_intake_summaries` / `is_intake_registrar` exist.
- Full `pg_policy` list for `public.students` (only registrar absence stated).
- Exact policy definitions for `signup_fee_*` to finish `…14030000` vs `…14040000` comparison.
- Anon EXECUTE denial for inspected RPCs (ACL showed `authenticated` + `service_role` only — **do not infer** anon denial).
- Whether `students_select_fee_verifier` remains (R1) — separate from M1.

### Additional read-only evidence to reconcile `…14040000` fee-policy discrepancy

Run on staging (SELECT / catalog only). Record booleans and policy names only:

```sql
select to_regprocedure('public.is_front_desk_fee_registrar(uuid)') is not null
  as has_is_front_desk_fee_registrar;
select to_regprocedure('public.is_intake_registrar(uuid)') is not null
  as has_is_intake_registrar;
select to_regprocedure('public.is_front_desk()') is not null as has_is_front_desk;

-- Prefer: show whether policy body mentions is_front_desk_fee_registrar
select polname, pg_get_expr(polqual, polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
from pg_policy
where polrelid = 'public.signup_fee_payments'::regclass
  and polname in ('signup_fee_select', 'signup_fee_insert', 'signup_fee_update')
order by 1;
```

**Interpretation guide:** If `has_is_front_desk_fee_registrar = false` and USING/WITH CHECK still call `is_intake_registrar` only → continue to treat `…14040000` as **missing**. Do **not** apply until owner authorizes Gate B missing-only list.

### Application migration ledger (repo)

Approved verification when `supabase_migrations.schema_migrations` is missing: **object/policy-based** checks (`docs/database/README.md`, `STAGING-OWNER-VERIFICATION.sql`, Option 6 Step A). No repo doc establishes `auth.schema_migrations` or `realtime.schema_migrations` as the app ledger — **do not use them for apply decisions**.

**Operator SQL pack (read-only — run in Dashboard SQL Editor on intended project):**

```sql
-- A1 context
select current_database() as database_name, current_user as session_user;

-- A2 migration history
select to_regclass('supabase_migrations.schema_migrations') as schema_migrations_regclass;
-- If not null:
-- select version, name from supabase_migrations.schema_migrations
-- where version::text like '20261014%' or name like '%1402%' or name like '%1403%'
--    or name like '%1404%' or name like '%1405%' or name like '%1406%'
-- order by version;

-- A3 objects (Option 6 Step A)
select
  to_regprocedure('public.is_front_desk()') is not null as has_is_front_desk,
  to_regprocedure('public.is_intake_registrar(uuid)') is not null as has_is_intake_registrar,
  to_regprocedure('public.is_front_desk_fee_registrar(uuid)') is not null as has_fd_fee_registrar,
  to_regprocedure('public.list_front_desk_intake_summaries()') is not null as has_list_summaries,
  to_regprocedure('public.front_desk_assign_counsellor(uuid,uuid)') is not null as has_assign,
  to_regprocedure(
    'public.verify_signup_fee_and_activate(uuid,uuid,text,text,boolean)'
  ) is not null as has_verify_signup_fee_and_activate,
  to_regprocedure(
    'public.intake_register_student(text,text,text,text,text,text,text,text,text,uuid,text,inquiry_channel,date,text,uuid)'
  ) is not null as has_intake_register;

-- If has_verify is false, list actual overloads:
select p.oid::regprocedure as verify_candidates
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'verify_signup_fee_and_activate';

-- A4 students SELECT policies
select polname, polcmd
from pg_policy
where polrelid = 'public.students'::regclass
order by 1;

-- Grants (EXECUTE) — names only
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'intake_register_student',
    'front_desk_assign_counsellor',
    'is_front_desk_fee_registrar',
    'verify_signup_fee_and_activate'
  )
order by 1, 2;

-- Fee policies on signup_fee_payments
select polname
from pg_policy
where polrelid = 'public.signup_fee_payments'::regclass
order by 1;

-- A5 can_access_student must not reference registered_by
select pg_get_functiondef('public.can_access_student(uuid)'::regprocedure) as can_access_student_def;
```

Paste redacted boolean/name-only results back; do not include secrets or student PII.

---

## Gate B — Migration application (only after A + explicit approval)

**Security objective:** Apply missing forward migrations in order without skipping.

| Field | Content |
| --- | --- |
| Gate | **B** |
| Required identity | Owner-authorized DDL path (CLI or Dashboard). Not anon key. |
| Synthetic data | None |
| Exact operation | From A’s inventory, apply **missing-only** files in order B1→B5. Skip already-present files. No blind `db push` / full re-paste. See Option 6 Step B. |
| Expected | Each applied or skipped file recorded; **B5** confirms registrar policy absent |
| Actual result | **NOT RUN** |
| Evidence location/reference | _TBD (filenames applied/skipped + times; no passwords)_ |
| Pass/fail/block | **NOT RUN** — blocked until A documented and owner approves apply of the **missing** set |
| Operator | _TBD_ |
| Timestamp (UTC) | _TBD_ |

**Sub-checks:**

| ID | Migration | Actual |
| --- | --- | --- |
| B1 | `20261014020000_front_desk_intake_ownership.sql` | NOT RUN / not confirmed remote |
| B2 | `20261014030000_front_desk_fee_and_business_role_guard.sql` | NOT RUN / not confirmed remote |
| B3 | `20261014040000_signup_fee_fd_registrar_only.sql` | NOT RUN / not confirmed remote |
| B4 | `20261014050000_intake_register_student_rpc.sql` | NOT RUN / not confirmed remote |
| B5 | `20261014060000_drop_students_select_intake_registrar.sql` | NOT RUN / not confirmed remote |

Local repo files are **not** evidence that B passed.

---

## Gate C — Registration RPC (shape, ownership, unauthorized reject)

**Security objective:** `intake_register_student` forces `registered_by = auth.uid()`, returns minimal columns, rejects unauthorized callers.

| Field | Content |
| --- | --- |
| Gate | **C** |
| Required identity | Anon; Student JWT; FD-A JWT |
| Synthetic data | Unique synthetic email/case for C3; reuse for C5 duplicate |
| Exact operation | `POST /rest/v1/rpc/intake_register_student` (or equivalent) per C1–C6 in Option 6 |
| Expected | C1/C2 deny; C3 success with `registered_by` = FD-A; C4 no sensitive columns; C5 duplicate error; C6 no client ownership arg |
| Actual result | **NOT RUN** |
| Evidence location/reference | _TBD (status codes + redacted key lists)_ |
| Pass/fail/block | **NOT RUN** |
| Operator | _TBD_ |
| Timestamp (UTC) | _TBD_ |

| ID | Operation | Expected | Actual |
| --- | --- | --- | --- |
| C1 | Anon RPC | deny (401/403 or equivalent) | NOT RUN |
| C2 | Student RPC | deny (not authorized) | NOT RUN |
| C3 | FD-A valid register | 2xx; `registered_by` = FD-A | NOT RUN |
| C4 | Inspect response keys | no `dob`, `registration_notes`, `portal_activated_at`, `archived_at`, `profile_id`, `last_activity_at` | NOT RUN |
| C5 | Duplicate email | duplicate error | NOT RUN |
| C6 | Ownership spoof attempt | impossible via RPC args / stamp is `auth.uid()` | NOT RUN |

---

## Gate D — Permissive SELECT OR preconditions (required before E)

**Security objective:** Ensure E1 tests the registrar-policy residual, not a surviving OR path.

| Field | Content |
| --- | --- |
| Gate | **D** |
| Required identity | Admin or catalog read to inspect `Stu-Pending-A`; FD-A profile role checks |
| Synthetic data | `Stu-Pending-A` as defined above |
| Exact operation | Confirm D0–D6 for `Stu-Pending-A` / FD-A (methods in Option 6 Step D) |
| Expected | All preconditions true → `fdOwnedRestSelectShouldDeny(...) === true` |
| Actual result | **NOT RUN** |
| Evidence location/reference | _TBD (boolean checklist only; no PII columns)_ |
| Pass/fail/block | **NOT RUN** — **E1 invalid if any of D0–D6 fails** |
| Operator | _TBD_ |
| Timestamp (UTC) | _TBD_ |

| ID | Precondition | Actual |
| --- | --- | --- |
| D0 | Row exists (admin `select id` returns the synthetic id) | NOT RUN |
| D1 | `registered_by` = FD-A | NOT RUN |
| D2 | `assigned_consultant_id` null or ≠ FD-A | NOT RUN |
| D3 | `profile_id` null or ≠ FD-A | NOT RUN |
| D4 | FD-A not admin (`profiles.role` / app_role) | NOT RUN |
| D5 | FD-A not fee verifier (`can_verify_signup_fee()` false as FD-A) | NOT RUN |
| D6 | **B5**: `students_select_intake_registrar` absent | NOT RUN |

---

## Gate E — FD direct REST `select=*` (mandatory M1 closure gate)

**Security objective:** Front Desk registrar cannot read an owned **pending** student row via table REST `select=*` after `…14060000`.

| Field | Content |
| --- | --- |
| Gate | **E** — **M1 mandatory** |
| Required identity | FD-A, FD-B, Anon JWTs |
| Synthetic data | `Stu-Pending-A` (and optionally `Stu-Other-B`) after D PASS |
| Exact operation | `GET /rest/v1/students?select=*&id=eq.<Stu-Pending-A>` etc. |
| Expected | E1: `200`+`[]` **or** explicit deny, **with D preconditions proven**; E2/E3 deny or empty |
| Actual result | **NOT RUN** |
| Evidence location/reference | _TBD_ |
| Pass/fail/block | **NOT RUN** — M1 remains OPEN |
| Operator | _TBD_ |
| Timestamp (UTC) | _TBD_ |

| ID | Actor | Request | Expected | Actual |
| --- | --- | --- | --- | --- |
| **E1** | FD-A | `GET …/students?select=*&id=eq.<Stu-Pending-A>` | No row body / deny; **must not** return `dob` or full row | **NOT RUN** |
| E2 | FD-B | same id as FD-A owned | empty/deny | NOT RUN |
| E3 | Anon | `GET …/students?select=*` | deny | NOT RUN |

**M1 closure:** Only **E1 = PASS** (with D PASS and B5 confirmed) may change overall status from OPEN to closed-on-staging. Record evidence reference before changing the header.

---

## Gate F — Regression: admin, assigned, student-self, officer register

**Security objective:** Dropping registrar SELECT did not break legitimate access.

| Field | Content |
| --- | --- |
| Gate | **F** |
| Required identity | Admin-1, Counsellor-Assigned, Student-Self, Officer-1 |
| Synthetic data | Assigned student for F2; linked student for F3 |
| Exact operation | Per F1–F4 Option 6 |
| Expected | Allow / success as specified |
| Actual result | **NOT RUN** |
| Evidence location/reference | _TBD_ |
| Pass/fail/block | **NOT RUN** |
| Operator | _TBD_ |
| Timestamp (UTC) | _TBD_ |

| ID | Actor | Operation | Expected | Actual |
| --- | --- | --- | --- | --- |
| F1 | Admin-1 | SELECT student(s) | allow | NOT RUN |
| F2 | Counsellor-Assigned | SELECT assigned student | allow | NOT RUN |
| F3 | Student-Self | SELECT own `profile_id` row | allow | NOT RUN |
| F4 | Officer-1 | Register via app/`createStudentRecord` path with `assigned_consultant_id=self` | success + RETURNING | NOT RUN |

---

## Gate G — Child-table access (no `registered_by` leak)

**Security objective:** Ownership does not open applications/documents/offers/notes via `can_access_student`.

| Field | Content |
| --- | --- |
| Gate | **G** |
| Required identity | FD-A JWT |
| Synthetic data | `Stu-Pending-A` id only |
| Exact operation | GET child tables filtered by `student_id=eq.<Stu-Pending-A>` |
| Expected | empty/deny on applications, student_documents, offers, internal_notes |
| Actual result | **NOT RUN** |
| Evidence location/reference | _TBD_ |
| Pass/fail/block | **NOT RUN** |
| Operator | _TBD_ |
| Timestamp (UTC) | _TBD_ |

| ID | Request | Expected | Actual |
| --- | --- | --- | --- |
| G1 | `GET …/applications?student_id=eq.<id>` | empty/deny | NOT RUN |
| G2 | `GET …/student_documents?student_id=eq.<id>` | empty/deny | NOT RUN |
| G3 | `GET …/offers?student_id=eq.<id>` | empty/deny | NOT RUN |
| G4 | `GET …/internal_notes?student_id=eq.<id>` | empty/deny | NOT RUN |

Note: `signup_fee_payments` may allow FD via `is_front_desk_fee_registrar` — **out of M1 scope** (fee arm, not students SELECT).

---

## Separate residual risks (Options 7–8 do **not** fix; stay OPEN if M1 closes)

| ID | Residual | Status |
| --- | --- | --- |
| R1 | `students_select_fee_verifier` — org-wide students SELECT for fee verifiers | **OPEN** — not in M1 closure |
| R2 | `front_desk_assign_counsellor` SECURITY DEFINER returns full `public.students` row | **OPEN** — not in M1 closure |
| R3 | Permissive OR paths: FD still SELECTs if admin, fee-verifier, `assigned_consultant_id=self`, or `profile_id=self` | **OPEN** — mitigated for E by Gate D; not eliminated |

Do not mark R1–R3 PASS when recording E1 PASS.

---

## Rollup

| Gate | Actual (initial) | Blocks |
| --- | --- | --- |
| A Catalog parity | **NOT RUN** | B |
| B Apply migrations | **NOT RUN** | C–G (need objects/policies) |
| C Register RPC | **NOT RUN** | — |
| D OR preconditions | **NOT RUN** | E1 validity |
| **E REST select=*** | **NOT RUN** | **M1 closure** |
| F Regression | **NOT RUN** | release confidence |
| G Child tables | **NOT RUN** | child-leak confidence |

**Explicit M1 status: OPEN**

---

## Precise next action after evidence is returned

1. Authorized operator fills this ledger (or attaches redacted evidence packs) for A→G in order.  
2. If **E1 = PASS** with **D = PASS** and **B5** confirmed → update header M1 status to:  
   `CLOSED on staging (registrar table SELECT residual) — evidence: <ref>`  
3. If E1 FAIL or D invalid → keep M1 **OPEN**; do not apply further product claims; consider rollback only if production-impacting.  
4. File separate tickets for R1/R2; do not start Phase 3 from this ledger alone.

---

## Local Phase 3 app-layer status (not staging evidence)

### Consolidation summary (3A–3D)

App-layer Phase 3A–3D is **integrated locally**: shared `requireModulePermission` + matrix helpers on existing server entry points; no second permission system. Unit suites for matrix/gates/staff/report/HR/marketing/ops/intake pass. **Not production-secure proof** — does not verify RLS/JWT/remote policies.

| Slice | Status | Notes |
| --- | --- | --- |
| 3A matrix + admin persistence | Integrated | `business-permissions` + `portal-permissions` (admin/super_admin write) |
| 3B admissions/documents + local `…14070000` | Integrated | Server gates present; migration **not applied** remotely |
| 3C offers + finance create/claim/list | Integrated | HR/Marketing/Ops kept existing equivalent helpers |
| 3D tasks/reports/activity/officer/data/intake | Integrated | Tasks→`students`; reports/activity→`reports`; desk→`students` (+ admissions for app create) |
| App-side residual (non-critical) | Demo-only | `portal-data` mock CRM via `isMockCrmAllowed` — **`supabase` source never receives mock rows** |
| Phase 3 “fully secure / production-ready” | **No** | App gates ≠ DB evidence |

### Database blockers (separate from app Phase 3)

| Item | Status |
| --- | --- |
| **M1** registrar SELECT residual | **OPEN** (Gates A–G incomplete / not PASS) |
| **R1–R3** | Still tracked separately; not closed by app-layer gates |
| `20261014040000_signup_fee_fd_registrar_only.sql` | **NOT APPLIED** (operator-confirmed) |
| `20261014060000_drop_students_select_intake_registrar.sql` | Application status **indeterminate** |
| `20261014070000_intake_register_student_safe_profile_link.sql` | **Local only** — not observed on staging |

### Phase 4 — Notifications live plane (local)

| Item | Status |
| --- | --- |
| Live `portalGetNotifications` (JWT client + `user_id` + order/limit) | Present locally |
| `portalMarkNotificationRead` (scoped by session user; idempotent already-read) | Present locally |
| Student/admin UI mark-as-read → existing service | Present locally |
| Demo fixtures | Only when `session.source === "demo"` |
| Email / push delivery | Out of scope |
| Remote RLS/JWT proof | **Not claimed** — unit tests only |

### Leads live plane (local, post–Phase 4)

| Item | Status |
| --- | --- |
| `portalGetLeads` → `consultation_requests` (JWT + desk scope) | Present locally |
| Assign lead / update status (JWT + app allow-list + desk rules) | Present locally |
| Demo fixtures | Demo sessions only |
| Remote table/RLS proof | **Not claimed** — RLS `consultation_update_staff` is org-wide for consultants; app enforces desk scope |

### Student CRM lists (local)

| Item | Status |
| --- | --- |
| `portalGetApplications` / `portalGetDocuments` live JWT lists | Present locally |
| Own-student scope + staff visibility (no fixture fallback) | Present locally |
| Remote RLS/JWT proof | **Not claimed** |

### Student self-contact profile update (local)

| Item | Status |
| --- | --- |
| `portalUpdateOwnStudentContact` (JWT + `resolveOwnStudentDb`; allow-list phone/whatsapp/city/dob/destination/program/study_level) | Present locally |
| Relies on existing `students_update_self_contact` + `enforce_student_staff_fields` | No new migration |
| Student `/student/profile` save UI | Present locally |
| Remote RLS/JWT proof | **Not claimed** — unit tests only |

### Student appointment request (local)

| Item | Status |
| --- | --- |
| `portalRequestAppointment` (JWT + `resolveOwnStudentDb`; status forced `requested`; consultant from assigned desk) | Present locally |
| Relies on existing `appointments_access` + `can_access_student` | No new migration / no type column |
| Soft overlap conflict check (app-layer 409) | Present locally |
| Student `/student/appointments` request form | Present locally |
| Remote RLS/JWT proof | **Not claimed** — unit tests only |

M1 / R1–R3 and pending migrations above remain unresolved database findings. Phase 3 is **not** fully secure.
