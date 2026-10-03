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

Supabase Auth is used when configured. Until real users exist, these demo accounts work locally:

| Email | Password | Portal |
| ----- | -------- | ------ |
| `student@globalroots.pk` | `demo1234` | Student |
| `consultant@globalroots.pk` | `demo1234` | Consultant |
| `admin@globalroots.pk` | `demo1234` | Admin |

Assign Supabase user roles via `app_metadata.role` / `user_metadata.role` (`student` \| `staff` \| `consultant` \| `admin`) or a `profiles.role` column.

## Notes

- Public pages use static content in `src/data/site.ts`.
- Portal UIs still use mock data in `src/data/mock.ts` via `src/services/index.ts`.
- Supabase client is configured; swap service-layer reads/writes onto it as tables are ready.
- Portal chrome still includes a demo role switcher for UI preview.
