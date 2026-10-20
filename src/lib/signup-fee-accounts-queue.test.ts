import { describe, expect, it } from "vitest";
import { canVerifySignupFeeAction } from "@/lib/staff-business-access";
import { FEE_VERIFIER_QUEUE_STATUSES, studentHasOpenFeeQueue } from "@/lib/r1-fee-verifier-select-rules";
import { isSignupFeeVerified, canActivatePortalFromFeeStatus } from "@/lib/signup-fee-gate";

describe("Accounts signup fee queue rules", () => {
  it("keeps claimed distinct from verified and blocks portal activation", () => {
    expect(isSignupFeeVerified("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
    expect(isSignupFeeVerified("verified")).toBe(true);
    expect(isSignupFeeVerified("waived")).toBe(true);
  });

  it("queues only unpaid and claimed for Accounts verification", () => {
    expect(FEE_VERIFIER_QUEUE_STATUSES).toEqual(["unpaid", "claimed"]);
    expect(studentHasOpenFeeQueue("unpaid")).toBe(true);
    expect(studentHasOpenFeeQueue("claimed")).toBe(true);
    expect(studentHasOpenFeeQueue("verified")).toBe(false);
  });

  it("allows Accounts to verify and denies Front Desk verify", () => {
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
    expect(
      canVerifySignupFeeAction({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
  });
});
