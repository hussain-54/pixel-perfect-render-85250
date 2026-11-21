import { describe, expect, it } from "vitest";
import {
  canFullyApproveModule,
  resolveBusinessRoleFromTrustedAppRole,
} from "./business-permissions";
import {
  assertUniversityFeeVerifyTransition,
  canVerifyUniversityFeePayment,
} from "./university-fee-auth";
import type { UniversityFeeStatusDb } from "@/types/database";

function isVerifiedUniversityFee(status: UniversityFeeStatusDb) {
  return status === "verified" || status === "waived";
}

describe("M2 university fee rules", () => {
  it("keeps claimed distinct from verified", () => {
    expect(isVerifiedUniversityFee("claimed")).toBe(false);
    expect(isVerifiedUniversityFee("due")).toBe(false);
    expect(isVerifiedUniversityFee("verified")).toBe(true);
  });

  it("requires claimed before verify/reject; allows waive from due", () => {
    expect(() => assertUniversityFeeVerifyTransition({ current: "due", action: "verify" })).toThrow(
      /must be claimed/i,
    );
    expect(() =>
      assertUniversityFeeVerifyTransition({ current: "claimed", action: "verify" }),
    ).not.toThrow();
    expect(() =>
      assertUniversityFeeVerifyTransition({ current: "due", action: "waive" }),
    ).not.toThrow();
    expect(() =>
      assertUniversityFeeVerifyTransition({ current: "verified", action: "verify" }),
    ).toThrow(/already finalized/i);
  });

  it("denies counsellor verification of university fees via matrix", () => {
    const role = resolveBusinessRoleFromTrustedAppRole("consultant");
    expect(canFullyApproveModule(role, "fees_payments")).toBe(false);
    expect(canFullyApproveModule(role, "banking_finance")).toBe(false);
    expect(canVerifyUniversityFeePayment({ appRole: "consultant", businessRole: role })).toBe(
      false,
    );
  });

  it("allows accounts/admin verification via matrix", () => {
    expect(canFullyApproveModule("accounts_banking_finance", "fees_payments")).toBe(true);
    expect(canFullyApproveModule("admin", "banking_finance")).toBe(true);
    expect(
      canVerifyUniversityFeePayment({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    expect(canVerifyUniversityFeePayment({ appRole: "admin", businessRole: "admin" })).toBe(true);
  });

  it("keeps signup fees separate from university fee kinds", () => {
    const universityKinds = [
      "application_fee",
      "tuition",
      "offer_deposit",
      "visa_fee",
      "other",
    ] as const;
    expect(universityKinds).not.toContain("signup_fee");
  });
});
