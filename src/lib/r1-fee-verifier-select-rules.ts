/**
 * Pure mirrors of R1 students_select_fee_verifier queue-scope intent
 * (…14090000). Does NOT prove remote RLS — locks the intended matrix for tests.
 *
 * Production residual before apply: USING (can_verify_signup_fee()) alone = org-wide.
 */

export type FeeQueueStatus = "unpaid" | "claimed" | "verified" | "waived" | "rejected";

/** Statuses that keep a student on the Accounts fee-verification queue. */
export const FEE_VERIFIER_QUEUE_STATUSES = ["unpaid", "claimed"] as const;

export type FeeVerifierSelectActor = {
  isAuthenticated: boolean;
  /** Mirrors can_verify_signup_fee() */
  canVerifySignupFee: boolean;
  /** Mirrors students_select_access arms */
  isAdmin: boolean;
  isAssignedConsultantOnRow: boolean;
  isStudentSelfProfile: boolean;
};

export function studentHasOpenFeeQueue(status: FeeQueueStatus | null | undefined): boolean {
  return status === "unpaid" || status === "claimed";
}

/**
 * Mirrors students_select_fee_verifier after …14090000 (this policy arm only).
 * Does not model students_select_access OR.
 */
export function feeVerifierPolicyAllowsStudentSelect(input: {
  actor: Pick<FeeVerifierSelectActor, "isAuthenticated" | "canVerifySignupFee">;
  openFeeQueue: boolean;
}): boolean {
  if (!input.actor.isAuthenticated) return false;
  if (!input.actor.canVerifySignupFee) return false;
  return input.openFeeQueue;
}

/**
 * Combined permissive OR after …14090000 for a single students row.
 * True ⇒ REST select=* may return the row (full columns).
 */
export function studentsSelectAllowedAfterR1(input: {
  actor: FeeVerifierSelectActor;
  openFeeQueue: boolean;
}): boolean {
  const { actor } = input;
  if (!actor.isAuthenticated) return false;
  if (actor.isAdmin) return true;
  if (actor.isAssignedConsultantOnRow) return true;
  if (actor.isStudentSelfProfile) return true;
  return feeVerifierPolicyAllowsStudentSelect({
    actor,
    openFeeQueue: input.openFeeQueue,
  });
}

/** R1 closure is local-only until JWT REST proves deny on unrelated students. */
export const R1_MIGRATION_FILENAME =
  "20261014090000_students_select_fee_verifier_queue_scope.sql" as const;

export const R1_REMOTE_PROOF_REQUIRED = [
  "Accounts JWT: GET /students?select=*&id=eq.<no_open_fee> → empty/deny",
  "Accounts JWT: GET /students?select=*&id=eq.<unpaid_or_claimed> → allow (full row residual)",
  "Accounts JWT: rpc verify_signup_fee_and_activate still succeeds",
  "Admin JWT: GET /students?select=* still allow via students_select_access",
  "FD JWT: can_verify_signup_fee() false → fee-verifier arm never matches",
] as const;
