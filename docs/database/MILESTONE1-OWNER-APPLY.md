# Milestone 1 — Owner SQL apply + auth link

## Migrations (apply in order)

1. Prerequisites (must already exist):
   - `20261010010000_admission_officer_foundation.sql` — `students`, `profiles`, `can_access_student`, `is_admin`, `set_updated_at`, `handle_new_user`
   - `20261010153000_rls_security_hardening.sql` — **`can_staff_mutate_student`** (required by M1 fee/agreement/handover policies)
2. `20261012010000_milestone1_intake_activation.sql` — signup fees, agreements, handovers, `business_role`, activation columns
3. `20261012020000_milestone1_student_profile_claim.sql` — `claim_own_student_record()` RPC

Local files are **not** proof of remote apply.

## Apply steps

1. Open Supabase Dashboard for project ref **`gjasuvlqfofpvrqvvnyz`** (confirm URL/project picker).
2. SQL Editor → run each migration file above that is not yet applied (paste full file contents, in order).
3. Run read-only checks in [`milestone-1-owner-verification.sql`](./milestone-1-owner-verification.sql).
4. Optionally set `profiles.business_role` for staff (`front_desk_student_affairs`, `accounts_banking_finance`, `admission_team`, …).

**Remote status from engineering:** migrations exist in the repo only. They are **not** confirmed applied on `gjasuvlqfofpvrqvvnyz` until the owner verification script returns expected rows.

## Auth ↔ student link (designed flow)

1. **Front Desk** registers CRM student (`portalIntakeRegisterStudent`). If a `profiles` row already exists for that email, `students.profile_id` is set immediately.
2. Otherwise the student uses **existing** `/sign-up` (`signUpStudent` → Supabase Auth → `handle_new_user` profile). No plaintext passwords stored in app tables.
3. After Auth session is established, the app calls `claim_own_student_record` (and again on `portalGetCurrentStudent`) to set `profile_id` when emails match and `profile_id` is null.
4. **Portal activation** still requires signup fee `verified` or `waived` (`portal_activated_at`). Claimed ≠ verified.
5. Ownership never uses a client-supplied student id.

## What is not done by SQL alone

- Does not create Auth users (student must sign up, or staff must use a future invite that still goes through Auth).
- Does not send email unless Supabase Auth email is configured in the project.
- Does not auto-verify fees.

## Live verification status

Remote apply / authenticated E2E must be confirmed by the owner after running the SQL. Engineering does not claim remote apply from the repo alone.
