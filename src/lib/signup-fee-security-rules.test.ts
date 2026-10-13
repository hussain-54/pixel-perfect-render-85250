import { describe, expect, it } from "vitest";
import {
  canSelectSignupFee,
  canUpdateSignupFeeRow,
  feeVerifierStudentPatchAllowed,
  nonVerifierFeeUpdateAllowed,
  resolveFeeStatusForAction,
  rpcAuthzAllows,
  rpcShouldActivatePortal,
  studentSelfActivationAllowed,
  twoStepLeavesPartialState,
  type FeeActor,
} from "./signup-fee-security-rules";

const student: FeeActor = {
  isAuthenticated: true,
  canVerifySignupFee: false,
  canAccessStudent: true,
  canStaffMutateStudent: false,
  isOwningStudent: true,
};

const frontDeskAssigned: FeeActor = {
  isAuthenticated: true,
  canVerifySignupFee: false,
  canAccessStudent: true,
  canStaffMutateStudent: true,
  isOwningStudent: false,
};

const accountsUnassigned: FeeActor = {
  isAuthenticated: true,
  canVerifySignupFee: true,
  canAccessStudent: false,
  canStaffMutateStudent: false,
  isOwningStudent: false,
};

const unrelatedStaff: FeeActor = {
  isAuthenticated: true,
  canVerifySignupFee: false,
  canAccessStudent: false,
  canStaffMutateStudent: false,
  isOwningStudent: false,
};

const anon: FeeActor = {
  isAuthenticated: false,
  canVerifySignupFee: false,
  canAccessStudent: false,
  canStaffMutateStudent: false,
  isOwningStudent: false,
};

describe("signup fee SELECT matrix (…13010000)", () => {
  it("allows Accounts without assignment and denies unrelated staff", () => {
    expect(canSelectSignupFee(accountsUnassigned)).toBe(true);
    expect(canSelectSignupFee(frontDeskAssigned)).toBe(true);
    expect(canSelectSignupFee(student)).toBe(true);
    expect(canSelectSignupFee(unrelatedStaff)).toBe(false);
    expect(canSelectSignupFee(anon)).toBe(false);
  });
});

describe("signup fee UPDATE matrix (…13010000)", () => {
  it("denies student terminal and claim status changes", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: student,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(false);
    expect(
      canUpdateSignupFeeRow({
        actor: student,
        currentStatus: "claimed",
        nextStatus: "verified",
      }),
    ).toBe(false);
  });

  it("allows Front Desk claim path but not verify", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: frontDeskAssigned,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(true);
    expect(
      canUpdateSignupFeeRow({
        actor: frontDeskAssigned,
        currentStatus: "claimed",
        nextStatus: "verified",
      }),
    ).toBe(false);
  });

  it("allows Accounts verify without can_access_student", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: accountsUnassigned,
        currentStatus: "claimed",
        nextStatus: "verified",
      }),
    ).toBe(true);
  });

  it("denies unrelated staff", () => {
    expect(
      canUpdateSignupFeeRow({
        actor: unrelatedStaff,
        currentStatus: "unpaid",
        nextStatus: "claimed",
      }),
    ).toBe(false);
  });
});

describe("fee update guard (trigger mirror)", () => {
  it("blocks student_id change and non-verifier terminal/audit fields", () => {
    expect(
      nonVerifierFeeUpdateAllowed({
        canVerifySignupFee: false,
        oldStatus: "claimed",
        newStatus: "claimed",
        studentIdChanged: true,
        verificationFieldsChanged: false,
      }),
    ).toBe(false);

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
        oldStatus: "claimed",
        newStatus: "claimed",
        studentIdChanged: false,
        verificationFieldsChanged: true,
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

describe("RPC verify + activate (…13020000 mirrors)", () => {
  it("requires authentication and can_verify before mutations", () => {
    expect(rpcAuthzAllows({ isAuthenticated: false, canVerifySignupFee: true })).toBe(false);
    expect(rpcAuthzAllows({ isAuthenticated: true, canVerifySignupFee: false })).toBe(false);
    expect(rpcAuthzAllows({ isAuthenticated: true, canVerifySignupFee: true })).toBe(true);
  });

  it("only verified/waived activate; reject never activates", () => {
    expect(rpcShouldActivatePortal({ action: "verify", activatePortal: true })).toBe(true);
    expect(rpcShouldActivatePortal({ action: "waive", activatePortal: true })).toBe(true);
    expect(rpcShouldActivatePortal({ action: "reject", activatePortal: true })).toBe(false);
    expect(rpcShouldActivatePortal({ action: "verify", activatePortal: false })).toBe(false);
    expect(resolveFeeStatusForAction("reject")).toBe("rejected");
  });

  it("fee-verifier student patches are allowlisted", () => {
    expect(feeVerifierStudentPatchAllowed(["portal_activated_at"])).toBe(true);
    expect(feeVerifierStudentPatchAllowed(["portal_activated_at", "updated_at"])).toBe(true);
    expect(feeVerifierStudentPatchAllowed(["portal_activated_at", "email"])).toBe(false);
    expect(feeVerifierStudentPatchAllowed(["journey_stage"])).toBe(false);
  });

  it("students cannot self-activate", () => {
    expect(studentSelfActivationAllowed()).toBe(false);
  });

  it("documents two-step partial-write hazard the RPC must eliminate", () => {
    expect(twoStepLeavesPartialState({ feeWriteSucceeded: true, activationSucceeded: false })).toBe(
      true,
    );
    expect(twoStepLeavesPartialState({ feeWriteSucceeded: true, activationSucceeded: true })).toBe(
      false,
    );
  });
});
