import { describe, expect, it } from "vitest";
import {
  FEE_VERIFIER_QUEUE_STATUSES,
  R1_MIGRATION_FILENAME,
  R1_REMOTE_PROOF_REQUIRED,
  feeVerifierPolicyAllowsStudentSelect,
  studentHasOpenFeeQueue,
  studentsSelectAllowedAfterR1,
} from "./r1-fee-verifier-select-rules";
import { STUDENTS_SENSITIVE_COLUMNS } from "./m1-registrar-select-rules";

const accounts = {
  isAuthenticated: true,
  canVerifySignupFee: true,
  isAdmin: false,
  isAssignedConsultantOnRow: false,
  isStudentSelfProfile: false,
};

describe("R1 fee-verifier students SELECT (queue scope)", () => {
  it("documents the forward migration filename", () => {
    expect(R1_MIGRATION_FILENAME).toBe(
      "20261014090000_students_select_fee_verifier_queue_scope.sql",
    );
    expect(FEE_VERIFIER_QUEUE_STATUSES).toEqual(["unpaid", "claimed"]);
  });

  it("allows fee-verifier SELECT only for unpaid/claimed queue students", () => {
    expect(studentHasOpenFeeQueue("unpaid")).toBe(true);
    expect(studentHasOpenFeeQueue("claimed")).toBe(true);
    expect(studentHasOpenFeeQueue("verified")).toBe(false);
    expect(studentHasOpenFeeQueue("waived")).toBe(false);
    expect(studentHasOpenFeeQueue(null)).toBe(false);

    expect(
      feeVerifierPolicyAllowsStudentSelect({
        actor: accounts,
        openFeeQueue: true,
      }),
    ).toBe(true);
    expect(
      feeVerifierPolicyAllowsStudentSelect({
        actor: accounts,
        openFeeQueue: false,
      }),
    ).toBe(false);
  });

  it("denies unrelated-student SELECT for Accounts (no open fee, not assigned)", () => {
    expect(
      studentsSelectAllowedAfterR1({
        actor: accounts,
        openFeeQueue: false,
      }),
    ).toBe(false);
  });

  it("permits fee-queue access for Accounts while preserving Admin/assignment OR paths", () => {
    expect(
      studentsSelectAllowedAfterR1({
        actor: accounts,
        openFeeQueue: true,
      }),
    ).toBe(true);

    expect(
      studentsSelectAllowedAfterR1({
        actor: {
          ...accounts,
          canVerifySignupFee: false,
          isAdmin: true,
        },
        openFeeQueue: false,
      }),
    ).toBe(true);

    expect(
      studentsSelectAllowedAfterR1({
        actor: {
          ...accounts,
          canVerifySignupFee: false,
          isAssignedConsultantOnRow: true,
        },
        openFeeQueue: false,
      }),
    ).toBe(true);

    expect(
      studentsSelectAllowedAfterR1({
        actor: {
          isAuthenticated: true,
          canVerifySignupFee: false,
          isAdmin: false,
          isAssignedConsultantOnRow: false,
          isStudentSelfProfile: false,
        },
        openFeeQueue: true,
      }),
    ).toBe(false);
  });

  it("records that queue allow still exposes sensitive columns (row-level residual)", () => {
    expect(STUDENTS_SENSITIVE_COLUMNS).toContain("dob");
    expect(R1_REMOTE_PROOF_REQUIRED.length).toBeGreaterThanOrEqual(4);
  });
});
