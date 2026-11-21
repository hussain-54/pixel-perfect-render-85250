# Phase 2 — Blocker resolution log

**Started / closed:** 2026-11-22  
**Baseline HEAD:** `cd29db113992e92f45c4926cf836e5078ef18cc4` (`main`)  
**Constraints:** preserve local transformation work; no push/deploy/production SQL

## Task 1 — Git inventory (preserved)

### Modified at start (tracked)
- `src/lib/auth.ts`, `m2-finance.test.ts`, `permission-matrix-load-rules.test.ts`, `portal-guard.ts`, `university-fee-auth.ts`
- `src/server/portal-blog.ts`, `portal-finance-desk.ts`, `portal-finance.ts`
- `src/styles.css`

### Untracked at start
- `.cursor/`, `.gitattributes`, `ao-mockups.pdf`, `docs/engineering/`

No reset/discard performed. Additional Phase-2 edits layered on top (tsc/lint/audit/tests/docs).

---

## Task 2 — TypeScript — **FIXED**

| Metric | Value |
| --- | --- |
| Before | 153 errors |
| After | **0** (`npx tsc --noEmit` exit 0) |

Key fixes: `FinanceDeskEntryDetail` (no index signature); `cmsDb` + serializable CMS JSON; Link `search`; application-deadline UTC; website `PageLoadState` APIs.

---

## Task 3 — ESLint — **PASS** (warnings only)

| Metric | Value |
| --- | --- |
| Before | ~6819 (mostly CRLF) → intermediate 1763 |
| After | **0 errors**, 16 warnings (`react-refresh`, `react-hooks` on existing UI) |

Actions: `.prettierrc` `endOfLine: "lf"`; prettier rewrite; `eslint --fix`; fixed `cms-rules` useless-escape + control-regex sanitizer.

---

## Task 4 — npm audit

### Initial catalog (14)

| Package | Severity | Direct? | Notes |
| --- | --- | --- | --- |
| vite 8.0.0–8.1.5 | high | direct | **FIXED** → `8.3.8` |
| typescript-eslint ecosystem | moderate | mostly transitive | reduced via audit fix |
| vitest / @vitest/mocker / tinypool | critical | vitest direct | **NEEDS REVIEW** — patch wants vitest@5 (breaking) |
| zod &lt;4.6.6 | high | direct + nested | **NEEDS REVIEW** — zod@4 major / TanStack nested |

### After safe upgrades
- `npm install vite@8.3.8 --save-exact`
- `npm audit fix` (no `--force`)
- Remaining: **4** vulns (1 moderate, 1 high, 2 critical) — tooling/dev (vitest/tinypool) + zod
- Did **not** run `npm audit fix --force`

Runtime production impact of remaining criticals is primarily **Vitest/dev tooling**, not shipped browser bundles. Zod residual is NEEDS REVIEW for app+TanStack generators.

---

## Task 5 — Local Supabase migrations — **BLOCKED**

| Check | Status |
| --- | --- |
| `npx supabase` CLI | Available (3.2.0 via npx) |
| Docker Desktop | **Not installed / not on PATH** |
| `supabase start` / `db reset` | **BLOCKED** — cannot run without Docker |
| Production apply | Not attempted (forbidden) |

### Static SQL review (code-only)

| Migration | Depends on | Notes |
| --- | --- | --- |
| `20261108120000_website_cms_foundation.sql` | `profiles`, `set_updated_at`, `is_admin` helpers | Tables + RLS + public RPCs; drafts not on public views; website-media bucket |
| `20261108140000_blog_platform_foundation.sql` | CMS `can_mutate_cms`, website-media | Blog tables + published RPCs |
| `20261108160000_finance_desk_foundation.sql` | `students`, `profiles` | Ledger separate from fee verify tables |

**Owner runbook (local):** install Docker → `npx supabase start` → `npx supabase db reset` → smoke Admin Website/Blog/Banking.  
**Staging/prod:** apply same three files in order via Supabase SQL editor/CLI — never from this agent without approval.

---

## Task 6 — Security tests

| Layer | Status |
| --- | --- |
| Vitest IDOR / fee / CMS / roles | **PASS** — `src/lib/phase2-security-regression.test.ts` (+ prior suites) |
| Live IDOR against DB | **NOT TESTED** / **BLOCKED** (no local Supabase) |
| Full FD→Admission E2E | **NOT TESTED** (scripted checklist only) |

---

## Task 7 — Regression evidence (2026-11-22)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | **PASS** exit 0 |
| `npm run lint` | **PASS** exit 0 (16 warnings) |
| `npm test` | **PASS** 116 files / **623** tests |
| `npm run build` | **PASS** exit 0 |
| `npm audit` | **NEEDS REVIEW** 4 remaining (no force) |
| Local migrate | **BLOCKED** |

---

## Remaining blockers (not production-ready)

1. Docker + local (or staging) migration apply for three SQL files  
2. Live IDOR / workflow E2E on applied DB  
3. Optional vitest@5 / zod@4 upgrades after compatibility spike  
4. Explicit commit/push/deploy still require user approval
