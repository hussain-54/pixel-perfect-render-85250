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

## Notes

- Public pages use static content in `src/data/site.ts`.
- Portal UIs still use mock data in `src/data/mock.ts` via `src/services/index.ts`.
- Supabase client is configured; swap service-layer reads/writes onto it as tables are ready.
- Demo role switcher in the header is for UI preview only — not real authentication.
