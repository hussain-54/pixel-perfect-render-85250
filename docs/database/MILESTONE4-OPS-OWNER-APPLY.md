# Milestone 4 — Office Operations (owner apply)

**Target project:** `gjasuvlqfofpvrqvvnyz`  
**Status:** Migration file is **generated in the repo only**. Remote apply is **not confirmed**.

## Migration

| File | Depends on |
|------|------------|
| `supabase/migrations/20261012060000_milestone4_office_operations.sql` | Profiles / `business_role` enum including `office_ops`; audit helpers used by app |

## Tables

- `ops_suppliers`, `ops_inventory_items`
- `ops_purchase_orders`, `ops_purchase_lines`
- `ops_stock_movements` (inventory qty changes only via receive/adjust/issue)
- `ops_sales_orders` (operational sales — **not** student tuition)
- `ops_expenses` (claimed/reviewed status — **not** verified payments)

RLS: `can_access_office_ops` / `can_mutate_office_ops` using boolean coalesce (never `''::business_role`).

## Owner steps

1. Confirm project ref `gjasuvlqfofpvrqvvnyz`.
2. Apply `20261012060000` after M1–M3 prerequisites you intend to use in production.
3. Verify tables + policies; no seed/fake production rows are required.
4. Document apply time and any errors for engineering.

## App surface

- `/admin/operations` — suppliers, POs, receiving, ops sales, expenses dashboard.
- Permissions: `orders_sales_purchase` / `office_ops` business role; Accounts may view expenses but not mutate inventory/POs via this module.
