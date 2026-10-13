# Milestone 3 — Digital Marketing (owner apply)

**Target project:** `gjasuvlqfofpvrqvvnyz`  
**Status:** Migration files are **generated in the repo only**. Remote apply is **not confirmed**.

## Migrations (forward-only, apply in order)

| File | Depends on |
|------|------------|
| `supabase/migrations/20261012050000_milestone3_digital_marketing.sql` | M1 consultation / profiles / `business_role` enum patterns |
| `supabase/migrations/20261012051000_milestone3_marketing_archive_history.sql` | `20261012050000` (`marketing_campaigns`, `consultation_requests.campaign_id`) |

## What they add

- `marketing_campaigns` (+ later `archived_at`)
- `consultation_requests.campaign_id`, `attribution_source`, `original_attribution_source`
- `marketing_attribution_history`
- RLS helpers `can_access_marketing` / `can_mutate_marketing` (boolean `coalesce` pattern — never cast `''` into `business_role`)

## Owner steps

1. Confirm Dashboard project ref is exactly `gjasuvlqfofpvrqvvnyz`.
2. Apply `20261012050000` then `20261012051000` via approved migration path (or SQL Editor if that is your process).
3. Verify tables/columns exist; spot-check RLS with an authenticated non-admin session.
4. Do **not** treat local `supabase db` success as remote proof.

## App surface

- `/admin/marketing` — campaigns, archive, attribution, history, inquiry counts + email-match registered students (`n/a` when student emails unavailable).
