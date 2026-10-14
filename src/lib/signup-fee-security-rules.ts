/**
 * Pure mirrors of signup-fee SQL authorization intent
 * (…13010000 / …13020000 / …14030000 / …14040000 FD-only registrar arm).
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
  /** Mirrors is_intake_registrar(student_id) */
  isIntakeRegistrar: boolean;
  /** Mirrors is_front_desk() */
  isFrontDesk: boolean;
  /** Mirrors is_admin() */
  isAdmin: boolean;
  /** Student linked to own profile_id */
  isOwningStudent: boolean;
};

const TERMINAL: ReadonlySet<SignupFeeStatus> = new Set(["verified", "waived", "rejected"]);
const STAFF_EDITABLE: ReadonlySet<SignupFeeStatus> = new Set(["unpaid", "claimed"]);

/** Mirrors is_front_desk_fee_registrar(student_id) after …14040000 */
export function isFrontDeskFeeRegistrar(actor: FeeActor): boolean {
  return actor.isIntakeRegistrar && (actor.isFrontDesk || actor.isAdmin);
}

/** Mirrors signup_fee_select after …14040000 */
export function canSelectSignupFee(actor: FeeActor): boolean {
  if (!actor.isAuthenticated) return false;
  return actor.canVerifySignupFee || actor.canAccessStudent || isFrontDeskFeeRegistrar(actor);
}

/** Mirrors signup_fee_insert WITH CHECK after …14040000 */
export function canInsertSignupFee(input: {
  actor: FeeActor;
  canRecordIntake: boolean;
  status: SignupFeeStatus;
  verifiedBySet: boolean;
  verifiedAtSet: boolean;
  recordedByIsSelfOrNull: boolean;
}): boolean {
  const { actor } = input;
  if (!actor.isAuthenticated || !input.canRecordIntake) return false;
  if (!(actor.canAccessStudent || isFrontDeskFeeRegistrar(actor))) return false;
  if (!actor.canVerifySignupFee && !STAFF_EDITABLE.has(input.status)) return false;
  if (input.verifiedBySet || input.verifiedAtSet) return false;
  if (!input.recordedByIsSelfOrNull) return false;
  return true;
}

/**
 * Mirrors signup_fee_update USING + WITH CHECK after …14040000
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

  const registrar = isFrontDeskFeeRegistrar(actor);
  const usingOk =
    ((actor.canAccessStudent && actor.canStaffMutateStudent) || registrar) &&
    STAFF_EDITABLE.has(currentStatus);
  const withCheckOk = (actor.canAccessStudent || registrar) && STAFF_EDITABLE.has(nextStatus);
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
 * App + RPC authz for verify: app gates Front Desk / matrix; RPC requires can_verify_signup_fee.
 * Assignment-scoped can_access_student is intentionally NOT required (org-wide Accounts).
 */
export function appAllowsVerifySignupFeeCall(input: {
  isFrontDesk: boolean;
  appLayerCanVerify: boolean;
}): boolean {
  if (input.isFrontDesk) return false;
  return input.appLayerCanVerify;
}

/** Successful RPC path must not leave a separate student UPDATE to the app. */
export function verifyPathUsesAtomicRpcOnly(): boolean {
  return true;
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

/**
 * Documented PostgreSQL RLS integration matrix (…14040000).
 * Not executed here — staging JWT/SQL must mark each cell PASS/FAIL with evidence.
 */
export const SIGNUP_FEE_RLS_INTEGRATION_MATRIX = [
  {
    actor: "FD-A",
    action: "SELECT/INSERT/UPSERT unpaid|claimed on own registration",
    expected: "allow via is_front_desk_fee_registrar",
  },
  {
    actor: "FD-B",
    action: "SELECT/UPSERT on FD-A student fee",
    expected: "deny",
  },
  {
    actor: "Counsellor registrar (not assigned)",
    action: "INSERT fee on student they registered",
    expected: "deny (not FD; no can_access_student)",
  },
  {
    actor: "Counsellor assigned",
    action: "UPSERT unpaid|claimed when can_staff_mutate",
    expected: "allow via can_access_student path (matrix Edit may still block in app)",
  },
  {
    actor: "Accounts/verifier",
    action: "SELECT any; verify via RPC / UPDATE terminal",
    expected: "allow via can_verify_signup_fee",
  },
  {
    actor: "Admin",
    action: "registrar arm if they registered; else access/verify paths",
    expected: "allow",
  },
  {
    actor: "Student",
    action: "SELECT own fee; INSERT/verify",
    expected: "SELECT via can_access_student; mutate verify deny",
  },
  {
    actor: "Anon",
    action: "EXECUTE is_front_desk_fee_registrar / fee table",
    expected: "deny",
  },
] as const;
