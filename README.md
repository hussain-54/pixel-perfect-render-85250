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

## Notes

- Public pages use static content in `src/data/site.ts`.
- Portal UIs use mock data in `src/data/mock.ts` via `src/services/index.ts`.
- Backend / Supabase is intentionally not wired yet.
- Demo role switcher in the header is for UI preview only — not real authentication.
