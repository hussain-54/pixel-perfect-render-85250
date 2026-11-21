---
name: globalroots-uiux-design-system
description: >-
  Keep GlobalRoots portals and marketing UI consistent — Tailwind tokens,
  shared ui components, PortalShell, a11y, and controlled motion (150–250ms)
  with prefers-reduced-motion. Use for UI polish, portal chrome, or design debt.
---

# GlobalRoots UI/UX Design System

## Purpose / triggers

Apply when changing portal layouts, shared components, marketing pages, motion, or visual consistency across admin/staff/student.

## Repo inspection steps

1. Tokens / Tailwind: global CSS and theme variables used by existing pages.
2. Primitives: `src/components/ui/*` — reuse before inventing new patterns.
3. Shells: `PortalShell.tsx`, site layout, auth shells.
4. Motion: `tw-animate-css` / CSS transitions; check for unbounded animation.
5. A11y: focus rings, labels, dialogs, contrast on status badges.

## Execution steps

1. Prefer incremental consistency over redesign.
2. Motion duration target **150–250ms**; honor `prefers-reduced-motion: reduce` (disable or simplify).
3. Portal surfaces stay utilitarian (existing design system); do not impose landing-page hero rules on dashboards.
4. Avoid purple-glow / generic AI aesthetic when introducing new marketing sections — match GlobalRoots brand already in `src/data/site.ts` / existing pages.

## Quality / security constraints

- No XSS via `dangerouslySetInnerHTML` without sanitization (blog uses DOMPurify).
- Do not remove security-related UI confirmations on finance/destructive actions.

## Testing requirements

- Visual smoke at 375 / 768 / 1280 for touched screens (manual checklist if no E2E).
- Keep component unit tests when logic lives in helpers.

## Deliverables

- List of UI inconsistencies fixed vs deferred; motion/a11y notes.

## Never-do

- No service-role in client
- No RLS weakening
- No mock financial success UI that claims payment verified without server confirmation
- No prod reset
- No push without approval
