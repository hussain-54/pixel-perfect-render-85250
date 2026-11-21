---
name: globalroots-release-readiness
description: >-
  Assess GlobalRoots release readiness — migrations, env/Vercel, rollback,
  Lovable/git history safety, and go/no-go. Use before deploy or when writing
  final engineering reports.
---

# GlobalRoots Release Readiness

## Purpose / triggers

Apply before any deploy, migration apply, or final readiness report; also when documenting manual Vercel/Supabase owner steps.

## Repo inspection steps

1. Git: branch cleanliness; **no force-push** to Lovable-connected history (`AGENTS.md`).
2. Migrations pending: CMS, blog, finance desk, and any new forward-only SQL.
3. Env: `.env.example` vs Vercel Production — `VITE_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` (never `VITE_*`), `APP_ORIGIN`, Auth redirect URLs.
4. Build artifacts: `npm run build` success; residual `tsc` debt called out explicitly.
5. Rollback: previous deployment + migration reverse plan (forward-only preferred; document data impact).

## Execution steps

1. Produce go/no-go with critical NOT TESTED / BLOCKED items blocking “ready”.
2. List **manual** owner steps only (apply SQL, set env, redeploy).
3. Never push or deploy unless user explicitly requests.

## Quality / security constraints

- Production is read-only unless a specific action is approved.
- Prefer minimal forward-only migrations; explain impact.

## Testing requirements

- Cite latest QA artifact (`05-qa-results.md`) and baseline.
- Confirm critical fee/auth tests green.

## Deliverables

- Release checklist; env/migration owner steps; production-readiness verdict.

## Never-do

- No service-role in client or `VITE_*`
- No RLS weakening
- No mock financial success
- No production database reset
- No force-push / history rewrite
- No git push or Vercel deploy without explicit user approval
