# Controlled GitHub Release Review

**Review date:** 2026-11-22  
**Baseline commit:** `cd29db113992e92f45c4926cf836e5078ef18cc4` (`cd29db1` — *Add Banking & Finance desk with office ledger and student balances.*)  
**Branch:** `main` (tracks `origin/main`; local work **uncommitted**)  
**Mode:** Inspect / validate / classify only — **no** `git add` / commit / push / deploy / SQL execute  
**Skills:** `globalroots-release-readiness`, `globalroots-supabase-security`, `globalroots-qa-automation`

---

## 1. Repository status

| Item | Value |
| --- | --- |
| `git status -sb` | `## main...origin/main` + dirty tree |
| Dirty path count | **246** short-status lines |
| Diff volume | **203** tracked files changed; **+6191 / −4294** (approx.) |
| Untracked (high-signal) | `.cursor/skills/globalroots-*`, `.gitattributes`, `docs/engineering/*`, MIME/session/harden tests + helpers, `supabase/migrations/20261122120000_blog_promote_and_media_harden.sql`, `ao-mockups.pdf` |
| Local `.env` | **Present on disk**; **gitignored** (`.gitignore:27`); **not tracked** — must stay local |
| `.gitattributes` | Untracked; LF normalize for prettier |
| `.gitignore` | Ignores `.env`, `.env.*`, `node_modules`, `dist`, `.data/`; does **not** ignore `.cursor/` or `ao-mockups.pdf` |

HEAD message: `cd29db1 Add Banking & Finance desk with office ledger and student balances.`

---

## 2. Files reviewed (scope)

### Documentation / skills / migrations

- `docs/engineering/00`–`15` (Phase 1–3 artifacts); this file `16`
- `.cursor/skills/globalroots-*` (8 skills + README)
- Migrations: `20261108120000`, `20261108140000`, `20261108160000`, **`20261122120000`** (untracked harden), plus existing `20261104120000`

### Security-critical app paths

- `src/server/portal-data.ts` — `getPortalSession`, live student stubs  
- `src/server/portal-blog.ts` — MIME + promote via admin client preference  
- `src/lib/website-media-mime.ts` (+ test)  
- `src/lib/portal-guard.ts`, `src/lib/auth.ts`  
- `src/server/supabase-admin.ts`  
- `src/lib/migration-security-static.test.ts`, `phase2-security-regression.test.ts`, `portal-session-unsigned.test.ts`

### Noise / sensitivity spot-checks

- `.agents/skills/*` — large formatting/content churn on design kits (**omit** from proposed commit)  
- `docs/testing/STAGING-TEST-ACCOUNTS.md` — emails / project ref; **no passwords** in reviewed content  
- Probe scripts under `scripts/` — env presence probes; no live secrets in diff sample  
- Test fixture strings containing fake `eyJ…` JWT shapes in `student-portal-account.test.ts` (placeholders only)

---

## 3. Security findings

| Check | Result |
| --- | --- |
| Tracked `.env` / service-role values | **PASS** — `.env` ignored & untracked; `.env.example` shows empty `SUPABASE_SERVICE_ROLE_KEY=` comment only |
| Hardcoded live keys / `sk_live_` in source | **PASS** — no real service-role/JWT secrets found for commit |
| `getPortalSession` unsigned supabase cookie | **PASS** — returns `null` for `source: "supabase"`; demo path re-derives from allow-list |
| Authz path | **PASS** — live grants via Bearer + `establishSession` / `requireTrustedSession`; guard still nulls supabase cookie without Bearer |
| SVG / MIME allowlist | **PASS** — shared helper rejects SVG; blog upload uses it |
| Live student stubs | **PASS** — `crmListOrEmpty` / `crmRecordOrNull` → `[]` / `null` on supabase (no mock fixtures) |
| Service-role env reads | **PASS** — `readServiceRoleKey` uses `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` only (never `VITE_*` for the secret) |
| Debug bypasses | **PASS** (spot-check) — none introduced for release |
| RLS / grants in harden SQL | **Stronger** (revoke + gate) — **NOT EXECUTED** (repo file only) |
| Local `.env` on workstation | **NOTE** — keep out of any future `git add -A`; already ignored |

No secret rotation performed (out of scope).

---

## 4. Database / migration status

| Migration | In repo | Executed this review |
| --- | --- | --- |
| `20261108120000_website_cms_foundation.sql` | Yes | **NOT EXECUTED** |
| `20261108140000_blog_platform_foundation.sql` | Yes | **NOT EXECUTED** |
| `20261108160000_finance_desk_foundation.sql` | Yes | **NOT EXECUTED** |
| `20261122120000_blog_promote_and_media_harden.sql` | Yes (untracked) | **NOT EXECUTED** |

### Static review — harden SQL (`20261122120000`)

- Promote: requires `can_mutate_cms()` **or** `auth.role() = 'service_role'`; else `return 0`  
- `REVOKE ALL` from `public` / `anon` / `authenticated`; `GRANT EXECUTE` to `service_role`  
- Drops SVG from `website-media` `allowed_mime_types` and `cms_media` mime check  
- No `DROP TABLE`; forward-only; compatible with app prefer-admin promote path  
- **Live apply / IDOR:** **NOT TESTED**

Option B / DB-untouched confirmed for this review.

---

## 5. Fresh regression results (this review only)

| Check | Command | Result | Evidence |
| --- | --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **PASS** (exit 0) | run ~2026-11-21T22:35Z |
| ESLint | `npm run lint` | **PASS** (exit 0; 0 errors / 16 warnings) | run ~22:37Z |
| Vitest | `npm test` | **PASS** — **119** files / **641** tests | Duration ~109s |
| Build | `npm run build` | **PASS** (exit 0) | ~51s |
| Audit | `npm audit` | **NEEDS REVIEW** (exit 1) | 4 residual vulns |

Live E2E / IDOR / staging: **NOT TESTED**.

---

## 6. npm audit residuals (no `--force`)

| Package | Severity | Plane | Notes |
| --- | --- | --- | --- |
| `vitest` | critical (via tinypool) | **dev tooling** | Fix wants `vitest@5` — breaking; deferred |
| `@vitest/mocker` | moderate | **dev tooling** | Nested under vitest |
| `tinypool` | critical | **dev tooling** | Worker RCE gadget; not production runtime |
| `zod` | high | **runtime** | Fix wants `zod@4` — TanStack risk; mitigate size-bounded untrusted input |

**Not done:** `npm audit fix --force`, vitest@5, zod@4. `vite` remains pinned **8.3.8** in dirty `package.json`.

---

## 7. Proposed commit contents (do **not** stage yet)

### Safe to include (when commit is separately approved)

- App / security / UX dirty tree under `src/` (portal, auth, finance, CMS/blog, styles, routes, tests)  
- Untracked: `website-media-mime.ts` (+ test), `migration-security-static.test.ts`, `phase2-security-regression.test.ts`, `portal-session-unsigned.test.ts`  
- `docs/engineering/**` (including this `16` file)  
- `.cursor/skills/globalroots-*/**` + `.cursor/skills/README.md`  
- `supabase/migrations/20261122120000_blog_promote_and_media_harden.sql` (**file only**)  
- `.gitattributes`  
- `package.json` / `package-lock.json` (vite `8.3.8`)  
- Related intentional doc/script/config edits already dirty (`AGENTS.md`, `.prettierrc`, selected `docs/database` / `docs/testing` if owner wants them in the same PR)

### Keep local / omit

- **`ao-mockups.pdf`** (noise)  
- **`.env` / `.env.*`** (secrets; already ignored)  
- **`.agents/skills/*` design-kit churn** (cosmetic; not GlobalRoots release payload)  
- Any probe output / `.tmp-*` / build artifacts

### Proposed commit message

```
Harden portal session/MIME security and add release-prep engineering docs (DB migrations not applied).
```

### Release checklist (post-commit, owner)

1. Open PR for controlled GitHub review (no force-push; Lovable-safe).  
2. Non-prod: apply CMS → blog → finance-desk → harden SQL; smoke.  
3. Confirm Vercel env: `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` (never `VITE_*`), `APP_ORIGIN`.  
4. Live IDOR + workflow E2E on staging.  
5. Separate approval before production deploy.

---

## 8. Remaining blockers

1. Work still **uncommitted** — needs explicit commit + push approval.  
2. Foundation + harden migrations **unapplied** on live DB.  
3. Live IDOR / security / workflow E2E **NOT TESTED**.  
4. npm audit residuals (vitest5 / zod4) **NEEDS REVIEW**.  
5. Commit hygiene: exclude `ao-mockups.pdf` and `.agents` skill noise; never add `.env`.

---

## 9. Explicit release recommendation

### 1. Ready for GitHub push?

**CONDITIONAL GO for controlled push** — static gates are green on this fresh run and security spot-checks pass, **after** a separately approved commit that uses the include/omit set above.

This review did **not** commit or push.

### 2. Ready for production deployment?

**NO-GO.**

Production remains blocked until:

- Owner-approved migration apply (non-prod first, then prod process) including harden SQL  
- Live IDOR / security testing passes  
- Workflow E2E passes

Do not treat unit/build PASS as live verification.
