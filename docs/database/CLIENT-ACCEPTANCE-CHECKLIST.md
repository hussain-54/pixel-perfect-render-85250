# Client Acceptance Checklist — Live Authorized Tests

**Project:** `gjasuvlqfofpvrqvvnyz`  
**Prerequisite:** Owner completes [`M1-M4-OWNER-RUNBOOK.md`](./M1-M4-OWNER-RUNBOOK.md) and records verification passes.  
**Rules:** Use **separate disposable test accounts** only. Do **not** use production customer records. Do **not** mark a step Pass without observing the UI/API result in that session. Leave blank if not run.

**Pass criteria:** Expected behavior observed under the named role’s Auth session.  
**Fail criteria:** Wrong data visible, unauthorized mutation succeeds, claimed treated as verified, or RLS/server returns success when it must deny.

---

## Test account matrix (create before testing)

| Role label | Suggested `app_role` / portal | Suggested `profiles.business_role` | Notes |
|------------|-------------------------------|------------------------------------|-------|
| Front Desk | consultant or staff path | `front_desk_student_affairs` | Intake registration |
| Student | student | `student_portal` (or null + student app_role) | Own record only |
| Counsellor | consultant | `counsellor_consultant` | Assigned caseload |
| Admission Team | consultant | `admission_team` | Docs / apps / offers |
| Accounts/Finance | consultant | `accounts_banking_finance` | Fee verify; not ops mutate |
| HR | consultant | `hr_system` | Employees / attendance / leave |
| Digital Marketing | consultant | `digital_manager` | Campaigns / attribution |
| Office Operations | consultant | `office_ops` | Suppliers / PO / stock / ops sales |
| Admin | admin | `admin` or null | Full matrix; ≠ Super Admin rehire |
| Super Admin | super_admin | `admin` matrix mapping | Rehire terminated; reopen completed campaigns |

Record Auth user emails (test-only) in your private run sheet — **do not** commit credentials to the repo.

---

## A. Positive workflow tests

### A1 Front Desk — registration / intake

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A1.1 | Register a new CRM student (unique test email) | Student row created; no portal activation yet | |
| A1.2 | Record signup fee as **claimed** | Status `claimed`; student still not activated | |
| A1.3 | Attempt activation while claimed | Denied / `portal_activated_at` remains null | |

### A2 Accounts — fee verification & activation

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A2.1 | Verify signup fee for test student | Status `verified` | |
| A2.2 | Front Desk / system activates portal | `portal_activated_at` set | |
| A2.3 | Create university fee obligation (tuition vs application_fee vs offer_deposit) | Distinct `kind`; status `due`/`claimed` ≠ verified until verified | |
| A2.4 | Claim then verify university fee | Claimed stays claimed until verify action; verified only after Accounts/authorized verify | |

### A3 Student — claim, consent, own data

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A3.1 | Sign up / sign in with matching email | `claim_own_student_record` links `profile_id` when eligible | |
| A3.2 | Open student dashboard / profile | Sees **own** data only | |
| A3.3 | Upload own document (if enabled) | Own docs only | |

### A4 Counsellor — counselling & assessment

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A4.1 | Open assigned student | Visible if in caseload | |
| A4.2 | Record counselling agreement / consent | Agreement row; consented flag as designed | |
| A4.3 | Save assessment / notes | Persisted; no invented stages | |

### A5 Counsellor → Admission — handover

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A5.1 | Submit admission handover | Status `submitted` | |
| A5.2 | Admission accepts / returns | Status updates; checklist preserved | |

### A6 Admission Team — documents, applications, offers, visa

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A6.1 | Review pending document | Approve/reject/needs_correction with audit | |
| A6.2 | Create / advance application stage | Stage history consistent | |
| A6.3 | Record offer; student accept path | Offer statuses distinct | |
| A6.4 | Visa milestone progress | Decision/stage from persisted rows | |
| A6.5 | Student timeline / journey stage | Advances only via workflow rules (no silent overwrite) | |

### A7 HR

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A7.1 | Create employee | Active employee | |
| A7.2 | Record attendance | Unique per employee/date | |
| A7.3 | Correct attendance with reason | Correction history row | |
| A7.4 | Submit leave; approve/reject as HR | Status transitions enforced | |

### A8 Digital Marketing

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A8.1 | Create campaign | Draft/active as chosen | |
| A8.2 | Attribute inquiry to campaign | No duplicate student CRM row | |
| A8.3 | Re-attribute with different source | History row; `original_attribution_source` preserved | |
| A8.4 | Archive campaign | Archived; cannot attribute to archived | |
| A8.5 | Reports marketing conversion | Count or **N/A** if student emails blocked — never invent ROI | |

### A9 Office Operations

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A9.1 | Create supplier + inventory SKU | Catalog only; qty 0 until receive | |
| A9.2 | Draft → submit → approve PO | Invalid jumps rejected | |
| A9.3 | Receive partial qty | Stock movement + on-hand; PO partially_received | |
| A9.4 | Record ops sale | Not linked as student tuition | |
| A9.5 | Record expense as submitted/reviewed | **Not** a verified bank payment | |

### A10 Admin / Super Admin / Reports

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| A10.1 | Admin ops dashboard aggregates | Counts from live tables; finance/docs gated | |
| A10.2 | `/admin/reports` with date filters | Sections match role; zero ≠ N/A | |
| A10.3 | Export CSV containing `=CMD()` style cell | Prefixed with `'` (formula-safe) | |
| A10.4 | Super Admin rehire terminated employee | Allowed | |
| A10.5 | Admin attempt same rehire | Denied | |
| A10.6 | Super Admin reopen completed campaign → active | Allowed; Admin denied | |

---

## B. Negative / security tests (must Fail open / Deny)

| # | Actor | Attempt | Expected |
|---|-------|---------|----------|
| B1 | Student A | Open Student B profile / documents by ID | 403 / empty / not found |
| B2 | Counsellor (unassigned) | Mutate another counsellor’s student | Denied |
| B3 | Front Desk / Counsellor | **Verify** signup or university fee | Denied (Accounts/authorized only) |
| B4 | Accounts | Mutate ops inventory / approve PO / receive stock | Denied (Office Ops mutate) |
| B5 | Office Ops | Verify signup/university student fees as payment | Denied / wrong module |
| B6 | Digital Marketing (no HR) | List/mutate `hr_employees` via UI | Denied / unavailable |
| B7 | HR | Attribute marketing campaigns / ops purchase | Denied |
| B8 | Any non–Super Admin | Rehire `terminated` → `active` | Denied |
| B9 | Accounts | Treat expense `reviewed` as verified tuition payment in Finance | Must remain separate concepts |
| B10 | Unauthenticated / wrong project | Call server report export | Auth failure |

Record Pass only when the **deny** is observed.

---

## C. Reports behavior checklist (code + live)

Live columns require remote schema + Auth. Code-level expectations are enforced by unit tests (`report-rules`, marketing conversion).

| # | Behavior | Code verified? | Live observed? |
|---|----------|----------------|----------------|
| C1 | Unavailable metrics display **N/A**, not `0` | Unit tests | |
| C2 | Date range filters exclude out-of-window rows | Unit tests | |
| C3 | Section access: Finance / HR / Marketing / Ops gated by business role | Unit tests + server sectionAccess | |
| C4 | Accounts does **not** get Office Ops report section | Unit tests | |
| C5 | Employee summaries restricted | Unit tests | |
| C6 | Signup `claimed` counted separately from `verified` | Unit tests | |
| C7 | University fee kinds kept distinct | Unit tests | |
| C8 | CSV formula injection sanitization (`=`, `+`, `-`, `@`) | Unit tests + `escapeCsvCell` | |
| C9 | Marketing conversion **N/A** when student email query blocked | Server returns null → N/A | |
| C10 | Export requires reports portal authorization | Server `canExportReports` | |

---

## D. Sign-off (client / owner)

| Item | Status |
|------|--------|
| Migration runbook completed for `gjasuvlqfofpvrqvvnyz` | ☐ |
| Verification SQL results archived (redacted) | ☐ |
| Positive tests A1–A10 executed with test accounts | ☐ |
| Negative tests B1–B10 executed | ☐ |
| Reports C1–C10 live spot-check | ☐ |
| No production customer data used | ☐ |
| Known blockers listed below | ☐ |

**Known blockers / deferrals:**

1. _______________________________________________
2. _______________________________________________

**Owner signature / date:** ______________________
