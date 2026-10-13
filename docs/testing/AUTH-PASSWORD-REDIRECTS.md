# Auth password redirects (production)

Canonical production origin: `https://globalroots.pk`

## App / Vercel

Set server env (Production), then Redeploy:

- `APP_ORIGIN=https://globalroots.pk` (preferred for Auth redirect construction)
- `SUPABASE_SERVICE_ROLE_KEY` (or alias `SUPABASE_SECRET_KEY`) — server-only, never `VITE_*`
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` must match the same Supabase project on client and server

## Supabase Dashboard → Authentication → URL Configuration

- **Site URL:** `https://globalroots.pk`
- **Redirect URLs allow-list:**
  - `https://globalroots.pk/reset-password`
  - Local/preview only when intentionally testing: `http://localhost:<port>/reset-password`

Do not point recovery links at `/sign-in`. Do not allow arbitrary wildcard redirects.

## Flows

| Flow                     | Path                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Sign in                  | `/sign-in` → role home (`/staff/dashboard` for consultants)                                    |
| Forgot password          | `/forgot-password` → email → `/reset-password`                                                 |
| Optional change password | Portal → `/change-password` (requires current password + live session)                         |
| Admin create account     | Direct `auth.admin.createUser` + temp password (no invite email, no forced first-login change) |
| Admin reset              | Set temp password (sessions revoked) or email reset link to `/reset-password`                  |

`app_metadata.must_change_password` is **not** enforced. Existing accounts that still have the flag can sign in normally; the flag is ignored.

## Session note (production bug fixed)

Auth Admin `updateUserById({ password })` revokes active sessions. Employee self-service password change therefore uses the **user session** `auth.updateUser` after server verification of the current password, so the next portal request still validates with `getUser(jwt)`.
