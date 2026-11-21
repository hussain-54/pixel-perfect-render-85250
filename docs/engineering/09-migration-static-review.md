# Static review — foundation migrations + harden file

**Mode:** Option B — **NOT EXECUTED** against any Supabase project from this workspace.  
**Live apply / staging E2E:** **NOT TESTED**. Existing DB must remain untouched.  
**Deep-dive:** `13-migration-risks.md`.

## Apply order (when owner chooses)

1. `20261108120000_website_cms_foundation.sql`
2. `20261108140000_blog_platform_foundation.sql` (depends on CMS `can_mutate_cms` / website-media)
3. `20261108160000_finance_desk_foundation.sql`
4. `20261122120000_blog_promote_and_media_harden.sql` (after blog foundation; **repo only until owner applies**)

## 1. Website CMS (`20261108120000`)

| Topic | Assessment |
| --- | --- |
| Purpose | Draft/publish JSON documents, announcements, media metadata |
| Dependencies | `profiles`, `set_updated_at`, `is_admin()` |
| Public surface | `get_cms_public_*` SECURITY DEFINER — published only |
| RLS | Enabled; table grants narrowed; mutate via `can_mutate_cms()` → `is_admin()` |
| Risks | Public `website-media` allows **SVG** (XSS if served actively); app `settings:2` vs DB `is_admin` **desync** |
| Data impact | Seed document shells `on conflict do nothing` — forward-only |

## 2. Blog (`20261108140000`)

| Topic | Assessment |
| --- | --- |
| Purpose | Authors/categories/tags/posts + public readers |
| Dependencies | CMS mutate helper + website-media bucket |
| Public surface | Published RPCs with `published_at <= now()` |
| Risks | **`promote_scheduled_blog_posts` GRANT EXECUTE TO authenticated** without in-function auth — any logged-in user could call RPC directly (**NEEDS REVIEW** / harden before prod rely) |
| Data impact | New tables only |

## 3. Finance desk (`20261108160000`)

| Topic | Assessment |
| --- | --- |
| Purpose | Office ledger drafts distinct from signup/university fee verify |
| Dependencies | `students`, `profiles` |
| RLS | `can_view_finance_desk` / `can_mutate_finance_desk` on **business_role** list |
| Risks | App uses **module matrix** `banking_finance`; RLS uses role list — possible desync |
| Data impact | New tables; no fee status mutation |

## 4. Harden file (`20261122120000`) — **NOT EXECUTED**

| Topic | Assessment |
| --- | --- |
| Purpose | Gate promote RPC; revoke `authenticated` execute; grant `service_role`; drop SVG from `website-media` + `cms_media` check |
| Dependencies | Blog + CMS foundations |
| Data impact | Function replace + mime policy only — **no data loss** |
| App pairing | `portal-blog` prefers service-role client for promote when configured |

## Recommendations (owner)

1. Apply harden migration after the three foundations on non-prod; confirm promote via service-role path.  
2. Align finance desk RLS with `business_module_permissions` or document intentional role-only DB gate.  
3. Apply only after backup; never from agent without explicit approval.

**Status:** Static review **PASS** (documentation). Execution **BLOCKED** by Option B / not requested.
