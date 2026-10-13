# Global Roots — End-to-End Verification Report

**Date:** 2026-10-13 (staging-prep pass)  
**Repo:** `https://github.com/hussain-54/pixel-perfect-render-85250`  
**Supabase ref:** `gjasuvlqfofpvrqvvnyz`  
**Verdict:** **BLOCKED** for staging acceptance / production go-live

---

## 1. Summary

| Area | Result |
|------|--------|
| Owner verification SQL (consolidated) | **Authored** — `docs/database/STAGING-OWNER-VERIFICATION.sql` — **NOT RUN** remotely |
| Signup-fee security review | **Deep review + SQL corrections** — `SIGNUP-FEE-SECURITY-REVIEW.md`; migrations **not applied**; RPC **not wired** |
| Signup-fee authz unit mirrors | **Pass** — `signup-fee-security-rules.test.ts` (intent only; ≠ live RLS) |
| Staging E2E matrix E1–E10 | **BLOCKED** — `STAGING-E2E-TEST-MATRIX.md` |
| Primary admin + Accounts UI | **Code ready** — `DESIGNATE-PRIMARY-ADMIN.sql` + `/admin/accounts`; **live verify pending** |
| Staging test accounts + visual checklist | **Updated** — primary-admin flow; three-account SQL **retired**; remote provision **not** claimed |
| Client acceptance checklist | Unexecuted (prerequisites unmet) |
| Code checks (tsc / vitest / eslint / build) | See §6 |
| Live Auth / browser evidence | **None observed** |

---

## 2. Code vs live

| Feature | Code | Live |
|---------|------|------|
| Demo auth off in PROD | WORKING | Unit only |
| JWT role resolution | WORKING | Unverified under RLS |
| Fee verify targeting + partial-failure UX | WORKING | Unverified |
| Atomic fee RPC | Authored SQL only | Missing remotely; app **not wired** |
| Admin employee invite (Accounts) | Implemented | **BLOCKED** until service-role + primary admin live |
| Cross-portal workflows | Implemented | **BLOCKED** |

---

## 3. Migrations

| File | Remote | Notes |
|------|--------|-------|
| Foundation + M1–M4 | Partially evidenced (tables) / policies Unknown | Confirm via STAGING-OWNER-VERIFICATION S1–S4 |
| `20261013010000_signup_fee_update_restrict.sql` | **Missing / Unknown** | Safe after M1; owner approval |
| `20261013020000_signup_fee_verify_activate_rpc.sql` | **Missing** | SECURITY DEFINER + trigger narrow; owner approval; **do not wire yet** |

---

## 4. Staging E2E matrix status

Source of truth: `docs/database/STAGING-E2E-TEST-MATRIX.md`

| ID | Status |
|----|--------|
| E1 Student Auth lifecycle | **BLOCKED** |
| E2 Front Desk intake + fee | **BLOCKED** |
| E3 Accounts verify + activate | **BLOCKED** |
| E4 Consultant → handover | **BLOCKED** |
| E5 AO docs/apps/offers | **BLOCKED** |
| E6 Finance/HR/Marketing/Ops/Reports | **BLOCKED** |
| E7 Own vs other student | **BLOCKED** |
| E8 Role allow/deny + RLS | **BLOCKED** |
| E9 Storage | **BLOCKED** |
| E10 Duplicates / session / partial | **BLOCKED** |

No row marked PASS.

---

## 5. Owner actions (ordered)

1. Confirm Dashboard project ref `gjasuvlqfofpvrqvvnyz`.  
2. Ensure Auth user `hussaindurrani92@gmail.com` exists; run `DESIGNATE-PRIMARY-ADMIN.sql`; verify role live.  
3. Set `SUPABASE_SERVICE_ROLE_KEY` on the server host (never `VITE_*`).  
4. Run `STAGING-OWNER-VERIFICATION.sql` sections S0–S9; return redacted booleans/policy names.  
5. If M1 gaps: apply per `M1-M4-OWNER-RUNBOOK.md` (owner-controlled).  
6. Approve apply `…13010000` → re-check S7.  
7. Approve apply `…13020000` → re-check S5 (`has_verify_signup_fee_and_activate`).  
8. Invite desks via Admin → Accounts; execute staging matrix + `CLIENT-ACCEPTANCE-CHECKLIST.md`.  
9. Only after remote RPC confirmed: engineering wires `portalVerifySignupFee` (separate change).

---

## 6. Automated command results

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | **Pass** (exit 0) |
| `npx vitest run` | **Pass** — 23 files, **144** tests |
| Targeted ESLint (portal-accounts, accounts UI, account-provisioning) | **Pass** after `--fix` |
| `npm run build` | **Re-run locally** — agent shell did not refresh `.output` artifacts; do not treat as verified |

Full-repo `npm run lint` previously: exit 1 from ~3252 `prettier/prettier` CRLF findings only — not treated as functional defects.

---

## 7. Files changed / added (staging-prep deliverables)

| Path | Purpose |
|------|---------|
| `docs/testing/DESIGNATE-PRIMARY-ADMIN.sql` | Primary admin designation |
| `src/server/supabase-admin.ts`, `src/server/portal-accounts.ts` | Service-role Auth Admin + account APIs |
| `src/lib/account-provisioning.ts` | Business ↔ app role map (no super_admin) |
| `src/routes/admin/accounts.tsx` | Admin Accounts UI |
| `docs/testing/STAGING-MAP-AUTH-USERS-BY-EMAIL.sql` | Marked **OBSOLETE** |
| `docs/database/STAGING-OWNER-VERIFICATION.sql` | Read-only owner gate SQL |
| `docs/database/SIGNUP-FEE-SECURITY-REVIEW.md` | Migration risk review |
| `supabase/migrations/20261013020000_…sql` | Hardened RPC + trigger (unapplied) |
| `docs/PROJECT_AUDIT.md`, `docs/E2E_TEST_REPORT.md`, `docs/database/README.md` | Status updates |

Prior uncommitted remediation (demo-auth, portal-auth, portal-intake, `…13010000`, etc.) remains in the working tree.

---

## 8. Release verdict

### **BLOCKED**

Staging acceptance requires owner SQL evidence and disposable-account browser/DB runs. Code-level tests alone are insufficient.
