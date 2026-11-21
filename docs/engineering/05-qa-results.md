# Phase 5 QA results

**Date:** 2026-11-22  
**Skill:** `globalroots-qa-automation`  
**Environment:** local Windows; Node v22.15.0; no staging E2E (not approved)

---

## Command evidence

| Check                  | Command                                                                                | Result           | Notes                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| Unit / regression      | `npm test` (vitest run)                                                                | **PASS**         | **115** files, **610** tests passed (was 607 + 1 fail at baseline)                                        |
| Targeted auth/fee/blog | vitest on `permission-matrix-load-rules`, `m2-finance`, `blog-rules`, `supabase-admin` | **PASS**         | 23 tests                                                                                                  |
| Production build       | `npm run build`                                                                        | **PASS**         | exit 0                                                                                                    |
| Typecheck              | `npx tsc --noEmit`                                                                     | **FAIL** (debt)  | Baseline **169** → post-fix **153** errors — not a Vitest gate                                            |
| ESLint                 | `npm run lint`                                                                         | **FAIL** (env)   | ~6819 issues dominated by CRLF `prettier/prettier`; `.gitattributes` added (no mass rewrite this run)     |
| Dependency audit       | `npm audit`                                                                            | **NEEDS REVIEW** | **14** vulns (10 moderate, 2 high, 2 critical) — vite/zod transitive; do not force-upgrade without review |
| Staging E2E / IDOR     | —                                                                                      | **NOT TESTED**   | Requires staging + explicit approval                                                                      |
| Responsive 375–1440    | —                                                                                      | **NOT TESTED**   | Manual checklist deferred                                                                                 |

---

## Regression focus (Priority 1–5)

| Area                                     | Status          | Evidence                                         |
| ---------------------------------------- | --------------- | ------------------------------------------------ |
| Admission demo forbid aligned with tests | **PASS**        | `permission-matrix-load-rules.test.ts`           |
| University fee claimed-before-verify     | **PASS**        | `m2-finance.test.ts`                             |
| Service-role never VITE_*                | **PASS**        | `supabase-admin.test.ts`                         |
| Blog HTML sanitize                       | **PASS**        | `blog-rules.test.ts`                             |
| Portal guard cookie hardening            | **PASS** (code) | no dedicated unit yet; covered by review + build |

---

## Security cases

| Case                                                     | Status                               |
| -------------------------------------------------------- | ------------------------------------ |
| Unauthorized matrix/module (unit)                        | PASS (existing suite)                |
| Cross-student IDOR live                                  | NOT TESTED                           |
| Unsigned cookie cannot route supabase portal without JWT | FIXED in code; NOT TESTED in browser |

---

## Manual / owner checklist (staging)

- [ ] Apply migrations `20261108120000`, `20261108140000`, `20261108160000`
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` on Vercel (non-`VITE_*`)
- [ ] FD → fee verify → counsellor → admission → student smoke
- [ ] Banking desk draft/post/reverse vs Fees & Payments verify
- [ ] Blog publish → public slug; CMS draft not public

---

## Verdict (Phase 1 transformation)

**Automated unit + build: green.**  
**Not production-ready** while migrations unconfirmed, `tsc`/lint debt remain, npm audit high/critical unreviewed, and staging E2E **NOT TESTED**.

---

## Phase 2 blocker resolution (2026-11-22)

| Check | Result | Notes |
| --- | --- | --- |
| `npx tsc --noEmit` | **PASS** | 153 → **0** errors |
| `npm run lint` | **PASS** | 0 errors / 16 warnings (was CRLF flood) |
| `npm test` | **PASS** | **116** files / **623** tests |
| `npm run build` | **PASS** | exit 0 |
| `npm audit` | **NEEDS REVIEW** | 14 → **4** remaining; vite bumped to 8.3.8; no `--force` |
| Local Supabase migrate | **BLOCKED** | Docker not available |
| Live IDOR / E2E | **NOT TESTED** | Depends on local/staging DB |

New coverage: `src/lib/phase2-security-regression.test.ts` (IDOR, fee authz, CMS draft/XSS, portal roles).

Detail: `docs/engineering/07-blocker-resolution.md`, `08-blocker-final-report.md`.

---

## Option B pass (2026-11-22) — no DB / no staging

| Check | Result | Notes |
| --- | --- | --- |
| `npx tsc --noEmit` | **PASS** | 0 errors |
| `npm run lint` | **PASS** | exit 0 |
| `npm test` | **PASS** | full suite green after UI + security tests |
| `npm run build` | **PASS** | exit 0 |
| Migration execute | **NOT EXECUTED** | Option B |
| Live IDOR | **NOT TESTED** | |

Portal UX + static security docs: `09`–`11` under `docs/engineering/`.

---

## Phase 3 — release prep (2026-11-22) — no DB / no push

| Check | Result | Notes |
| --- | --- | --- |
| `npx tsc --noEmit` | **PASS** | 0 errors |
| `npm run lint` | **PASS** | 0 errors / 16 warnings (pre-existing react-hooks/refresh) |
| `npm test` | **PASS** | **119** files / **641** tests (MIME + harden static contracts) |
| `npm run build` | **PASS** | exit 0 |
| `npm audit` | **NEEDS REVIEW** | 4 residual (vitest/@vitest/mocker/tinypool tooling; zod high) — no `--force`; no vitest@5/zod@4 |
| Migration execute | **NOT EXECUTED** | Foundations + `20261122120000` harden file in repo only |
| Live IDOR / E2E | **NOT TESTED** | |
| Responsive / `prefers-reduced-motion` | **PASS** (code review) | `styles.css` reduce-motion block; PortalShell + MobileNavDrawer; carousel respects MQ |

Phase 3 artifacts: `12-phase3-git-audit.md`, `13-migration-risks.md`, `14-migration-dependent-features.md`, `15-phase3-release-prep.md`.

---

## Controlled GitHub release review (2026-11-22) — fresh run

| Check | Result | Notes |
| --- | --- | --- |
| `npx tsc --noEmit` | **PASS** | exit 0 (new run; not reused from Phase 3) |
| `npm run lint` | **PASS** | 0 errors / 16 warnings |
| `npm test` | **PASS** | **119** files / **641** tests |
| `npm run build` | **PASS** | exit 0 |
| `npm audit` | **NEEDS REVIEW** | 4 residual (vitest/mocker/tinypool tooling; zod high) — no `--force` |
| Migration execute | **NOT EXECUTED** | including `20261122120000` |
| Live IDOR / E2E | **NOT TESTED** | |

Report: `16-controlled-release-review.md`. No commit/push/deploy this pass.
