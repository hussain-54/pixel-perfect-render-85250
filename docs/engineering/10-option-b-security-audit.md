# Option B — Code-level security audit

**Date:** 2026-11-22  
**Live IDOR / staging E2E:** **NOT TESTED**  
**Database mutations:** none

## PASS (code evidence)

| Area | Status |
| --- | --- |
| Bearer required for supabase mutations | PASS |
| Service-role never `VITE_*` | PASS |
| Portal guard rejects unsigned supabase cookie without JWT | PASS |
| Student CRM IDOR helpers (`resolveCrmListStudentIds`) | PASS (unit) |
| Officer `assertStudentVisibleDb` on live mutations | PASS (static) |
| CMS/blog public RPCs publish-only | PASS (SQL static) |
| Signup fee SoD / university claimed-before-verify | PASS (unit) |

## NEEDS REVIEW

| Item | Notes |
| --- | --- |
| Unsigned portal cookie | UI hint only; mutations still JWT-gated |
| `promote_scheduled_blog_posts` grant to authenticated | Harden before production trust |
| Finance desk RLS vs module matrix | Role list ≠ matrix |
| CMS mutate `is_admin` vs app `settings:2` | Desync for non-admin editors |
| Public SVG in website-media | XSS surface |
| `portalGetStudent` / `portalGetStudents` live stubs | Fail-safe null/[] — document callers |

## NOT TESTED

- Live cross-student IDOR against Postgres  
- Live unauthorized RPC calls  
- Migration apply on any environment

## Vitest added this pass

- `migration-security-static.test.ts`  
- `portal-session-unsigned.test.ts`  
- Prior: `phase2-security-regression.test.ts`
