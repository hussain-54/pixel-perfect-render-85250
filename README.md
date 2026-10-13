# Global Roots Consultants

Global Education & Visa Consultants — public marketing site and demo portals (student, consultant, admin).

## Stack

- TanStack Start + TanStack Router
- React 19
- Tailwind CSS v4
- Vite 8

## Development

```sh
npm install
npm run dev
```

## Scripts

| Command           | Purpose                  |
| ----------------- | ------------------------ |
| `npm run dev`     | Local development server |
| `npm run build`   | Production build         |
| `npm run preview` | Preview production build |
| `npm run lint`    | ESLint                   |

## Environment

Copy `.env.example` to `.env` and set your Supabase project values:

```sh
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

This is a **Vite** app, so client-exposed vars use the `VITE_` prefix (not `NEXT_PUBLIC_`).

The shared client lives in `src/lib/supabase.ts`:

```ts
import { supabase, getSupabase, isSupabaseConfigured } from "@/lib/supabase";
```

## Sign in

Unified entry point: [`/sign-in`](./src/routes/sign-in.tsx).

After authentication, role is resolved automatically and the user is redirected to:

- Student → `/student/dashboard`
- Consultant → `/staff/dashboard`
- Admin → `/admin/dashboard`

Supabase Auth is required for real portals. Assign roles via trusted `app_metadata.role` or `profiles.role` (`student` \| `consultant` \| `admin` \| `super_admin`). Never use `user_metadata` for authorization.

**Local development only:** `npm run dev` may enable temporary demo sessions for UI wiring. Production builds disable demo authentication entirely (including if `VITE_ENABLE_DEMO_AUTH` is set). Do not publish demo passwords.

## Notes

- Public marketing pages use static content in `src/data/site.ts` (illustrative, not live CRM).
- Portal CRM for Supabase sessions uses live server functions; mock fixtures in `src/data/mock.ts` are demo-session / test only.
- Owner database apply: see `docs/database/M1-M4-OWNER-RUNBOOK.md`.
