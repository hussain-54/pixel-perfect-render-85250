# Signup-fee security review — `…13010000` / `…13020000`

**Date:** 2026-10-13 (deep review pass)  
**Project:** `gjasuvlqfofpvrqvvnyz`  
**Scope:** SQL definitions vs foundation/M1 helpers — **hypothesis until remote owner SQL confirms**  
**Status:** Migrations **corrected in repo** — **not applied**, RPC **not wired**

---

## Intended role matrix (confirmed against helpers)

| Actor | `can_verify_signup_fee` | `can_access_student` / mutate | Fee verify | Portal activate |
|-------|-------------------------|-------------------------------|------------|-----------------|
| Student | false | own row access only | No | No (self-activate blocked in trigger) |
| Front Desk / assigned consultant | false | yes if assigned | No (claim only) | No |
| Accounts / Finance / Manager / Admin | true | **often false** (not assignment-scoped) | Yes (org-wide) | Yes via RPC (security definer) |
| Unrelated staff | false | false | No | No |

**Helper facts (repo migrations):**
- `can_verify_signup_fee()` — `is_admin()` OR `business_role ∈ {accounts_banking_finance, manager, admin}` (`20261012010000`)
- `can_access_student(uuid)` — admin OR assigned consultant OR own `profile_id` (`20261010010000`)
- `can_staff_mutate_student(uuid)` — admin OR assigned consultant (`20261010153000`)
- `students_update_staff` — admin OR assigned consultant only
- `students_select_access` — own / assigned / admin (no Accounts)

---

## Findings (ranked)

### Critical

1. **Accounts blocked by `can_access_student` (pre-correction)**  
   **Files:** prior draft of `…13010000`, `…13020000`; helpers `can_access_student`, `can_verify_signup_fee`  
   Requiring `can_access_student` for fee verify broke the intended Accounts matrix (finance is org-wide, not caseload).  
   **Correction applied in repo:** fee SELECT/UPDATE authorize `can_verify_signup_fee()` without assignment; RPC authz is `auth.uid()` + `can_verify_signup_fee()` only.

2. **Accounts cannot UPDATE `students` under RLS (activation path)**  
   **Files:** `students_update_staff`, `enforce_student_staff_fields`, `verify_signup_fee_and_activate`  
   Two-step app updates leave partial state; invoker RPC would fail activation.  
   **Correction applied in repo:** SECURITY DEFINER RPC + allowlisted trigger path for `portal_activated_at`.

### High

3. **Fee-verifier trigger denylist was incomplete (pre-correction)**  
   **File/function:** `enforce_student_staff_fields` in `…13020000`  
   Explicit column denylist omitted many `students` columns (`phone`, `destination`, etc.).  
   **Correction:** `to_jsonb` allowlist — only `portal_activated_at` (+ `updated_at`) may differ.

4. **App visibility still assignment-scoped for consultants**  
   **File:** `src/server/ao-data.ts` `listVisibleStudentsDb`  
   Even after SQL fix, `portalVerifySignupFee` + `assertStudentVisibleDb` will block unassigned Accounts until app wiring changes. **Do not wire RPC without addressing this.** Not changed in this review (execution restriction).

5. **`students_select_fee_verifier` broadens Accounts SELECT**  
   **File:** `…13020000`  
   Required for finance UI to load student rows; grants org-wide student row SELECT to fee verifiers. Owner must accept this privilege before apply.

### Medium

6. **Reject does not clear `portal_activated_at`**  
   **Function:** `verify_signup_fee_and_activate`  
   Re-reject after prior verify+activate leaves portal active. Documented; change only if product requires deactivation.

7. **Non-verifier can still edit amount/notes/method on unpaid|claimed**  
   **Policy:** `signup_fee_update`  
   Intentional for intake/claim; trigger now blocks `verified_by` / `verified_at` forgery.

8. **No down-migration**  
   Forward-only; rollback = restore prior `enforce_student_staff_fields` + drop RPC/policies manually.

### Low

9. **Unit tests cannot prove live RLS**  
   Pure mirrors in `signup-fee-security-rules.ts` lock intent only; staging JWT probes required.

10. **Duplicate verify overwrites `verified_at`**  
    Idempotent status; audit timestamp moves — acceptable.

---

## Migration verdicts

| Migration | Verdict | Notes |
|-----------|---------|-------|
| `20261013010000_signup_fee_update_restrict.sql` | **Safe to apply to staging after M1 confirmed** (post-correction) | Owner approval still required |
| `20261013020000_signup_fee_verify_activate_rpc.sql` | **Safe to apply to staging after `…13010000` + M1** (post-correction) | Owner must accept Accounts student SELECT; **do not wire app yet** |

**Unsafe if applied as the pre-review drafts** that required `can_access_student` for verifiers and used incomplete denylists — those drafts are replaced in-repo.

---

## Exact SQL corrections (now in migration files)

### `…13010000`
- `signup_fee_select`: `can_verify_signup_fee() OR can_access_student(student_id)`
- `signup_fee_update`: verifier path without assignment; staff path unpaid/claimed only
- Trigger `enforce_signup_fee_update_guard`: blocks `student_id` change; non-verifiers blocked from terminal statuses and `verified_by`/`verified_at`

### `…13020000`
- Policy `students_select_fee_verifier` for `can_verify_signup_fee()`
- `enforce_student_staff_fields`: jsonb allowlist for fee verifiers; students cannot set `portal_activated_at`
- RPC: auth checks first; `FOR UPDATE` fee lock; activate only for verified/waived; SECURITY DEFINER; `search_path = public`; revoke PUBLIC/anon; grant `authenticated` only

---

## Staging verification checklist (expected outcomes)

Run [`STAGING-OWNER-VERIFICATION.sql`](./STAGING-OWNER-VERIFICATION.sql) then:

| Check | Expected after both migrations |
|-------|--------------------------------|
| S0 project ref | Dashboard `gjasuvlqfofpvrqvvnyz` |
| `has_can_verify_signup_fee` | true |
| `signup_fee_select` qual | mentions `can_verify_signup_fee` |
| `signup_fee_update` with_check | verifier OR unpaid/claimed |
| `enforce_signup_fee_update_guard` | exists; trigger enabled on `signup_fee_payments` |
| `has_verify_signup_fee_and_activate` | true |
| `verify_signup_fee_and_activate` | `security_definer = true`; execute to `authenticated` only |
| `enforce_student_staff_fields` | mentions `can_verify_signup_fee` / `portal_activated_at` |
| `students_select_fee_verifier` | present |
| JWT: Student UPDATE fee → verified | **deny** |
| JWT: Front Desk UPDATE fee → verified | **deny** |
| JWT: Accounts RPC verify+activate | **allow**; both rows commit |
| JWT: Student UPDATE own `portal_activated_at` | **deny** |
| Concurrent RPC same fee | serialized; no split fee/activation |

Authenticated probes remain **NOT RUN** until owner provides disposable JWTs.

---

## Tests (code-level)

| Suite | Role |
|-------|------|
| `src/lib/signup-fee-security-rules.test.ts` | Negative authz, claim vs verify, activation rules, partial-write model, allowlist |
| `src/lib/signup-fee-gate.test.ts` | Activation gate + partial failure message |

These **do not** establish remote RLS correctness.

---

## Next owner-approved step

1. Run `STAGING-OWNER-VERIFICATION.sql` on `gjasuvlqfofpvrqvvnyz` (read-only).  
2. If M1 confirmed: approve apply **`…13010000`**, re-check fee policies/trigger.  
3. Approve apply **`…13020000`**, re-check RPC + `students_select_fee_verifier`.  
4. Only then: separate engineering change to wire `portalVerifySignupFee` to the RPC **and** fix Accounts student visibility in `ao-data` / intake (out of scope until owner says so).  

**Stop:** no remote apply, no app wire, no production claim.
