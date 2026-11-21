---
name: globalroots-finance-integrity
description: >-
  Protect GlobalRoots financial integrity — signup/university fees, vouchers,
  banking finance desk ledger, segregation of duties, and audit trails. Use for
  any fee verification, ledger, or accounts desk change.
---

# GlobalRoots Finance Integrity

## Purpose / triggers

Apply on signup fee, university fee, voucher PDF, fee verification queue, banking desk draft/post/reverse, or reports touching money.

## Repo inspection steps

1. Signup fees: `portal-intake.ts` (record, verify, queue, voucher); migrations `*signup_fee*`, `*fee_verification*`.
2. University finance: `portal-finance.ts`, `m2` rules, milestone2 migration.
3. Banking desk: `portal-finance-desk.ts`, `FinanceDesk` UI, `20261108160000_finance_desk_foundation.sql` — office ledger + balances overview; **not** a substitute for Fees & Payments verification.
4. SoD: registrar vs verifier rules (`signup-fee-security-rules`, FD registrar-only migrations).
5. Audit: `write_audit_event` / immutable audit usage on verify/post/reverse.
6. Client: never trust client-supplied “verified” status.

## Execution steps

1. Status transitions must be server-side and RPC-aligned.
2. Idempotent verify where possible; reject duplicate verify with clear error.
3. Desk entries: draft → post → reverse with authz (`banking_finance` module).
4. Explain any new migration impact; owner applies SQL — do not apply to production unattended.

## Quality / security constraints

- Amounts and statuses from DB after mutation, not optimistic fake success.
- Cash/ledger math covered by unit tests (`signup-fee-ledger*`, `finance-desk*`).

## Testing requirements

- Vitest for status rules, SoD, desk post/reverse.
- Staging E2E for verify flows only if approved.

## Deliverables

- Finance integrity findings; SoD gaps; migration apply checklist.

## Never-do

- No service-role in client
- No RLS weakening
- No mock financial success (UI or server)
- No silent amount overrides without audit
- No prod reset / force push
- No push without approval
