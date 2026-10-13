# Portal visual E2E checklist — Global Roots

**Project:** `gjasuvlqfofpvrqvvnyz`  
**Accounts:** [`STAGING-TEST-ACCOUNTS.md`](./STAGING-TEST-ACCOUNTS.md) · primary admin [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql)  
**Rules:** Mark **PASS** only with observed UI + (where needed) DB evidence. Unrun → `NOT RUN` or `BLOCKED`. Never invent PASS. Demo auth is invalid for staging evidence.

**Prerequisites (currently unmet → many rows BLOCKED):**

1. Primary admin `hussaindurrani92@gmail.com` designated and verified live.  
2. Further desks invited via Admin → Accounts (not the retired three-account placeholder SQL).  
3. Password lifecycle completed for tested personas.  
4. Prefer `STAGING-OWNER-VERIFICATION.sql` green for M1+ before deep CRM tests.

**Status legend:** `PASS` · `FAIL` · `BLOCKED` · `NOT RUN`

---

## Cross-role negatives (run after positives)

| ID | Test | Expected | Status |
|----|------|----------|--------|
| X1 | STU-A opens STU-B student id / docs / apps | Deny / empty / 403 — no PII leak | **BLOCKED** |
| X2 | CON opens student not assigned to CON | Deny / not in list | **BLOCKED** |
| X3 | FD / CON / STU attempt signup fee → `verified` | Deny (RLS / server); status unchanged | **BLOCKED** |
| X4 | ACC (consultant + `accounts_banking_finance`) verify fee | Allow per matrix **after** fee migrations + visibility/RPC wiring; else document actual error | **BLOCKED** |
| X5 | STU-A opens `/staff/dashboard` or `/admin/dashboard` | Redirect to `/student/dashboard` or `/sign-in` | **BLOCKED** |
| X6 | FD opens `/admin/finance` | Redirect away (consultant cannot use admin shell) | **BLOCKED** |
| X7 | Expired / cleared session → protected URL | Redirect `/sign-in` | **BLOCKED** |
| X8 | Invalid password on `/sign-in` | Neutral invalid-credentials message; no demo hint | **BLOCKED** |

---

## STU-A / STU-B — Student portal (`app_role=student`)

**Landing:** `/student/dashboard`  
**Nav:** Dashboard · Appointments · Documents · Applications · Profile · Notifications

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| S1 | Login | Lands student dashboard | **BLOCKED** |
| S2 | Nav modules load | No staff/admin links | **BLOCKED** |
| S3 | Own profile read | Own CRM-linked data after claim | **BLOCKED** |
| S4 | Own doc upload (if configured) | Success or clear storage error | **BLOCKED** |
| S5 | Direct `/staff/students` | Redirect | **BLOCKED** |
| S6 | Empty states | Empty UI — not fabricated rows | **BLOCKED** |
| S7 | Loading / error | Spinner / error, no fake success | **BLOCKED** |
| S8 | Refresh | Session restored; data persists | **BLOCKED** |
| S9 | Sign-out | Session cleared; `/sign-in` | **BLOCKED** |
| S10 | Password reset | Request + inbox complete (needs email) | **BLOCKED** |

---

## FD — Front Desk (`consultant` + `front_desk_student_affairs`)

**Landing:** `/staff/dashboard`  
**Nav:** Dashboard · Students · Appointments · Applications · Documents · Offers · Tasks · Leads · Reports · Activity

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| F1 | Login → staff home | `/staff/dashboard` | **BLOCKED** |
| F2 | Register intake student | Student row; no activation | **BLOCKED** |
| F3 | Record fee claimed | Status `claimed` | **BLOCKED** |
| F4 | Attempt verify / activate | Denied | **BLOCKED** |
| F5 | Direct `/admin/*` | Redirect to staff home | **BLOCKED** |
| F6 | Refresh after intake | Student still listed (if assigned/visible) | **BLOCKED** |
| F7 | Sign-out / reset | As password lifecycle | **BLOCKED** |

---

## CON — Counsellor (`consultant` + `counsellor_consultant`)

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| C1 | Login | Staff dashboard | **BLOCKED** |
| C2 | Assigned student only | Visible in directory / workspace | **BLOCKED** |
| C3 | Assessment + consent | Persists after refresh | **BLOCKED** |
| C4 | Admission handover | `submitted`; stage error if partial | **BLOCKED** |
| C5 | Unassigned student URL | Deny | **BLOCKED** |
| C6 | Fee verify | Deny | **BLOCKED** |

---

## AO — Admission Team (`consultant` + `admission_team`)

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| A1 | Login | Staff dashboard | **BLOCKED** |
| A2 | Accept / return handover | Status updates persist | **BLOCKED** |
| A3 | Documents review | Approve/reject/needs_correction + audit | **BLOCKED** |
| A4 | Applications / offers | Stages persist after refresh | **BLOCKED** |
| A5 | Fee verify | Deny | **BLOCKED** |
| A6 | `/admin/hr` direct | Redirect (not admin shell) | **BLOCKED** |

---

## ACC — Accounts (`consultant` + `accounts_banking_finance`)

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| Q1 | Login | `/staff/dashboard` (not `/admin` unless ADM dual account) | **BLOCKED** |
| Q2 | Fee verify via authorized UI/API | Per fee review; may be BLOCKED by visibility until wire-up | **BLOCKED** |
| Q3 | `/admin/finance` as consultant | Redirect — use ADM for visual finance page | **BLOCKED** |
| Q4 | HR / marketing mutate | Deny | **BLOCKED** |

---

## ADM — Admin (`admin` + `admin`)

**Landing:** `/admin/dashboard`  
**Nav:** Dashboard · Leads · Students · Appointments · Finance · HR · Marketing · Office Ops · Applications · Documents · Universities · Programs · Scholarships · Consultants · Leaderboard · Reports · Import/Export · Notifications · …

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| D1 | Login | `/admin/dashboard` | **BLOCKED** |
| D2 | Finance / HR / Marketing / Ops pages | Load; empty or real rows — no fabricated metrics | **BLOCKED** |
| D3 | Fee verify | Allowed | **BLOCKED** |
| D4 | Reports | Counts or explicit N/A | **BLOCKED** |
| D5 | Direct `/student/dashboard` | Redirect to admin home | **BLOCKED** |
| D6 | Refresh | Session + data persist | **BLOCKED** |
| D7 | Sign-out / password reset | Lifecycle | **BLOCKED** |
| D8 | Super-admin-only action (if any) | Fail for plain admin | **BLOCKED** |

---

## HR / MKT / OPS — least-privilege API vs visual

Use consultant + `hr_system` / `digital_manager` / `office_ops` for **API/RLS** checks. Use **ADM** for **visual** `/admin/hr|marketing|operations`.

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| H1 | HR consultant JWT — create employee (M3) | Allow if module auth OK | **BLOCKED** |
| H2 | HR consultant — open `/admin/hr` | Redirect | **BLOCKED** |
| H3 | MKT consultant — campaign create | Allow when M3 marketing live | **BLOCKED** |
| H4 | OPS consultant — supplier/PO | Allow when M4 live | **BLOCKED** |
| H5 | ADM visual smoke of three admin modules | Pages render; no mock success | **BLOCKED** |
| H6 | Cross-deny: HR cannot fee-verify; MKT cannot mutate HR | Deny | **BLOCKED** |

---

## SADM / MGR (optional)

| ID | Check | Expected | Status |
|----|-------|----------|--------|
| P1 | Super admin login | Admin shell | **BLOCKED** |
| P2 | Manager fee verify / broad modules | Per `business_role=manager` | **BLOCKED** |

---

## Per-role UX states (apply to each portal)

When executing a role section, also tick:

| State | What to observe | Status |
|-------|-----------------|--------|
| Empty | Zero rows → empty copy, not fake students | |
| Loading | Brief loading indicator on fetch | |
| Success | Toast/UI confirms; DB/UI agree after refresh | |
| Error | Network/RLS failure → error message; no silent mock | |

---

## Password lifecycle (all account types)

| Role set | Initial set | Sign-in | Refresh | Sign-out | Reset request | Reset complete | Status |
|----------|-------------|---------|---------|----------|---------------|----------------|--------|
| Student | | | | | | | **BLOCKED** |
| Staff (FD/CON/AO/ACC) | | | | | | | **BLOCKED** |
| Admin | | | | | | | **BLOCKED** |

---

## Evidence log (private)

Attach redacted screenshots / timestamps outside git. Columns: Checklist ID · Account · Observed result · Evidence ref · Tester · Date

---

## Blockers requiring owner action

1. Designate primary admin via [`DESIGNATE-PRIMARY-ADMIN.sql`](./DESIGNATE-PRIMARY-ADMIN.sql); invite others via Admin → Accounts.  
2. Configure Auth email templates + redirect URLs for staging origin.  
3. Set `SUPABASE_SERVICE_ROLE_KEY` on the server host.  
4. Complete password reset with a controlled inbox.  
5. Run owner SQL verification before treating CRM/module rows as available.  
6. Approve fee migrations / RPC wiring before claiming Accounts verify PASS.  

**Engineering status:** Checklist authored; **zero live visual rows marked PASS**.
