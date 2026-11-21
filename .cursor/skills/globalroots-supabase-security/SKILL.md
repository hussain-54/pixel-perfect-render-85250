---
name: globalroots-supabase-security
description: >-
  Audit and harden GlobalRoots Supabase security — Auth, RLS, RPC grants,
  storage, secrets, IDOR, and server-fn authorization. Use for security reviews,
  permission bugs, or any auth/data-access change.
---

# GlobalRoots Supabase Security

## Purpose / triggers

Apply on any auth, RLS, RPC, storage, account provisioning, or server-fn authorization change; also for IDOR/cross-student access reviews.

## Repo inspection steps

1. Secrets: `.env.example`, `supabase-admin.ts` (`readServiceRoleKey` — never `VITE_*`), grep for service-role leakage.
2. Session trust: `portal-auth.ts` — roles from `profiles` / `app_metadata` only; never `user_metadata` or client body.
3. Server gates: `requireModulePermission` / specialty guards on every mutating `createServerFn`.
4. Migrations: policies, `SECURITY DEFINER` RPCs, `GRANT`/`REVOKE`, storage bucket policies.
5. Student scope: self-only queries (`portalGetCurrentStudent`, document upload paths).
6. Dependencies: `npm audit` (document; do not blindly upgrade).

## Execution steps

1. Prefer server-side checks that mirror RLS (defense in depth).
2. Keep demo auth disabled in production builds.
3. Redact all secret values in reports/logs.
4. For IDOR tests use staging only with explicit approval.

## Quality / security constraints

- Fail closed when matrix/RPC unavailable.
- Do not broaden SELECT policies “for convenience”.
- Admission mock/demo data plane remains forbidden where `forbidAdmissionMockDataPlane` applies.

## Testing requirements

- Unit tests for authz negative cases (`*.test.ts` under `src/lib`, `src/server`).
- Staging E2E unauthorized route/server access only if approved.

## Deliverables

- Security findings with file/migration refs; severity; remediation; residual risk.

## Never-do

- No service-role in client or `VITE_*`
- No RLS weakening
- No mock financial success
- No production reset / destructive SQL without approval
- No push without approval
- Never print or commit real keys
