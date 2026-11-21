# GlobalRoots Engineering Baseline Report

**Date:** 2026-11-22  
**Branch / commit:** `main` @ `cd29db113992e92f45c4926cf836e5078ef18cc4`  
**Working tree:** clean except untracked `ao-mockups.pdf`  
**Runtime:** Node `v22.15.0`, npm `10.9.2`  
**Method:** code inventory + local commands only (no production DB writes, no push/deploy)

---

## 1. Architecture

| Layer       | Stack / location                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell   | TanStack Start (`@tanstack/react-start` 1.168.x) + Vite 8 + React 19                                                                                                      |
| Routing     | TanStack Router; routes under `src/routes/`; generated `src/routeTree.gen.ts`                                                                                             |
| Data / auth | Supabase JS; server fns in `src/server/*`; client façade `src/services/index.ts`                                                                                          |
| RBAC        | Technical `AppRole` + business matrix (`src/lib/business-permissions.ts`); guards in `src/lib/portal-guard.ts`, `src/server/staff-access.ts`, `src/server/portal-auth.ts` |
| UI          | Tailwind 4 + Radix/`src/components/ui/*`; portal chrome `PortalShell.tsx`                                                                                                 |
| Deploy      | `vercel.json` → `framework: "tanstack-start"`                                                                                                                             |
| Env pattern | `.env.example`: `VITE_SUPABASE_*` public; `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` server-only                                                                 |

**Data plane rule (observed):** portal reads/writes go through authorized `createServerFn` handlers; service-role client is confined to `src/server/supabase-admin.ts` with explicit “never VITE_*” comments and unit coverage that rejects `VITE_SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Route / portal inventory

**Route files:** 81 under `src/routes/` (including `__root__`, auth, public marketing, admin/staff/student trees).

### Public / marketing

- `/` home, `/about`, `/services`, `/contact`, `/programs`, `/universities`, `/scholarships`, `/destinations`, `/resources`, `/success-stories`, `/student-visa`, `/blog`, `/blog/$slug`, `/privacy`, `/terms`
- Auth: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/change-password`

### Admin (`requirePortalAccess("admin")` layout)

- Dashboard, students, applications, appointments, documents, finance, banking, leads, consultants, scholarships, universities, programs, notifications, accounts, users-roles, settings, audit-logs, reports, HR, marketing, operations, leaderboard, import-export, website (CMS), blog (+ edit)

### Staff

- Dashboard, front-desk, intake (+ `$studentId`), register, students (+ detail), applications, documents, appointments, offers, tasks, finance, banking, leads, reports, activity, HR, marketing, operations

### Student

- Dashboard, profile, applications, documents, appointments, notifications

### Business modules (matrix columns)

`students`, `counselling`, `admissions`, `documents`, `fees_payments`, `banking_finance`, `hr_attendance`, `digital_marketing`, `orders_sales_purchase`, `reports`, `users_roles`, `settings`

### Business roles (matrix rows)

Front Desk, Counsellor, Admission Team, Student Portal, Accounts/Banking/Finance, HR, Digital Manager, Office Ops, Manager, Admin

---

## 3. Server plane

**~39 modules** under `src/server/`, including (non-exhaustive):

| Domain          | Modules                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth / access   | `portal-auth`, `portal-data` (session), `staff-access`, `portal-permissions`, `permission-matrix-store`, `portal-password`, `supabase`, `supabase-admin` |
| Intake / fees   | `portal-intake`, `portal-finance`, `portal-finance-desk`, `portal-front-desk`                                                                            |
| Officer / apps  | `portal-officer`, `portal-applications`, `portal-documents`, `portal-offers`, `portal-tasks`, `ao-data`                                                  |
| Specialty desks | `portal-hr`, `portal-marketing`, `portal-operations`, `portal-module-reports`, `portal-leaderboard`                                                      |
| CMS / blog      | `portal-cms`, `portal-blog`                                                                                                                              |
| Admin ops       | `portal-accounts`, `portal-settings`, `portal-admin-ops`, `portal-import-export`, `portal-catalog`, `portal-scholarships`                                |
| Cross-cutting   | `portal-activity`, `portal-reports`, `portal-timeline`, `task-automation*`, `document-blob-store`                                                        |

**Services façade:** `src/services/index.ts` re-exports authorized server calls for UI; still imports `src/data/mock` for limited marketing/demo helpers (demo auth is `vite dev` only per `.env.example`).

---

## 4. Database / RLS / Realtime

**Migrations:** 50 SQL files in `supabase/migrations/`.

**Recent (may still need owner apply on target Supabase):**

- `20261108120000_website_cms_foundation.sql`
- `20261108140000_blog_platform_foundation.sql`
- `20261108160000_finance_desk_foundation.sql`

**Historical hardening themes (from migration names + policy/function density):**

- Admission officer foundation + select/mutate/realtime
- Signup fee verify/activate RPCs, FD registrar restrictions, counselling fee verification queue
- Business module permissions + realtime
- Scholarships mutate grant/RLS tighten
- HR / marketing / office ops milestones
- Audit trail + broad RLS hardening (`20261010153000_rls_security_hardening.sql`)

**Types:** `src/types/database.ts` (generated / maintained alongside schema).

**Realtime:** fee verification queue, signup fees, business permissions, admission, finance desk (per recent migrations).

---

## 5. Integrations

| Integration                            | Role                                    |
| -------------------------------------- | --------------------------------------- |
| Supabase Auth + Postgres + Storage     | Primary identity, RLS, documents/media  |
| Vercel                                 | Hosting (TanStack Start)                |
| TipTap + isomorphic-dompurify          | Blog/CMS rich text (sanitize on render) |
| Optional `TASK_AUTOMATION_CRON_SECRET` | External cron for task automation       |

---

## 6. Build / test status (command evidence)

| Command                   | Result                                                                                                                                        | Evidence |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `npm run lint`            | **FAIL** — 6819 problems (6803 errors, 16 warnings); ~6801 autofixable `prettier/prettier` `Delete ␍` (CRLF line endings on Windows checkout) | exit 1   |
| `npx tsc --noEmit`        | **FAIL** — **169** `error TS*` (includes index-signature / CMS / finance-desk style issues)                                                   | exit 2   |
| `npm test` (`vitest run`) | **FAIL** — **114** files passed, **1** failed; **607** tests passed, **1** failed                                                             | exit 1   |
| `npm run build`           | **NOT RUN in Phase 0** (deferred to Phase 5 to avoid long redundant compile during discovery)                                                 | —        |

### Failing unit test (baseline)

`src/lib/permission-matrix-load-rules.test.ts` — demo session with `admission_team` expected to resolve `requireModulePermission`, but `forbidAdmissionMockDataPlane` in `src/server/staff-access.ts` now rejects demo/mock Admission data with 403. **Test stale vs security hardening** (or demo exception needs intentional re-approval).

---

## 7. Design system baseline

- Shared primitives: `src/components/ui/*` (Radix + CVA)
- Portal shell: `src/components/portal/PortalShell.tsx`
- Existing design skills only under `.agents/skills/` — **no** `.cursor/skills/` at baseline start
- Motion: `tw-animate-css` present in deps; reduced-motion policy to be enforced via UI skill in Phase 1+

---

## 8. Known risks / checklist

| Risk                                                           | Severity           | Notes                                                                          |
| -------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| Unapplied CMS / blog / finance-desk migrations on staging/prod | High               | Owner must apply SQL; app code already references tables                       |
| `tsc` 169 errors                                               | Medium             | Blocks “clean static” readiness; many pre-existing + finance-desk index access |
| Lint CRLF flood                                                | Low–Medium         | Environment/checkout; not functional defects but CI-red                        |
| One failing Vitest (admission demo forbid)                     | Medium             | Security intent vs test expectation mismatch                                   |
| Service-role misconfig on host                                 | High if missing    | Account management unavailable; never put in `VITE_*`                          |
| Demo auth                                                      | Low if prod builds | Documented as `vite dev` only                                                  |
| Live E2E / IDOR against production                             | Blocked            | Staging + explicit OK required                                                 |
| `ao-mockups.pdf` untracked                                     | Info               | Not part of app runtime                                                        |

### Secret exposure checklist (static)

- [x] Service role not read from `VITE_*` in `readServiceRoleKey`
- [x] Unit test asserts `VITE_SUPABASE_SERVICE_ROLE_KEY` must not count
- [x] `.env.example` documents server-only keys
- [ ] Confirm Vercel Production env has non-`VITE_*` service key (manual / host)
- [ ] Confirm no secrets committed in `.env` (working tree shows none tracked)

---

## 9. Phase 0 deliverable status

| Item                           | Status                               |
| ------------------------------ | ------------------------------------ |
| Architecture overview          | Done                                 |
| Route/portal inventory         | Done                                 |
| DB/RPC/RLS/Realtime inventory  | Done (migration-level)               |
| Integrations                   | Done                                 |
| Build/test evidence            | Done (lint/tsc/test; build deferred) |
| Known risks                    | Done                                 |
| Broad application code changes | **None** (discovery only)            |

**Next:** Phase 1 — create eight `.cursor/skills/*/SKILL.md` + registry.
