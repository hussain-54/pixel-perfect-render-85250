# Migration-dependent features and graceful degrade

**DB apply status:** foundation + harden migrations remain **NOT EXECUTED** in this workspace (Option B).

| Feature | Requires | Current degrade behavior |
| --- | --- | --- |
| Admin Website CMS mutate/publish | `20261108120000` | `schemaReady: false` + SCHEMA_NOTE; public site uses fallback bundle / unpublished drafts never exposed |
| Admin/public Blog | `20261108140000` | empty/fallback via `isMissingBlogRelation`; dashboard `schemaReady: false` + note; no fake posts |
| Banking desk ledger | `20261108160000` | FinanceDesk shows `schemaReady` false + honest note; no mock posted ledger success |
| Scheduled blog promote RPC | harden `20261122120000` when applied | Until then: known `authenticated` EXECUTE risk if foundation applied alone; app prefers service-role promote when admin key configured |
| Public website-media without SVG | harden `20261122120000` | App already rejects SVG uploads; bucket may still allow SVG until SQL applied |

## UI honesty checks (code)

- CMS / Blog admin surfaces surface schema notes — no silent “saved” success against missing tables.
- Finance desk gates write UI when `!schemaReady`.
- Live CRM stubs (`portalGetStudents` / `portalGetStudent`) return `[]` / `null` on Supabase sessions — never demo fixtures.

## Owner apply reminder

Apply on non-prod first: CMS → Blog → Finance desk → Harden. Then smoke publish/promote/desk draft before production.
