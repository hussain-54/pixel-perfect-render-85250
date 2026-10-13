# Auth password redirects (production)

Canonical production origin: `https://globalroots.pk`

## App / Vercel

Set server env (Production), then Redeploy:

- `APP_ORIGIN=https://globalroots.pk` (preferred for Auth redirect construction)
- `SUPABASE_SERVICE_ROLE_KEY` (or alias `SUPABASE_SECRET_KEY`) — server-only, never `VITE_*`

## Supabase Dashboard → Authentication → URL Configuration

- **Site URL:** `https://globalroots.pk`
- **Redirect URLs allow-list** (add all that apply):
  - `https://globalroots.pk/reset-password`
  - `https://globalroots.pk/change-password` (optional; recovery uses `/reset-password`)
  - Local/preview only when intentionally testing: `http://localhost:<port>/reset-password`

Do not point recovery links at `/sign-in`. Do not allow arbitrary wildcard redirects.

## Flows

| Flow | Path |
| --- | --- |
| Forgot password | `/forgot-password` → email → `/reset-password` |
| First login (temp password) | Sign in → `/change-password` (forced via `app_metadata.must_change_password`) |
| Change password | Portal sidebar → `/change-password` |
| Admin create account | Direct `auth.admin.createUser` + temp password (no invite email) |
| Admin reset | Set temp password (out-of-band) or email reset link to `/reset-password` |

No SQL migration is required for `must_change_password` (Auth `app_metadata`, Admin API only).
