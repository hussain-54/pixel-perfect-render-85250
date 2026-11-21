---
name: globalroots-qa-automation
description: >-
  Run and expand GlobalRoots QA — Vitest, lint, build, tsc debt tracking, role
  matrices, and staged E2E plans. Use before release or after module fixes.
---

# GlobalRoots QA Automation

## Purpose / triggers

Apply after implementations, before release readiness, or when adding regression coverage for permissions, fees, finance desk, blog, or portal guards.

## Repo inspection steps

1. Scripts: `package.json` — `lint`, `test`, `build`.
2. Tests: `src/**/*.test.ts` (100+); prioritize authz, fee, finance-desk, blog, matrix.
3. Baseline debt: document `tsc --noEmit` and CRLF lint separately from functional fails.
4. Role matrices: `business-permissions`, specialty desk guards, portal-access tests.

## Execution steps

1. Default: code-only + Vitest + lint/build evidence.
2. Expand unit tests for changed rules; prefer table-driven negative cases.
3. E2E (Playwright/Cypress) **only if user approved** + staging project.
4. Responsive checklist: 375 / 390 / 768 / 1024 / 1280 / 1440 for critical screens.
5. Record real pass/fail in `docs/engineering/05-qa-results.md` — never aspirational.

## Quality / security constraints

- Do not weaken tests to greenwash (e.g. removing admission demo forbid).
- Redact secrets in any captured logs.

## Testing requirements

- Minimum after Priority 1–5 fixes: targeted Vitest + note full suite result.
- Security cases: unauthorized server access mocks; IDOR only on staging if approved.

## Deliverables

- Command evidence tables; failing test list with owner action; E2E plan if not run.

## Never-do

- No service-role in client
- No RLS weakening
- No mock financial success in fixtures that claim verified
- No prod reset / destructive staging wipe without approval
- No push without approval
