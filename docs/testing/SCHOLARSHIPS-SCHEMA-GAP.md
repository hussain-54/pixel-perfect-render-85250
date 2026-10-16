# Scholarships module

**Status:** Live table + app wired. Anon published SELECT verified on project `gjasuvlqfofpvrqvvnyz`.

## Schema

| Object | Present? |
| --- | --- |
| `public.universities` | Yes (anon SELECT may need `20261016030000` for marketing rows) |
| `public.programs` | Yes |
| `public.scholarships` | Yes (`20261016010000`) |
| SELECT RLS fix | `20261016020000` (split published vs staff) — **applied / probe PASS** |
| Offer `scholarship_note` | Unchanged text note |

## Behaviour

- Admin `/admin/scholarships` and public `/scholarships` use live Supabase (no production fixture fallback).
- Public: **published** only. Empty catalog → honest empty state.
- Soft-delete via `archived` (no DELETE grant).

## Probes

```bash
node scripts/probe-scholarships-verify.mjs
node scripts/probe-catalog-anon.mjs
```

Staff CRUD needs `STAGING_ADMIN_JWT` or `STAGING_CONSULTANT_JWT` in untracked `.env`.
