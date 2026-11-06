# Website CMS foundation — owner apply

**Migration:** `supabase/migrations/20261108120000_website_cms_foundation.sql`

## Why

Public website content (header, nav, footer, homepage copy, announcements) was hardcoded. This migration adds draft/publish CMS tables with admin-only RLS and public published readers.

## Apply on staging / production

1. Open the Supabase SQL editor for project `gjasuvlqfofpvrqvvnyz` (or your staging project).
2. Paste and run the **full updated** contents of `20261108120000_website_cms_foundation.sql`.
   - If a previous run failed on `position` (reserved keyword), re-run this file — it renames any partial `position` column to `display_position` and recreates the public RPCs.
3. Confirm:
   - Tables: `cms_documents`, `cms_revisions`, `cms_announcements`, `cms_media`
   - RPCs: `get_cms_public_documents`, `get_cms_public_announcements`
   - Storage bucket: `website-media`
4. Sign in as Admin → **Website Management**.
5. Open Header / Homepage / Footer → **Save Draft** → **Publish**.
6. Confirm the public homepage reflects published content (hardcoded defaults remain until first publish).

## Security notes

- Drafts are never returned by public RPCs.
- Only `is_admin()` authenticated users can mutate CMS tables.
- Announcement public RPC returns only `status = published` rows inside the start/end window.

## Rollback

Forward-only. Do not drop tables if published content already exists without an export backup.
