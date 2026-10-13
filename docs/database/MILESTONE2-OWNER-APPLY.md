# Milestone 2 — University finance (owner apply)

**Migration:** `supabase/migrations/20261012030000_milestone2_university_finance.sql`

## Scope

- Adds `university_fee_obligations` (application/tuition/offer deposit/visa/other).
- **Keeps** `signup_fee_payments` and offer `deposits` separate.
- Claimed ≠ verified; verification uses `can_verify_signup_fee()` / Accounts business roles.

## Prerequisites

Milestone 1 migrations applied, including `can_verify_signup_fee` and `can_staff_mutate_student`.

## Apply

1. Confirm M1 applied on project **`gjasuvlqfofpvrqvvnyz`** (see `MILESTONE1-OWNER-APPLY.md`).
2. SQL Editor on that same project → run `20261012030000_milestone2_university_finance.sql`.
3. Run read-only checks in [`milestone-2-owner-verification.sql`](./milestone-2-owner-verification.sql).

**Remote status from engineering:** M2 migration is generated in-repo only. Not confirmed applied remotely without owner verification results.
