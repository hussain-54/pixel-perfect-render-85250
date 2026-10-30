import { describe, expect, it } from "vitest";
import {
  countFeeVerificationCancelledHistory,
  countFeeVerificationNeedsCorrection,
  frontDeskCanCoordinateStudent,
  frontDeskRecordCapabilities,
} from "./front-desk-coordination";
import { feeVerificationRowMatchesTab } from "./fee-verification-workflow";
import { frontDeskIntakeFocusSearch } from "./front-desk-workspace";

describe("front desk fee coordination access", () => {
  it("lets any Front Desk open Fix for org-queue students without granting edit/verify", () => {
    expect(
      frontDeskCanCoordinateStudent({
        isAdmin: false,
        isFrontDesk: true,
        isIntakeRegistrar: false,
        hasFeeVerificationRequest: true,
      }),
    ).toBe(true);

    const caps = frontDeskRecordCapabilities({
      isAdmin: false,
      isFrontDesk: true,
      isIntakeRegistrar: false,
      hasFeeVerificationRequest: true,
      assignmentStatus: "pending",
    });
    expect(caps.canOpenRecord).toBe(true);
    expect(caps.canRecordSignupFee).toBe(true);
    expect(caps.canEditRegistration).toBe(false);
    expect(caps.canAssignCounsellor).toBe(false);
    expect(caps.canVerifySignupFee).toBe(false);
  });

  it("blocks non-registrar Front Desk when there is no fee-verification request", () => {
    expect(
      frontDeskCanCoordinateStudent({
        isAdmin: false,
        isFrontDesk: true,
        isIntakeRegistrar: false,
        hasFeeVerificationRequest: false,
      }),
    ).toBe(false);
  });

  it("keeps registrar edit/assign on owned pending records", () => {
    const caps = frontDeskRecordCapabilities({
      isAdmin: false,
      isFrontDesk: true,
      isIntakeRegistrar: true,
      hasFeeVerificationRequest: false,
      assignmentStatus: "pending",
    });
    expect(caps.canEditRegistration).toBe(true);
    expect(caps.canAssignCounsellor).toBe(true);
    expect(caps.canRecordSignupFee).toBe(true);
  });

  it("Fix deep-link carries focus=fee and requestId", () => {
    expect(
      frontDeskIntakeFocusSearch({
        kind: "fee_correction",
        requestId: "req-fix-1",
      }),
    ).toEqual({ focus: "fee", requestId: "req-fix-1" });
  });

  it("splits needs_correction counts from historical cancelled (never lumps all cancelled)", () => {
    const rows = [
      { status: "cancelled", signupFeeStatus: null },
      { status: "cancelled", signupFeeStatus: "unpaid" },
      { status: "cancelled", signupFeeStatus: "verified" },
      { status: "open", signupFeeStatus: "claimed" },
      { status: "resolved", signupFeeStatus: "verified" },
    ];
    expect(countFeeVerificationNeedsCorrection(rows)).toBe(1);
    expect(countFeeVerificationCancelledHistory(rows)).toBe(2);
    expect(feeVerificationRowMatchesTab(rows[0]!, "needs_correction")).toBe(true);
    expect(feeVerificationRowMatchesTab(rows[1]!, "needs_correction")).toBe(false);
    expect(feeVerificationRowMatchesTab(rows[1]!, "cancelled")).toBe(true);
  });
});
