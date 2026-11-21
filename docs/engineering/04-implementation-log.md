# Phase 4 implementation log

**Date:** 2026-11-22  
**Backlog:** `docs/engineering/03-priority-backlog.md`  
**Constraint:** no push / deploy / production SQL apply

| Backlog ID     | Skills applied                          | Change                                                                                            | Files                                                                                          |
| -------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| P1.1 / P4.1    | supabase-security, qa-automation        | Demo Admission Team must 403; demo counsellor still works                                         | `src/lib/permission-matrix-load-rules.test.ts`                                                 |
| P1.2           | supabase-security, architecture-auditor | Portal guard ignores unsigned supabase cookie without Bearer                                      | `src/lib/portal-guard.ts`                                                                      |
| P2.1           | finance-integrity                       | University fee verify/reject require `claimed`; waive from due/claimed/rejected; terminal blocked | `src/lib/university-fee-auth.ts`, `src/server/portal-finance.ts`, `src/lib/m2-finance.test.ts` |
| P2.3           | finance-integrity, architecture-auditor | Bracket access on finance desk `detail` index signature                                           | `src/server/portal-finance-desk.ts`                                                            |
| P5.1           | portal-workflow-auditor                 | Student sign-in best-effort `claimOwnStudentRecord`                                               | `src/lib/auth.ts`                                                                              |
| P7.1           | cms-editorial, supabase-security        | Sanitize public blog title/excerpt/SEO plain fields                                               | `src/server/portal-blog.ts`                                                                    |
| P8.1           | uiux-design-system                      | Global reduced-motion + 150–250ms utility classes                                                 | `src/styles.css`                                                                               |
| P9.1 (partial) | release-readiness, qa-automation        | `.gitattributes` eol=lf (no mass reformat)                                                        | `.gitattributes`                                                                               |

**Deferred (owner / staging):** P1.3 Vercel service-role confirm; P2.2 / P7.2 migration apply; P3.1 / P6.1 / P9.4 live E2E; mass prettier CRLF rewrite; full tsc debt.

**P5.2:** Admin notifications left out of `adminNav` (module-aligned sidebar policy); reachable via settings/reports — documented as residual NEEDS REVIEW.
