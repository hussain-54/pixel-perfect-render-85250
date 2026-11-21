# GlobalRoots Full Application Audit

**Date:** 2026-11-22  
**Baseline:** `docs/engineering/00-baseline-report.md` (`main` @ `cd29db1`)  
**Skills applied:** all eight under `.cursor/skills/` (architecture, security, UI/UX, workflow, finance, CMS, QA, release)  
**Method:** code-only + Vitest evidence; **no** live Supabase E2E; **no** production access  
**Statuses:** PASS / NEEDS REVIEW / BLOCKED / NOT TESTED (FIXED reserved for post-implementation)

---

## Executive summary

Server-side authz, service-role isolation, student self-scope, signup-fee SoD, CMS/blog publish boundaries, and banking-vs-fees separation are generally **PASS** on static review. Highest actionable gaps: stale admission-demo unit test (**BLOCKED** CI), unsigned portal cookie used by route guards (**NEEDS REVIEW**), university-fee verify transition gaps (**NEEDS REVIEW**), unapplied CMS/blog/finance-desk migrations (**NOT TESTED** on target DB), project-wide `tsc` (169) and CRLF lint flood.

---

## 1. Public site

| Area                                   | Status       | Evidence                                                             |
| -------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Home / about / services / contact      | PASS         | `src/routes/index.tsx`, `about.tsx`, `services.tsx`, `contact.tsx`   |
| Scholarships / universities / programs | PASS         | matching routes + public catalog rules                               |
| Blog list + slug                       | PASS         | `blog.tsx`, `blog_.$slug.tsx`; published RPCs                        |
| Auth pages                             | PASS         | sign-in/up, forgot/reset/change-password; `indexable: false`         |
| SEO helpers                            | PASS         | `src/lib/seo.ts` + tests                                             |
| Sitemap / robots                       | NEEDS REVIEW | `public/sitemap.xml` + `sitemap-articles`; dynamic articles separate |
| Responsive / visual                    | NOT TESTED   | no browser pass this phase                                           |

---

## 2. Front Desk / intake / registration / fee handoff

| Area                                   | Status       | Evidence                                                      |
| -------------------------------------- | ------------ | ------------------------------------------------------------- |
| Routes FD / intake / register          | PASS         | `staff/front-desk`, `intake`, `intake.$studentId`, `register` |
| Register + signup fee record/voucher   | PASS         | `portal-intake.ts`                                            |
| Assign counsellor                      | PASS         | `portalAssignCounsellor`                                      |
| Fee coordination / forward to Accounts | NEEDS REVIEW | workflow lib + UI; live RPC **NOT TESTED**                    |
| Live plane dependency                  | NEEDS REVIEW | many mutations require Supabase data plane                    |

---

## 3. Counsellor

| Area                              | Status     | Evidence                                                       |
| --------------------------------- | ---------- | -------------------------------------------------------------- |
| Assignment / consent / assessment | PASS       | intake + `StudentProfileWorkspace` + officer/intake server fns |
| Fee verification request          | PASS       | `portalRequestFeeVerification`                                 |
| Handover to Admission             | PASS       | `portalHandoverToAdmission` + handover rules tests             |
| Realtime workbench                | NOT TESTED | hooks present; no live verify                                  |

---

## 4. Admission

| Area                     | Status          | Evidence                                                     |
| ------------------------ | --------------- | ------------------------------------------------------------ |
| Handover accept/return   | PASS            | `portalUpdateAdmissionHandover`; staff applications pipeline |
| Applications pipeline    | PASS            | `portal-applications.ts`                                     |
| Admin applications UI    | NEEDS REVIEW    | read-oriented; staff pipeline is canonical                   |
| Demo/mock admission data | PASS (security) | `forbidAdmissionMockDataPlane` — **breaks stale unit test**  |

---

## 5. Finance (priority)

| Area                                 | Status       | Evidence                                              |
| ------------------------------------ | ------------ | ----------------------------------------------------- |
| Signup claim ≠ verify; SoD           | PASS         | `portalVerifySignupFee`, registrar/verifier rules     |
| Duplicate signup verify              | PASS         | terminal + idempotent unchanged                       |
| University fee claim vs verify roles | PASS         | `portal-finance.ts` + `university-fee-auth`           |
| University verify **status machine** | NEEDS REVIEW | verify may not require `claimed` first                |
| Banking desk vs Fees & Payments      | PASS         | separate module `banking_finance`; desk code comments |
| Desk schema migration applied        | NOT TESTED   | graceful degrade + `SCHEMA_NOTE`                      |
| Mock financial success               | PASS         | no client-only verify success found                   |

---

## 6. Student portal

| Area                                     | Status       | Evidence                                  |
| ---------------------------------------- | ------------ | ----------------------------------------- |
| Self-only current student / contact      | PASS         | `resolveOwnStudentDb`                     |
| Appointments / docs / applications scope | PASS         | CRM scope rejects cross-student           |
| Claim own record                         | PASS (code)  | RPC + silent claim on load; sign-up path  |
| Manual claim CTA                         | NEEDS REVIEW | empty state copy without dedicated button |
| Fee activation gate                      | PASS         | `studentPortalAccessAllowed`              |
| Live IDOR E2E                            | NOT TESTED   | staging required                          |

---

## 7. Admin

| Area                            | Status        | Evidence                                    |
| ------------------------------- | ------------- | ------------------------------------------- |
| Accounts (service role)         | PASS          | `requireAdminAccountManager`; demo blocked  |
| Permission matrix load/persist  | PASS          | fail-closed auth load; demo cannot persist  |
| Audit logs / settings           | PASS (static) | routes + server modules present             |
| Notifications in main admin nav | NEEDS REVIEW  | route exists; sidebar exposure inconsistent |

---

## 8. HR / Marketing / Ops / Reports / Notifications

| Module               | Status                 | Notes                                                       |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| HR / Marketing / Ops | PASS (NOT TESTED live) | specialty desk beforeLoad + server modules                  |
| Reports              | PASS                   | staff + admin                                               |
| Notifications        | NEEDS REVIEW           | student route yes; staff embedded; admin route under-linked |

---

## 9. CMS / Blog

| Area                       | Status       | Evidence                             |
| -------------------------- | ------------ | ------------------------------------ |
| CMS public vs admin draft  | PASS         | public RPCs; admin `settings` edit   |
| Blog published-only public | PASS         | published RPCs                       |
| DOMPurify on article HTML  | PASS         | `sanitizeBlogHtml` on content        |
| Excerpt sanitization       | NEEDS REVIEW | list excerpt may be raw              |
| Migrations applied         | NOT TESTED   | `20261108120000`, `140000`, `160000` |

---

## 10. Security pass (`globalroots-supabase-security`)

| Check                                   | Status       | Evidence                                                                                                              |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Role trust (profiles / app_metadata)    | PASS         | `portal-auth.ts`                                                                                                      |
| Mutations require Bearer for supabase   | PASS         | `requireTrustedSession`                                                                                               |
| Service role never `VITE_*`             | PASS         | `supabase-admin.ts` + test                                                                                            |
| Demo auth prod-off                      | PASS         | `demo-auth.ts`                                                                                                        |
| Matrix unavailable fail-closed          | PASS         | `staff-access.ts`                                                                                                     |
| Unsigned portal cookie + guard fallback | NEEDS REVIEW | `portal-session.ts` encode; `getPortalSession` cookie role; `portal-guard` fallback — **mutations still fail-closed** |
| `npm audit`                             | NOT TESTED   | deferred to Phase 5 evidence                                                                                          |
| XSS upload deps                         | NEEDS REVIEW | blog media constraints exist; full dep audit pending                                                                  |

**Secrets:** redacted — none printed. Checklist: no committed `.env` in git status; `.env.example` documents server-only keys.

---

## 11. Design / a11y / motion

| Area                              | Status       | Notes                           |
| --------------------------------- | ------------ | ------------------------------- |
| Shared PortalShell                | PASS         | admin/staff/student             |
| Token consistency                 | NEEDS REVIEW | incremental debt across modules |
| Motion 150–250ms + reduced-motion | NEEDS REVIEW | not systematically enforced     |
| Responsive critical screens       | NOT TESTED   |                                 |

---

## 12. Build / QA snapshot

| Command        | Status                                                                             |
| -------------- | ---------------------------------------------------------------------------------- |
| Vitest         | BLOCKED by 1 stale test (`permission-matrix-load-rules` demo admission) — 607 pass |
| `tsc --noEmit` | NEEDS REVIEW — 169 errors                                                          |
| ESLint         | NEEDS REVIEW — mostly CRLF prettier (~6819)                                        |
| Build          | NOT TESTED (Phase 0 deferred)                                                      |
| Staging E2E    | NOT TESTED (needs approval)                                                        |

---

## 13. Skill application log (Phase 2)

| Skill                   | Used for                 |
| ----------------------- | ------------------------ |
| architecture-auditor    | route/server inventory   |
| supabase-security       | auth/RLS/secrets/IDOR    |
| portal-workflow-auditor | FD→…→Student             |
| finance-integrity       | fees + desk              |
| cms-editorial           | CMS/blog                 |
| uiux-design-system      | shell/motion notes       |
| qa-automation           | command evidence framing |
| release-readiness       | migration/env risk flags |

---

## Next

Freeze prioritized backlog → `docs/engineering/03-priority-backlog.md` (Phase 3).
