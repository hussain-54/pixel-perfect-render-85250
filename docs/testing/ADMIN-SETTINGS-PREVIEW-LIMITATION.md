# Admin Settings — persistence status

**Status:** Implemented against singleton `public.organization_settings` (migration `20261016100000_organization_settings.sql`). Live save requires owner-applied migration + JWT data plane.

## Schema gap (established before migration)

Existing schema could **not** store organization-wide Settings without inventing unsafe columns:

| Candidate | Why insufficient |
| --- | --- |
| `profiles` | Only `id`, `email`, `full_name`, `phone`, `role`, `business_role`, timestamps — no preferences / org jsonb |
| Permission matrix (`business_module_permissions`) | Access levels only; not org profile fields |
| Notifications tables | Per-user notification rows; not org preference flags |
| No prior `*_settings` table | Confirmed absent from `database.ts` / migrations |

Therefore a dedicated singleton table was added (not profile-column invention, not a duplicate of an existing settings store).

## What persists (after migration)

| Field | Column | Notes |
| --- | --- | --- |
| Consultancy name | `consultancy_name` | Validated server-side |
| Support email | `support_email` | Validated server-side |
| Portal footer note | `portal_footer_note` | Max 1000 chars |
| Email admins on new leads | `email_admins_on_new_leads` | **Preference flag only** — does not send email by itself |
| Student document alerts | `student_document_alerts` | **Preference flag only** — delivery remains on Notifications tools |

## Authorization

- **View:** `settings` matrix ≥ 1; Front Desk denied; RLS `can_view_organization_settings()` (`is_admin` or business role `manager`/`admin`).
- **Update:** technical `admin`/`super_admin` + `settings` matrix ≥ 2; RLS `can_mutate_organization_settings()` = `is_admin()` only.
- Changes audited via `write_audit_event` action `organization_settings.update`.
- No service-role exposure; no auth/password flow changes.

## Navigation-only (System tab)

- Import / Export, Audit Logs, Change password — links only; not settings rows.

## Owner action

Apply `supabase/migrations/20261016100000_organization_settings.sql` with confirmation before claiming live persistence in staging/production.
