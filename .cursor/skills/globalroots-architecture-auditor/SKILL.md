---
name: globalroots-architecture-auditor
description: >-
  Audit GlobalRoots TanStack Start architecture — routes, server functions,
  services data plane, duplication, and portal boundaries. Use when reviewing
  structure, adding modules, or checking route/server consistency.
---

# GlobalRoots Architecture Auditor

## Purpose / triggers

Apply when inspecting overall app structure, new portals/modules, route trees, server fn sprawl, or duplication between `src/services`, `src/server`, and UI.

## Repo inspection steps

1. Inventory `src/routes/` and `src/routeTree.gen.ts` for public / admin / staff / student surfaces.
2. List `createServerFn` exports under `src/server/`; map to `src/services/index.ts` consumers.
3. Trace auth boundaries: `portal-guard.ts`, `portal-auth.ts`, `staff-access.ts`, `business-permissions.ts`.
4. Flag client imports of `supabase-admin`, service-role, or unguarded mock data planes.
5. Note duplicate workflows (e.g. fees vs banking desk) and shared helpers under `src/lib/`.

## Execution steps

1. Produce a route ↔ server ↔ permission matrix sketch for the area under review.
2. Prefer extending existing server modules over new parallel APIs.
3. Keep portal layouts using `requirePortalAccess`; specialty desks via `specialty-desk-route-guard` / staff-access.
4. Document findings under `docs/engineering/` with PASS / NEEDS REVIEW / BLOCKED / NOT TESTED.

## Quality / security constraints

- Fail closed on missing session/role.
- No new client-side role trust (`localStorage` roles forbidden).
- Preserve TanStack Start server/client split.

## Testing requirements

- Vitest for permission/route-guard rules touched.
- Ensure lint/tsc clean for files edited (document residual project-wide tsc debt).

## Deliverables

- Architecture notes with file evidence; duplication list; recommended consolidation (no drive-by refactors).

## Never-do

- No service-role in client or `VITE_*`
- No RLS weakening
- No mock financial success paths
- No production DB reset
- No git push / deploy without explicit user approval
