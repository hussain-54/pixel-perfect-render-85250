# Phase 3 — Final security cleanup & release preparation

**Date:** 2026-11-22  
**Branch:** `main` @ `cd29db1` (+ local uncommitted Phase 1–3 work)  
**Mode:** Option B — **DB untouched**; no push / deploy / secret rotation  
**Skills:** `globalroots-supabase-security`, `globalroots-qa-automation`, `globalroots-release-readiness`, `globalroots-cms-editorial-management`, `globalroots-finance-integrity`

---

## 1. Git audit summary

See `12-phase3-git-audit.md`. All legitimate Phase 1–2 work preserved. Noise flagged (`ao-mockups.pdf`). No secrets committed. No unintended business-workflow rewrites beyond documented fixes.

---

## 2. Residual npm audit (no `--force`)

| Package | Severity | Direct/transitive | Runtime vs tooling | Installed | Vulnerable range | Patched via | Risk notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `vitest` | critical (via tinypool) | direct (dev) | **tooling** | `^3.2.4` | `0.0.95–4.1.10` | `vitest@5.1.1` (`audit fix --force`) | **NEEDS REVIEW** — vitest@5 is breaking for TanStack Start toolchain |
| `@vitest/mocker` | moderate | transitive (dev) | **tooling** | nested under vitest | `<=4.1.11` | vitest@5 | Dev-only path traversal / mock injection |
| `tinypool` | critical | transitive (dev) | **tooling** | nested | `<=2.1.1` | vitest@5 | Prototype pollution → RCE in worker opts; not production runtime |
| `zod` | high | direct | **runtime** | `^3.25.76` | `<4.6.6` | `zod@4` (`audit fix --force`) | **NEEDS REVIEW** — zod@4 breaks TanStack generators; mitigate with size-bounded untrusted payloads |

**Actions taken:** Catalogued; **no** `npm audit fix --force`; **no** vitest@5 / zod@4 jump this phase. Kept `vite@8.3.8`. Safe exact vitest bump attempted; sandbox FS/block prevented lockfile change — residual remains documented.

**Mitigations:** Vitest/tinypool/mocker are CI/dev-only. App validators should keep untrusted collection sizes bounded (existing upload byte caps + blog/CMS field limits).

---

## 3. Security FIXED vs NEEDS REVIEW

| Item | Status |
| --- | --- |
| Blog/CMS SVG upload reject (app MIME allowlist) | **FIXED** (`website-media-mime` + `portalUploadBlogMedia`) |
| Unsigned supabase cookie role as authz | **FIXED** (`getPortalSession` returns null for `source: "supabase"`) |
| Live student stubs (no fake rows) | **FIXED** (fail-safe `[]` / `null` + comments) |
| Service-role never via `VITE_*` | **PASS** (existing + tests) |
| Harden SQL: promote grant + SVG bucket | **FIXED in repo** — file **NOT EXECUTED** |
| Live IDOR / E2E | **NOT TESTED** |
| zod@4 / vitest@5 | **NEEDS REVIEW** (deferred) |
| Foundation promote grant (pre-harden) | **NEEDS REVIEW** until owner applies harden SQL |

---

## 4. Migrations

| File | Executed? |
| --- | --- |
| `2026110812*` / `14*` / `16*` | **NOT EXECUTED** |
| `20261122120000_blog_promote_and_media_harden.sql` | **NOT EXECUTED** (committed for owner) |

Static review: `09-migration-static-review.md`, `13-migration-risks.md`. Feature map: `14-migration-dependent-features.md`.

---

## 5. Regression evidence

See Phase 3 section in `05-qa-results.md` (tsc / lint / test / build / audit).

---

## 6. Known limitations

- Existing Supabase DB may lack CMS/blog/desk tables until owner apply.
- Harden SQL must follow foundation apply order.
- npm audit 4 residuals (dev tooling + zod major).
- Live IDOR, staging E2E, production deploy: **out of scope**.

---

## 7. Deployment prerequisites (owner)

1. Non-prod: apply four SQL files in order; smoke CMS/blog/desk.
2. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (never `VITE_*`), `APP_ORIGIN`.
3. Auth redirect allow-list.
4. No force-push / history rewrite (Lovable).
5. Live IDOR + workflow E2E after DB up.
6. Explicit approval before GitHub push / Vercel deploy.

---

## 8. Recommendation (go / no-go)

**GO for controlled GitHub release review** of the local branch (PR review) **if** static gates in `05-qa-results` Phase 3 stay green.

**NO-GO for production deploy** until migrations + harden applied on non-prod, live IDOR/E2E pass, and residual npm majors are owner-accepted or upgraded under a dedicated change.
