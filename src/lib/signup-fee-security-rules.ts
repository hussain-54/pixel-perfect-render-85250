/**
 * Pure mirrors of signup-fee SQL authorization intent (…13010000 / …13020000).
 * These do NOT prove remote RLS — they lock the intended matrix for unit tests.
 * Live RLS must still be verified with owner SQL + authenticated staging E2E.
 */

export type SignupFeeStatus = "unpaid" | "claimed" | "verified" | "waived" | "rejected";
export type FeeVerifyAction = "verify" | "waive" | "reject";

export type FeeActor = {
  isAuthenticated: boolean;
  /** Mirrors can_verify_signup_fee() */
  canVerifySignupFee: boolean;
  /** Mirrors can_access_student(student_id) */
  canAccessStudent: boolean;
  /** Mirrors can_staff_mutate_student(student_id) */
  canStaffMutateStudent: boolean;
  /** Student linked to own profile_id */
  isOwningStudent: boolean;
};

const TERMINAL: ReadonlySet<SignupFeeStatus> = new Set(["verified", "waived", "rejected"]);
const STAFF_EDITABLE: ReadonlySet<SignupFeeStatus> = new Set(["unpaid", "claimed"]);

/** Mirrors signup_fee_select after …13010000 */
export function canSelectSignupFee(actor: FeeActor): boolean {
  if (!actor.isAuthenticated) return false;
  return actor.canVerifySignupFee || actor.canAccessStudent;
}

/**
 * Mirrors signup_fee_update USING + WITH CHECK after …13010000
 * (row-level; column guard covered separately).
 */
export function canUpdateSignupFeeRow(input: {
  actor: FeeActor;
  currentStatus: SignupFeeStatus;
  nextStatus: SignupFeeStatus;
}): boolean {
  const { actor, currentStatus, nextStatus } = input;
  if (!actor.isAuthenticated) return false;

  if (actor.canVerifySignupFee) return true;

  const usingOk =
    actor.canAccessStudent && actor.canStaffMutateStudent && STAFF_EDITABLE.has(currentStatus);
  const withCheckOk = actor.canAccessStudent && STAFF_EDITABLE.has(nextStatus);
  return usingOk && withCheckOk;
}

/** Mirrors enforce_signup_fee_update_guard for non-verifiers */
export function nonVerifierFeeUpdateAllowed(input: {
  canVerifySignupFee: boolean;
  oldStatus: SignupFeeStatus;
  newStatus: SignupFeeStatus;
  studentIdChanged: boolean;
  verificationFieldsChanged: boolean;
}): boolean {
  if (input.studentIdChanged) return false;
  if (input.canVerifySignupFee) return true;
  if (input.newStatus !== input.oldStatus && TERMINAL.has(input.newStatus)) return false;
  if (input.verificationFieldsChanged) return false;
  return true;
}

export function resolveFeeStatusForAction(action: FeeVerifyAction): SignupFeeStatus {
  if (action === "verify") return "verified";
  if (action === "waive") return "waived";
  return "rejected";
}

/** Mirrors RPC: only verified/waived may activate when activate flag is true */
export function rpcShouldActivatePortal(input: {
  action: FeeVerifyAction;
  activatePortal: boolean;
}): boolean {
  if (!input.activatePortal) return false;
  const status = resolveFeeStatusForAction(input.action);
  return status === "verified" || status === "waived";
}

/** Mirrors verify_signup_fee_and_activate auth gate (pre-mutation) */
export function rpcAuthzAllows(
  actor: Pick<FeeActor, "isAuthenticated" | "canVerifySignupFee">,
): boolean {
  return actor.isAuthenticated && actor.canVerifySignupFee;
}

/**
 * Fee-verifier student UPDATE allowlist: only portal_activated_at (+ updated_at) may change.
 * Mirrors to_jsonb(NEW) - keys allowlist in enforce_student_staff_fields.
 */
export function feeVerifierStudentPatchAllowed(changedColumns: string[]): boolean {
  const forbidden = changedColumns.filter((c) => c !== "portal_activated_at" && c !== "updated_at");
  return forbidden.length === 0;
}

/** Students must not self-activate */
export function studentSelfActivationAllowed(): boolean {
  return false;
}

/**
 * Models two-step app path failure: fee written, activation throws.
 * RPC path must not leave this state (single transaction).
 */
export function twoStepLeavesPartialState(input: {
  feeWriteSucceeded: boolean;
  activationSucceeded: boolean;
}): boolean {
  return input.feeWriteSucceeded && !input.activationSucceeded;
}
