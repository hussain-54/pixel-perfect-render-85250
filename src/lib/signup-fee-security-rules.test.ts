import { describe, expect, it } from "vitest";
import {
  SIGNUP_FEE_RLS_INTEGRATION_MATRIX,
  appAllowsVerifySignupFeeCall,
  canInsertSignupFee,
  canSelectSignupFee,
  canUpdateSignupFeeRow,
  feeVerifierStudentPatchAllowed,
  isFrontDeskFeeRegistrar,
  nonVerifierFeeUpdateAllowed,
  resolveFeeStatusForAction,
  rpcAuthzAllows,
  rpcShouldActivatePortal,
  studentSelfActivationAllowed,
  twoStepLeavesPartialState,
  verifyPathUsesAtomicRpcOnly,
  type FeeActor,
} from "./signup-fee-security-rules";

function actor(partial: Partial<FeeActor>): FeeActor {
  return {
    isAuthenticated: true,
    canVerifySignupFee: false,
    canAccessStudent: false,
    canStaffMutateStudent: false,
    isIntakeRegistrar: false,
    isFrontDesk: false,
    isAdmin: false,
    isOwningStudent: false,
    ...partial,
  };
}

const student = actor({ canAccessStudent: true, isOwningStudent: true });
const frontDeskAssigned = actor({
  canAccessStudent: true,
  canStaffMutateStudent: true,
});
/** Front Desk registrar without assignment-scoped can_access_student */
const frontDeskRegistrarOnly = actor({
  isIntakeRegistrar: true,
  isFrontDesk: true,
});
/** Counsellor who registered but is not FD and not assigned */
const counsellorRegistrarOnly = actor({
  isIntakeRegistrar: true,
  isFrontDesk: false,
});
const otherRegistrar = actor({});
const accountsUnassigned = actor({ canVerifySignupFee: true });
const unrelatedStaff = actor({});
const anon = actor({ isAuthenticated: false });

describe("signup fee SELECT matrix (…14040000 FD-only registrar) — unit mirrors", () => {
  it("allows Accounts without assignment and denies unrelated staff", () => {
    expect(canSelectSignupFee(accountsUnassigned)).toBe(true);
    expect(canSelectSignupFee(frontDeskAssigned)).toBe(true);
    expect(canSelectSignupFee(student)).toBe(true);
    expect(canSelectSignupFee(unrelatedStaff)).toBe(false);
    expect(canSelectSignupFee(anon)).toBe(false);
  });

  it("allows FD registrar; denies counsellor-only registrar; isolates other registrars", () => {
    expect(isFrontDeskFeeRegistrar(frontDeskRegistrarOnly)).toBe(true);
    expect(isFrontDeskFeeRegistrar(counsellorRegistrarOnly)).toBe(false);
    expect(canSelectSignupFee(frontDeskRegistrarOnly)).toBe(true);
    expect(canSelectSignupFee(counsellorRegistrarOnly)).toBe(false);
    expect(canSelectSignupFee(otherRegistrar)).toBe(false);
  });
});

describe("signup fee INSERT matrix (…14040000) — unit mirrors", () => {
  it("allows Front Desk registrar unpaid/claimed with self recorded_by", () => {
    expect(
      canInsertSignupFee({
        actor: frontDeskRegistrarOnly,
        canRecordIntake: true,
        status: "claimed",
        verifiedBySet: false,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: true,
      }),
    ).toBe(true);
  });

  it("denies counsellor registrar fee insert (no FD, no can_access_student)", () => {
    expect(
      canInsertSignupFee({
        actor: counsellorRegistrarOnly,
        canRecordIntake: true,
        status: "unpaid",
        verifiedBySet: false,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: true,
      }),
    ).toBe(false);
  });

  it("denies registrar spoofing verified status or recorded_by", () => {
    expect(
      canInsertSignupFee({
        actor: frontDeskRegistrarOnly,
        canRecordIntake: true,
        status: "verified",
        verifiedBySet: false,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: true,
      }),
    ).toBe(false);
    expect(
      canInsertSignupFee({
        actor: frontDeskRegistrarOnly,
        canRecordIntake: true,
        status: "unpaid",
        verifiedBySet: true,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: true,
      }),
    ).toBe(false);
    expect(
      canInsertSignupFee({
        actor: frontDeskRegistrarOnly,
        canRecordIntake: true,
        status: "unpaid",
        verifiedBySet: false,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: false,
      }),
    ).toBe(false);
  });
});

describe("signup fee UPDATE matrix (…14040000) — unit mirrors", () => {
  it("allows FD registrar UPSERT claim; denies counsellor registrar", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: frontDeskRegistrarOnly,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(true);
    expect(
      canUpdateSignupFeeRow({
        actor: counsellorRegistrarOnly,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(false);
  });

  it("allows assigned staff claim path and Accounts verify", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: frontDeskAssigned,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(true);
    expect(
      canUpdateSignupFeeRow({
        actor: accountsUnassigned,
        currentStatus: "claimed",
        nextStatus: "verified",
      }),
    ).toBe(true);
  });

  it("denies student claim and FD terminal verify via table update", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: student,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(false);
    expect(
      canUpdateSignupFeeRow({
        actor: frontDeskRegistrarOnly,
        currentStatus: "claimed",
        nextStatus: "verified",
      }),
    ).toBe(false);
  });
});

describe("fee update guard (trigger mirror) — unit", () => {
  it("blocks student_id change and non-verifier terminal/audit fields", () => {
    expect(
      nonVerifierFeeUpdateAllowed({
        canVerifySignupFee: false,
        oldStatus: "claimed",
        newStatus: "verified",
        studentIdChanged: false,
        verificationFieldsChanged: false,
      }),
    ).toBe(false);
    expect(
      nonVerifierFeeUpdateAllowed({
        canVerifySignupFee: false,
        oldStatus: "unpaid",
        newStatus: "claimed",
        studentIdChanged: false,
        verificationFieldsChanged: false,
      }),
    ).toBe(true);
  });
});

describe("RPC verify + activate mirrors — unit", () => {
  it("requires authentication and can_verify; app denies Front Desk", () => {
    expect(rpcAuthzAllows({ isAuthenticated: true, canVerifySignupFee: true })).toBe(true);
    expect(appAllowsVerifySignupFeeCall({ isFrontDesk: true, appLayerCanVerify: true })).toBe(
      false,
    );
    expect(verifyPathUsesAtomicRpcOnly()).toBe(true);
    expect(rpcShouldActivatePortal({ action: "reject", activatePortal: true })).toBe(false);
    expect(resolveFeeStatusForAction("waive")).toBe("waived");
    expect(feeVerifierStudentPatchAllowed(["portal_activated_at", "email"])).toBe(false);
    expect(studentSelfActivationAllowed()).toBe(false);
    expect(twoStepLeavesPartialState({ feeWriteSucceeded: true, activationSucceeded: false })).toBe(
      true,
    );
  });
});

describe("documented staging RLS integration matrix (not executed)", () => {
  it("lists required JWT/SQL cells for FD-A/B, counsellor, Accounts, admin, student, anon", () => {
    expect(SIGNUP_FEE_RLS_INTEGRATION_MATRIX.length).toBeGreaterThanOrEqual(8);
    const actors = SIGNUP_FEE_RLS_INTEGRATION_MATRIX.map((r) => r.actor);
    expect(actors).toEqual(
      expect.arrayContaining([
        "FD-A",
        "FD-B",
        "Counsellor registrar (not assigned)",
        "Accounts/verifier",
        "Admin",
        "Student",
        "Anon",
      ]),
    );
  });
});
