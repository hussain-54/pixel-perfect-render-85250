# Global Roots Consultants — Forensic Audit Report

> Last updated after frontend audit + cleanup.
> Taste Skill: **NOT AVAILABLE** — design principles applied manually.

---

## A. Executive Summary

This is a **TanStack Start + React 19 + Tailwind CSS v4** project for **Global Roots Consultants**.

**Before this audit:** marketing site was largely branded correctly, but root HTML metadata still said “Lovable App”, favicon was generic, fonts were declared but not loaded, and **student/staff/admin portals were completely missing** despite mock data, services, JourneyTracker, and RoleSwitcher links.

**After this audit:**

- App-facing Lovable branding/metadata removed
- Global Roots title, OG, theme-color, SVG favicon
- Fonts loaded (Manrope + Fraunces)
- Premium sticky header polish
- Full demo portals wired on existing mock data
- Vite config replaced with native TanStack Start + Nitro (Vercel-friendly; Lovable vite wrapper removed)
- TypeScript: **PASS**
- Lint: **PASS** (0 errors; 9 shadcn-only warnings)
- Local `vite build` hung in this Windows environment due to file locks; verify on a clean machine / Vercel

**Supabase / backend was intentionally not implemented.**

---

## B. Current Architecture

| Layer     | Detail                                                        |
| --------- | ------------------------------------------------------------- |
| Framework | TanStack Start + TanStack Router (file routes)                |
| UI        | React 19, Tailwind 4, Radix/shadcn under `src/components/ui/` |
| Data      | `src/data/mock.ts` + async facade `src/services/index.ts`     |
| Marketing | `src/data/site.ts`                                            |
| Build     | Vite 8 + `tanstackStart()` + `nitro()` + `@tailwindcss/vite`  |
| Deploy    | `vercel.json` → `framework: "tanstack-start"`                 |
| Auth / DB | None (demo RoleSwitcher only)                                 |
| Supabase  | None                                                          |

---

## C. Routes

### Public

`/`, `/about`, `/contact`, `/destinations`, `/universities`, `/programs`, `/scholarships`, `/services`, `/student-visa`, `/success-stories`, `/resources`

### Student portal

`/student` → `/student/dashboard`, appointments, documents, applications, profile, notifications

### Staff portal

`/staff` → `/staff/dashboard`, students, appointments, applications, documents, leads, activity

### Admin panel

`/admin` → dashboard, leads, students, appointments, applications, documents, universities, programs, scholarships, consultants, leaderboard, reports, import-export, notifications, audit-logs, settings

---

## D–I. UI / UX / Responsive / A11y / Perf / Quality

| Area            | Verdict                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| Homepage        | Strong editorial structure; brand elevated in hero; brand palette consistent             |
| Header          | Sticky white bar, logo left, nav center (xl+), search + CTA right, polished mobile sheet |
| Student journey | JourneyTracker shows completed / current / upcoming + next action                        |
| Documents       | “Action Required” banner for Needs Correction / Rejected                                 |
| Leaderboard     | Internal-only demo with period + metric filters                                          |
| Responsive      | Container + grid patterns sound; xl nav collapse; portal sidebar sheet on small screens  |
| A11y            | Labels, aria on menu/search, focus rings; forms labeled                                  |
| Performance     | Images already sized reasonably; no new heavy deps                                       |
| Code quality    | Portals reuse services/common/StatusBadge; shadcn kit still largely unused by marketing  |

---

## J. Lovable Artifacts Removed

| Item                                    | Action                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `__root.tsx` Lovable title/meta/Twitter | **Replaced** with Global Roots                                                               |
| `README.md` Lovable ownership           | **Rewritten**                                                                                |
| `@lovable.dev/vite-tanstack-config`     | **Removed**; replaced with native Vite config                                                |
| `lovable-error-reporting.ts`            | **Replaced** by `runtime-error-reporting.ts` (optional legacy hooks kept for editor preview) |
| `bunfig.toml` Lovable excludes          | **Cleaned**                                                                                  |
| `AGENTS.md` / `.lovable/`               | **Kept** (editor/git sync safety; not user-facing UI)                                        |

---

## K. Branding / Favicon / Header Changes

- Brand: **Global Roots Consultants**
- Tagline: **Global Education & Visa Consultants**
- Title: `Global Roots Consultants | Global Education & Visa Consultants`
- Favicon: `public/favicon.svg` (+ legacy `favicon.ico` alternate)
- Apple touch: `public/apple-touch-icon.svg`
- Theme color: `#001A3F`
- Palette in `styles.css` matches navy / royal / bright / surface / muted / borders
- Logo: refined SVG mark (no separate PNG asset was present in the repo)
- Header: sticky, white, subtle scroll shadow, Book Consultation CTA

---

## L. Taste Skill

**NOT AVAILABLE** in Cursor skills/MCP. Manual polish applied (hierarchy, spacing, brand-first hero, less template chrome).

---

## M. Build / Test Results

| Check              | Result                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit` | **PASS**                                                                                                                                                                            |
| `npm run lint`     | **PASS** (0 errors, 9 react-refresh warnings in shadcn UI)                                                                                                                          |
| `npm run build`    | **INCONCLUSIVE locally** — Vite process hangs under Windows file-lock contention in this environment; prior `.output` SSR chunks for portals exist. Re-run on clean shell / Vercel. |

---

## N. Fixed Issues

| ID     | Priority | Area       | File                        | Problem                                    | Status                                    |
| ------ | -------- | ---------- | --------------------------- | ------------------------------------------ | ----------------------------------------- |
| GR-001 | CRITICAL | Portals    | missing routes              | RoleSwitcher linked to nonexistent portals | **FIXED** — portals built on mock data    |
| GR-002 | CRITICAL | Branding   | `__root.tsx`                | Lovable page title/meta                    | **FIXED**                                 |
| GR-003 | HIGH     | Favicon    | `public/`                   | Generic favicon                            | **FIXED** — SVG brand mark                |
| GR-004 | HIGH     | Typography | `__root.tsx` / `styles.css` | Fonts unused                               | **FIXED** — Google Fonts link             |
| GR-005 | HIGH     | Docs       | `README.md`                 | Lovable ownership copy                     | **FIXED**                                 |
| GR-006 | HIGH     | Deploy     | `vite.config.ts`            | Cloudflare-oriented Lovable wrapper        | **FIXED** — Nitro + Vercel framework flag |
| GR-007 | MEDIUM   | Header     | `SiteLayout.tsx`            | Template feel                              | **FIXED** — polished sticky header        |
| GR-009 | MEDIUM   | Student UX | `JourneyTracker` unused     | Stage unclear                              | **FIXED** — mounted on student dashboard  |
| GR-010 | MEDIUM   | Search     | `SiteLayout.tsx`            | Blur/search UX                             | **FIXED**                                 |
| GR-013 | MEDIUM   | SEO        | `__root.tsx`                | Missing theme-color / icons                | **FIXED**                                 |
| GR-017 | COSMETIC | README     | `README.md`                 | Pixel Perfect copy                         | **FIXED**                                 |
| GR-020 | MEDIUM   | Forms      | `blocks.tsx`                | No demo disclosure                         | **FIXED**                                 |

---

## O. Remaining Issues

| ID     | Priority | Area      | File                     | Problem                                        | Recommended Fix                                                 | Dependencies | Status           |
| ------ | -------- | --------- | ------------------------ | ---------------------------------------------- | --------------------------------------------------------------- | ------------ | ---------------- |
| GR-015 | LOW      | Contact   | `contact.tsx` / footer   | Placeholder phone `+92 300 0000000`            | Replace with real numbers                                       | Business     | PENDING          |
| GR-008 | MEDIUM   | Brand     | `Logo.tsx`               | Official PNG/SVG logo file not in repo         | Drop provided logo into `public/` + wire Logo                   | Asset        | PENDING          |
| GR-011 | MEDIUM   | Deps      | `src/components/ui/*`    | Many unused shadcn primitives                  | Prune after backend phase                                       | Frontend     | PENDING          |
| GR-018 | COSMETIC | Tooling   | `AGENTS.md`, `.lovable/` | Lovable sync notes remain                      | Keep while connected to Lovable git; remove when fully detached | Process      | DO NOT TOUCH YET |
| GR-022 | MEDIUM   | Security  | RoleSwitcher             | Demo role switch has no auth                   | Real auth + RLS                                                 | Backend      | PENDING          |
| GR-023 | HIGH     | Build env | local Windows            | `vite build` hangs intermittently (file locks) | Clean `node_modules`, close locks, rebuild; or build on Vercel  | Ops          | PENDING          |
| GR-019 | HIGH     | Backend   | N/A                      | No persistence                                 | Supabase later                                                  | Backend      | PENDING          |

---

## P. Recommended Next Steps

1. Provide official Global Roots logo file if different from SVG mark.
2. Run `npm run build` on a clean environment / Vercel.
3. Replace placeholder phone numbers.
4. Implement Supabase auth, schema, RLS, storage (separate Cursor task).
5. Gate portals behind real roles; remove public RoleSwitcher when live.
6. Optionally prune unused shadcn components.

---

## Q. BACKEND ITEMS TO IMPLEMENT LATER WITH CURSOR

| ID     | Priority | Area          | Problem                             | Status  |
| ------ | -------- | ------------- | ----------------------------------- | ------- |
| GR-B01 | HIGH     | Auth          | No login / session / role claims    | PENDING |
| GR-B02 | HIGH     | Students      | Profile + stage persistence         | PENDING |
| GR-B03 | HIGH     | Documents     | Upload/storage + review workflow    | PENDING |
| GR-B04 | HIGH     | Appointments  | Booking, confirm, reschedule        | PENDING |
| GR-B05 | HIGH     | Applications  | University application CRUD         | PENDING |
| GR-B06 | MEDIUM   | Leads         | Lead capture from consultation form | PENDING |
| GR-B07 | MEDIUM   | Notifications | Real-time / email                   | PENDING |
| GR-B08 | MEDIUM   | Leaderboard   | Period aggregation                  | PENDING |
| GR-B09 | MEDIUM   | Audit logs    | Immutable trail                     | PENDING |
| GR-B10 | LOW      | Import/Export | CSV import/export                   | PENDING |

---

## Security notes

- No secrets, API keys, or `SUPABASE_SERVICE_ROLE_KEY` in frontend source.
- Demo emails/phones are fictional mock data.
- Runtime error reporting only calls optional `window` hooks (no network secret leakage).

---

_End of report._
