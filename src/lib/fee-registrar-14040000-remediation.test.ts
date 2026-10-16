/**
 * Local contract for …14040000 missing-only remediation readiness.
 * Does NOT prove remote catalog or JWT RLS.
 */
import { describe, expect, it } from "vitest";
import { M1_MIGRATION_ORDER } from "./m1-registrar-select-rules";
import {
  SIGNUP_FEE_RLS_INTEGRATION_MATRIX,
  canInsertSignupFee,
  canSelectSignupFee,
  isFrontDeskFeeRegistrar,
  type FeeActor,
} from "./signup-fee-security-rules";

const FEE_REGISTRAR_MIGRATION = "20261014040000_signup_fee_fd_registrar_only.sql";

/** Surfaces that R1/R2 touch — must not overlap fee policy rewrite. */
const R1_R2_SURFACES = {
  r1: "students_select_fee_verifier on public.students",
  r2: "front_desk_assign_counsellor return type",
  feeRegistrar: "signup_fee_* on public.signup_fee_payments + is_front_desk_fee_registrar",
} as const;

describe("…14040000 fee-registrar remediation contract (local)", () => {
  it("places …14040000 after …14030000 and before …14050000 in M1 order", () => {
    const i400 = M1_MIGRATION_ORDER.findIndex((f) => f.includes("14040000"));
    const i300 = M1_MIGRATION_ORDER.findIndex((f) => f.includes("14030000"));
    const i500 = M1_MIGRATION_ORDER.findIndex((f) => f.includes("14050000"));
    expect(i400).toBeGreaterThanOrEqual(0);
    expect(i300).toBeLessThan(i400);
    expect(i400).toBeLessThan(i500);
    expect(M1_MIGRATION_ORDER[i400]).toBe(FEE_REGISTRAR_MIGRATION);
  });

  it("documents non-overlap with R1/R2 surfaces", () => {
    expect(R1_R2_SURFACES.r1).toContain("students");
    expect(R1_R2_SURFACES.r2).toContain("front_desk_assign_counsellor");
    expect(R1_R2_SURFACES.feeRegistrar).toContain("signup_fee");
    expect(R1_R2_SURFACES.feeRegistrar).not.toContain("students_select_fee_verifier");
    expect(R1_R2_SURFACES.feeRegistrar).not.toContain("front_desk_assign_counsellor");
  });

  it("mirrors Option 3: FD registrar allowed; counsellor-only registrar denied on fee SELECT/INSERT", () => {
    const fdRegistrar: FeeActor = {
      isAuthenticated: true,
      canVerifySignupFee: false,
      canAccessStudent: false,
      canStaffMutateStudent: false,
      isIntakeRegistrar: true,
      isFrontDesk: true,
      isAdmin: false,
      isOwningStudent: false,
    };
    const counsellorRegistrar: FeeActor = {
      ...fdRegistrar,
      isFrontDesk: false,
    };

    expect(isFrontDeskFeeRegistrar(fdRegistrar)).toBe(true);
    expect(isFrontDeskFeeRegistrar(counsellorRegistrar)).toBe(false);
    expect(canSelectSignupFee(fdRegistrar)).toBe(true);
    expect(canSelectSignupFee(counsellorRegistrar)).toBe(false);
    expect(
      canInsertSignupFee({
        actor: fdRegistrar,
        canRecordIntake: true,
        status: "unpaid",
        verifiedBySet: false,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: true,
      }),
    ).toBe(true);
    expect(
      canInsertSignupFee({
        actor: counsellorRegistrar,
        canRecordIntake: true,
        status: "unpaid",
        verifiedBySet: false,
        verifiedAtSet: false,
        recordedByIsSelfOrNull: true,
      }),
    ).toBe(false);
  });

  it("keeps integration matrix cells as evidence checklist (not remote PASS)", () => {
    const counsellorCell = SIGNUP_FEE_RLS_INTEGRATION_MATRIX.find(
      (c) => c.actor === "Counsellor registrar (not assigned)",
    );
    expect(counsellorCell?.expected).toMatch(/deny/i);
    const fdCell = SIGNUP_FEE_RLS_INTEGRATION_MATRIX.find((c) => c.actor === "FD-A");
    expect(fdCell?.expected).toMatch(/is_front_desk_fee_registrar/);
  });
});
