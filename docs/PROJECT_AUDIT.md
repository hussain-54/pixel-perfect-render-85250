# Global Roots — Project Audit

**Repository:** `https://github.com/hussain-54/pixel-perfect-render-85250`  
**Audit date:** 2026-10-13 (staging-prep pass)  
**Supabase project:** `gjasuvlqfofpvrqvvnyz`  
**Release verdict:** **BLOCKED** — awaiting owner SQL verification + authenticated staging E2E

Status legend: `WORKING` · `PARTIAL` · `BROKEN` · `MOCKED` · `NOT IMPLEMENTED` · `BLOCKED`

---

## 1. Architecture (preserved)

TanStack Start + React + TanStack Router + Tailwind. Portals under `/student`, `/staff`, `/admin`. Server functions use Bearer JWT Supabase clients (`requireAoSupabaseClient`).

---

## 2. Feature matrix (summary)

| Feature | Status | Live evidence |
|---------|--------|---------------|
| Public marketing site | WORKING | N/A (static) |
| Demo auth in production | WORKING (disabled) | Unit tests |
| Sign-in / portals / M1–M4 modules | PARTIAL | Anon REST: some tables exist; Auth E2E **BLOCKED** |
| Signup fee verify / activate | PARTIAL | App partial-failure messaging; RPC authored, **not applied/wired** |
| Password reset / storage | PARTIAL | Unverified remotely |

Full historical detail retained in prior audit sections; this pass focused on staging verification blockers.

---

## 3. Code fixes already in working tree (not re-audited)

- Prod demo-auth hard-off; JWT-scoped role resolution; fee update by id+student_id  
- Partial-write errors for fee activation + counselling/handover journey stage  
- Migrations authored: `…13010000` (RLS/trigger), `…13020000` (atomic RPC + trigger narrow)

---

## 4. Signup-fee migration review (deep pass)

See [`docs/database/SIGNUP-FEE-SECURITY-REVIEW.md`](./database/SIGNUP-FEE-SECURITY-REVIEW.md) (Critical→Low).

| Migration | Apply? | Key finding |
|-----------|--------|-------------|
| `…13010000` | **Safe after M1** (post-correction); owner approval | Verifier path without assignment; guard blocks terminal status, `student_id`, forged `verified_*` |
| `…13020000` | **Safe after `…13010000`** (post-correction); owner approval; **do not wire** | SECURITY DEFINER RPC; jsonb allowlist; Accounts student SELECT (privilege accept) |

**Critical (corrected in SQL):** drafts that required `can_access_student` for Accounts verify conflicted with org-wide finance.  
**High (app, unwired):** `assertStudentVisibleDb` still assignment-scopes consultants — fix when wiring RPC.

---

## 5. Remote status

| Source | Result |
|--------|--------|
| Anon REST probe | Partial table presence — [`REMOTE-STATUS-PROBE-2026-10-13.md`](./database/REMOTE-STATUS-PROBE-2026-10-13.md) |
| Dashboard SQL / policies / history | **Not returned by owner** → Unknown for RLS completeness |
| Owner gate script | [`STAGING-OWNER-VERIFICATION.sql`](./database/STAGING-OWNER-VERIFICATION.sql) — **NOT RUN** |

Do not treat table existence as “migration verified.”

---

## 6. Staging E2E / accounts / admin invite

| Doc / feature | Status |
|---------------|--------|
| Primary admin SQL [`DESIGNATE-PRIMARY-ADMIN.sql`](./testing/DESIGNATE-PRIMARY-ADMIN.sql) | Authored — **live verify required** for `hussaindurrani92@gmail.com` |
| Admin → Accounts (`/admin/accounts`) | Implemented in code — needs service-role env + live admin session |
| Three-account placeholder SQL | **Retired** |
| [`docs/testing/STAGING-TEST-ACCOUNTS.md`](./testing/STAGING-TEST-ACCOUNTS.md) | Updated to primary-admin + Accounts flow |
| [`docs/testing/PORTAL-VISUAL-E2E-CHECKLIST.md`](./testing/PORTAL-VISUAL-E2E-CHECKLIST.md) | Authored — all rows **BLOCKED** |
| [`docs/database/STAGING-E2E-TEST-MATRIX.md`](./database/STAGING-E2E-TEST-MATRIX.md) | E1–E10 **BLOCKED** |
| [`docs/database/CLIENT-ACCEPTANCE-CHECKLIST.md`](./database/CLIENT-ACCEPTANCE-CHECKLIST.md) | Unexecuted |

**Role mapping (exact):** `app_role` = `student`\|`consultant`\|`admin`\|`super_admin`; `business_role` = ten M1 enum values. Specialized desks require explicit `profiles.business_role`. Finance/HR/Marketing/Ops **pages** need admin shell; least-privilege API uses `consultant` + business_role. Accounts UI never assigns `super_admin`.

---

## 7. Automated checks (code-level only)

See `E2E_TEST_REPORT.md` § command results. Code pass ≠ staging acceptance.

---

## 8. Explicit blockers

1. Owner must run `STAGING-OWNER-VERIFICATION.sql` on `gjasuvlqfofpvrqvvnyz` and return redacted results.  
2. Owner must run `DESIGNATE-PRIMARY-ADMIN.sql` and confirm `hussaindurrani92@gmail.com` is `admin`/`admin` live.  
3. Owner must set `SUPABASE_SERVICE_ROLE_KEY` on the server host (never frontend).  
4. Approve/apply `…13010000` then `…13020000` only after S2/S5 pass.  
5. Invite remaining desks via Admin → Accounts; execute staging matrix E1–E10.  
6. Do not wire fee RPC or claim staging ready until remote objects + E3 evidence exist.  

**Verdict remains BLOCKED.**
