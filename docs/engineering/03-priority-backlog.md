# Prioritized improvement backlog (frozen)

**Date:** 2026-11-22  
**Source audit:** `docs/engineering/02-full-audit.md`  
**Order:** Security → Finance → FD → Counsellor/Admission → Student/Admin → HR/Marketing/Ops → Blog/CMS → Design → Performance/regression

**Gate note:** Plan Phase 3 originally paused for explicit backlog approval. The user instruction to implement the full plan and complete all todos authorizes proceeding with **code-only, non-destructive** Phase 4 items below. Still **no** git push, Vercel deploy, or production migration apply without a separate explicit request.

---

## P1 — Security / auth / secrets

| ID   | Item                                                             | Severity        | Business impact                                          | Evidence                                                                    | Proposed fix                                                                                              | Test plan                          | Risk                        |
| ---- | ---------------------------------------------------------------- | --------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------- |
| P1.1 | Stale demo-admission unit test vs `forbidAdmissionMockDataPlane` | High (CI)       | False security/regression signal                         | `permission-matrix-load-rules.test.ts`; `staff-access.ts`                   | Expect 403 for demo `admission_team`                                                                      | Vitest file + suite                | None (test only)            |
| P1.2 | Unsigned portal cookie trusted by route guard fallback           | Medium          | Spoofable **client routing** (mutations still JWT-gated) | `portal-session.ts`, `portal-data.ts` `getPortalSession`, `portal-guard.ts` | Prefer JWT re-establish; treat cookie role as hint only / require live JWT for supabase sessions in guard | Unit tests for guard/session rules | Low code risk; no migration |
| P1.3 | Confirm service-role on Vercel (manual)                          | High if missing | Account admin broken                                     | `.env.example`, `supabase-admin.ts`                                         | Owner sets `SUPABASE_SERVICE_ROLE_KEY` (never `VITE_*`)                                                   | Manual host check                  | Prod config only — owner    |

---

## P2 — Financial + DB integrity

| ID   | Item                                            | Severity | Business impact             | Evidence                               | Proposed fix                                                                              | Test plan                           | Risk                          |
| ---- | ----------------------------------------------- | -------- | --------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------- |
| P2.1 | University fee verify without claimed-only gate | High     | Improper status transitions | `portal-finance.ts` verify handler     | Require `claimed` (or documented allowed set) before verify; mirror signup terminal rules | `m2-finance` / university fee tests | Low; server-only              |
| P2.2 | Finance desk / CMS / blog migrations unapplied  | High     | Features degrade/empty      | migrations `2026110812*`, `14*`, `16*` | Owner apply on staging then prod                                                          | Staging smoke                       | **Migration** — owner applies |
| P2.3 | Desk tsc index-signature errors                 | Medium   | Static debt                 | `portal-finance-desk.ts`               | Bracket access / typed rows                                                               | `tsc` file slice                    | None                          |

---

## P3 — Front Desk / registration

| ID   | Item                                | Severity | Impact         | Evidence                  | Fix                                         | Test                     | Risk          |
| ---- | ----------------------------------- | -------- | -------------- | ------------------------- | ------------------------------------------- | ------------------------ | ------------- |
| P3.1 | Live fee handoff FD→Accounts        | Medium   | Ops friction   | fee-verification workflow | Code already present; staging E2E checklist | Manual staging           | Needs staging |
| P3.2 | Intake live-plane messaging clarity | Low      | Support burden | portal-intake errors      | Copy/guard polish if gaps found             | Vitest copy rules if any | Low           |

---

## P4 — Counsellor / Admission

| ID   | Item                                    | Severity | Impact       | Evidence                                   | Fix                                    | Test   | Risk |
| ---- | --------------------------------------- | -------- | ------------ | ------------------------------------------ | -------------------------------------- | ------ | ---- |
| P4.1 | Align tests with admission demo forbid  | High     | Same as P1.1 | module-permission-gate already expects 403 | Deduplicate/clarify tests              | Vitest | None |
| P4.2 | Admin applications vs staff handover UX | Low      | Confusion    | admin applications read-only               | Doc/nav note or link to staff pipeline | Manual | Low  |

---

## P5 — Student + Admin matrix propagation

| ID   | Item                               | Severity | Impact          | Evidence           | Fix                                             | Test                 | Risk |
| ---- | ---------------------------------- | -------- | --------------- | ------------------ | ----------------------------------------------- | -------------------- | ---- |
| P5.1 | Student claim CTA / sign-in claim  | Medium   | Orphan profiles | audit §6           | Call claim on sign-in and/or dashboard CTA      | student-portal tests | Low  |
| P5.2 | Admin notifications nav visibility | Low      | Discoverability | admin route vs nav | Add to adminNav or settings subnav consistently | nav test if exists   | Low  |

---

## P6 — HR / Marketing / Ops

| ID   | Item                             | Severity | Impact             | Fix                        | Risk          |
| ---- | -------------------------------- | -------- | ------------------ | -------------------------- | ------------- |
| P6.1 | Staging smoke per specialty role | Medium   | Access regressions | Manual checklist (Phase 5) | Needs staging |

---

## P7 — Blog/CMS + public site

| ID   | Item                                 | Severity | Impact                | Evidence                     | Fix                                                  | Test             | Risk      |
| ---- | ------------------------------------ | -------- | --------------------- | ---------------------------- | ---------------------------------------------------- | ---------------- | --------- |
| P7.1 | Sanitize blog excerpt on public list | Medium   | XSS/content injection | `portal-blog.ts` list mapper | `sanitizeBlogHtml` or plain-text sanitize on excerpt | blog-rules tests | Low       |
| P7.2 | Owner apply CMS/blog SQL             | High     | Editorial features    | migrations                   | Owner                                                | Staging          | Migration |

---

## P8 — Design system + controlled motion

| ID   | Item                                                                        | Severity | Impact | Fix                       | Risk |
| ---- | --------------------------------------------------------------------------- | -------- | ------ | ------------------------- | ---- |
| P8.1 | Document/enforce 150–250ms + `prefers-reduced-motion` on portal transitions | Low      | A11y   | CSS utility / PortalShell | Low  |
| P8.2 | Incremental shell consistency                                               | Low      | UX     | only when touching UI     | Low  |

---

## P9 — Performance + final regression

| ID   | Item                         | Severity    | Impact              | Fix                                                                                      | Risk                  |
| ---- | ---------------------------- | ----------- | ------------------- | ---------------------------------------------------------------------------------------- | --------------------- |
| P9.1 | CRLF prettier flood          | Medium (CI) | Lint red on Windows | `.gitattributes` text eol=lf + format touched files; avoid mass reformat unless approved | Medium checkout churn |
| P9.2 | tsc debt triage              | Medium      | Release optics      | Fix touched modules; track residual count                                                | Low                   |
| P9.3 | Full vitest + build evidence | High        | Release gate        | Phase 5                                                                                  | None                  |
| P9.4 | Staging E2E / IDOR           | High        | Prod confidence     | Only if approved                                                                         | Staging               |

---

## Phase 4 implementation set (this run)

Authorized by “complete all todos” + code-only stance:

1. **P1.1 / P4.1** — fix stale test
2. **P1.2** — harden portal guard JWT preference (minimal)
3. **P2.1** — university fee claimed-only verify
4. **P7.1** — sanitize blog excerpt
5. **P5.1** — claim on sign-in path if safe
6. **P8.1** — reduced-motion CSS hook if trivial
7. **P2.3** — finance-desk bracket access where quick

**Out of scope this run:** push, deploy, applying SQL on Supabase, mass CRLF reformat of entire repo, Playwright unless approved.
