# Migration risk deep-dive (static only)

**Mode:** Option B — **NOT EXECUTED / NOT TESTED live** against any Supabase project.  
**Files:** `20261108120000`, `20261108140000`, `20261108160000`, `20261122120000` (harden).

## Apply order (owner, non-prod first)

1. `20261108120000_website_cms_foundation.sql`
2. `20261108140000_blog_platform_foundation.sql`
3. `20261108160000_finance_desk_foundation.sql`
4. `20261122120000_blog_promote_and_media_harden.sql` (after blog foundation)

---

## `20261108120000` — Website CMS

| Check | Finding |
| --- | --- |
| Syntax / deps | Needs `profiles`, `set_updated_at`, `is_admin()` from AO foundation |
| RLS / grants | RLS on; mutate via `can_mutate_cms()` → `is_admin()`; public readers are SECURITY DEFINER published-only RPCs |
| Storage | Creates/updates `website-media` public bucket; **SVG in allowlist** until harden applied |
| Indexes | Folder/time indexes on media; key uniqueness on documents |
| Conflict vs AO | Additive tables; seed shells `on conflict do nothing` |
| Data-loss risk | **None** (create-if-not-exists + seed no-op) |

## `20261108140000` — Blog

| Check | Finding |
| --- | --- |
| Syntax / deps | Requires CMS `can_mutate_cms` + `website-media` |
| RLS / grants | Admin mutate via `can_mutate_cms`; public published readers |
| RPC risk | `promote_scheduled_blog_posts` **GRANT EXECUTE TO authenticated** with no in-function auth (**NEEDS REVIEW** until harden) |
| Triggers / indexes | Revision indexes; promote called from public readers (side effect) |
| Conflict vs AO | New blog_* tables only |
| Data-loss risk | **None** |

## `20261108160000` — Finance desk

| Check | Finding |
| --- | --- |
| Syntax / deps | `students`, `profiles` |
| RLS | `can_view_finance_desk` / `can_mutate_finance_desk` on business_role lists (may desync from app module matrix) |
| Fee integrity | Desk ledger does not mutate signup/university fee status |
| Data-loss risk | **None** (new tables) |

## `20261122120000` — Harden (repo file only)

| Check | Finding |
| --- | --- |
| Promote | Requires `can_mutate_cms()` or `service_role` before updates; else return `0` |
| Grants | `REVOKE` from `authenticated`/`anon`/`public`; `GRANT EXECUTE` to `service_role` |
| Media | Drops SVG from `website-media` `allowed_mime_types` + `cms_media` mime check |
| Data-loss risk | **None** (function replace + mime policy; no DROP TABLE) |
| Live status | **NOT EXECUTED** — owner must apply after foundation trio |

## Backward compatibility

- Harden changes promote privilege model: app prefers service-role client for promote (`portal-blog.ts`).
- Until harden is applied, foundation grant risk remains if blog SQL is applied alone.
- Historical SVG allowlist in CMS foundation remains in history; superseded by harden when applied.

**Static review:** PASS for documentation. **Execution:** BLOCKED by Option B.
