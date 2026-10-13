# Staging E2E test matrix — Global Roots

**Project:** `gjasuvlqfofpvrqvvnyz`  
**Environment:** Staging / disposable Auth users only — never production customer data  
**Rules:** Mark **PASS** only with observed UI + DB evidence. Unexecuted → `NOT RUN` or `BLOCKED`. Never invent PASS.

**Prerequisites (all currently unmet → sequences BLOCKED):**

1. Owner completes [`STAGING-OWNER-VERIFICATION.sql`](./STAGING-OWNER-VERIFICATION.sql) with redacted results  
2. M1–M4 (and approved fee migrations) classified Confirmed where required  
3. Disposable accounts created per [`CLIENT-ACCEPTANCE-CHECKLIST.md`](./CLIENT-ACCEPTANCE-CHECKLIST.md) matrix  
4. Staging app pointed at this Supabase project; demo auth off (`PROD` / no demo session)

**Evidence columns:** paste redacted screenshot IDs / SQL boolean rows into your private run sheet — do not commit credentials or PII.

---

## Account prerequisites

| ID | Role | business_role | Created? | Notes |
|----|------|---------------|----------|-------|
| U-FD | Front Desk | `front_desk_student_affairs` | | |
| U-STU-A | Student A | student | | Unique test email |
| U-STU-B | Student B | student | | Cross-student deny |
| U-COUN | Counsellor | `counsellor_consultant` | | Linked `consultants` row |
| U-AO | Admission | `admission_team` | | |
| U-ACC | Accounts | `accounts_banking_finance` | | |
| U-HR | HR | `hr_system` | | |
| U-MKT | Marketing | `digital_manager` | | |
| U-OPS | Office Ops | `office_ops` | | |
| U-ADM | Admin | `admin` | | |

---

## Matrix

| ID | Area | Prerequisites | Steps (summary) | Expected | Actual | Evidence | Status |
|----|------|---------------|-----------------|----------|--------|----------|--------|
| E1 | Student Auth lifecycle | U-STU-A; email confirm configured | Register → confirm → login → refresh → logout → password reset | Session restores; reset email delivered or configured failure visible | | | **BLOCKED** |
| E2 | Front Desk intake + fee | U-FD; M1 verified | Create student → record fee claimed | Student row; fee `claimed`; `portal_activated_at` null | | | **BLOCKED** |
| E3 | Accounts verify + activate | U-ACC; E2; prefer `…13010000`+RPC after approve | Verify fee → activation consistent | Fee `verified`; activation set or explicit partial error (never silent success) | | | **BLOCKED** |
| E4 | Consultant assign → assessment → consent → handover | U-COUN; E3; U-FD assign | Assign → assessment → consent → handover submit | Handover `submitted`; journey advances or partial error surfaced | | | **BLOCKED** |
| E5 | AO accept + docs/apps/offers | U-AO; E4; storage bucket | Accept handover → doc review → application → offer | Rows persist after refresh | | | **BLOCKED** |
| E6 | Finance / HR / Marketing / Ops / Reports | U-ACC/U-HR/U-MKT/U-OPS/U-ADM; M2–M4 | Create one real row each; open reports | Live rows; N/A where blocked; no fabricated metrics | | | **BLOCKED** |
| E7 | Own vs other student | U-STU-A, U-STU-B | A reads own; A attempts B id in UI/API | Own OK; other denied empty/403 | | | **BLOCKED** |
| E8 | Role allow/deny + direct RLS | All roles; PostgREST with user JWT | Positive action for role; negative privileged action | Allow/deny matches matrix | | | **BLOCKED** |
| E9 | Storage auth | U-STU-A, U-AO; `student-documents` | Upload own; attempt other path; staff download allowed | Own OK; cross-student denied | | | **BLOCKED** |
| E10 | Errors / duplicates / session / partial | Staging; interrupt network mid-verify | Duplicate intake; expired JWT; mid-flight failure | Clear errors; no fake success; fee/activation consistent with DB | | | **BLOCKED** |

---

## Per-test detail sheets (fill when executing)

### E1 — Student Auth
- **Prerequisites:** Disposable mailbox; Auth email templates enabled  
- **Steps:** Sign-up → confirm link → sign-in → hard refresh → sign-out → forgot-password  
- **Expected:** Profile/student linkage per claim rules; no demo session  
- **Actual:** _(empty)_  
- **Evidence:** _(empty)_  
- **Status:** BLOCKED — no disposable student account observed in this engineering pass  

### E2 — Front Desk intake
- **Prerequisites:** U-FD; `can_record_intake` true remotely  
- **Steps:** Portal intake create → fee claim  
- **Expected:** DB rows; student not activated  
- **Status:** BLOCKED  

### E3 — Accounts verify / activate
- **Prerequisites:** E2; Accounts JWT; note whether RPC applied  
- **Steps:** Verify in UI; query fee status + `portal_activated_at`  
- **Expected:** Both consistent OR operator-visible partial failure  
- **Status:** BLOCKED  

### E4 — Counsellor path
- **Prerequisites:** Assigned consultant desk row  
- **Steps:** Assessment → counselling agreement consented → handover  
- **Expected:** Preconditions enforced; stage error if student update fails  
- **Status:** BLOCKED  

### E5 — Admission Officer
- **Prerequisites:** Submitted handover  
- **Steps:** Accept → document → application stage → offer  
- **Expected:** Persist after refresh; unauthorized roles denied  
- **Status:** BLOCKED  

### E6 — Module desks + reports
- **Prerequisites:** M2–M4 confirmed  
- **Steps:** One mutate + one report section per module  
- **Expected:** Real counts or explicit N/A  
- **Status:** BLOCKED  

### E7 — Cross-student
- **Prerequisites:** Two students with data  
- **Steps:** Swap IDs in URL/API  
- **Expected:** Deny  
- **Status:** BLOCKED  

### E8 — Role matrix negatives
- **Prerequisites:** Checklist §B negative tests  
- **Steps:** Front Desk verify fee; Student update other; Marketing mutate HR; etc.  
- **Expected:** 403 / RLS deny  
- **Status:** BLOCKED  

### E9 — Storage
- **Prerequisites:** S8 bucket verified  
- **Steps:** Upload/download allow/deny  
- **Expected:** Path-scoped authorization  
- **Status:** BLOCKED  

### E10 — Resilience
- **Prerequisites:** Staging only  
- **Steps:** Double-submit fee verify; expire session; abort activation  
- **Expected:** No silent fabricated success  
- **Status:** BLOCKED  

---

## Cross-links
- Acceptance UI checklist: [`CLIENT-ACCEPTANCE-CHECKLIST.md`](./CLIENT-ACCEPTANCE-CHECKLIST.md)  
- Owner SQL: [`STAGING-OWNER-VERIFICATION.sql`](./STAGING-OWNER-VERIFICATION.sql)  
- Fee migration review: [`SIGNUP-FEE-SECURITY-REVIEW.md`](./SIGNUP-FEE-SECURITY-REVIEW.md)  
- Results rollup: [`../E2E_TEST_REPORT.md`](../E2E_TEST_REPORT.md)  
