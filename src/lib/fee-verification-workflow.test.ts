import { describe, expect, it } from "vitest";
import {
  admissionHandoverBlockedByFeeMessage,
  canRequestFeeVerification,
  feeStatusAllowsAdmissionHandover,
  feeVerificationStatusesForTab,
  feeVerificationTabForStatus,
  frontDeskCanSeeFeeVerificationRequest,
  normalizeAssessmentEligibilityForDraft,
  normalizeRpcRowList,
  validateFeeVerificationRequestSummary,
} from "./fee-verification-workflow";

describe("fee verification workflow", () => {
  it("allows admission handover only after verified or waived", () => {
    expect(feeStatusAllowsAdmissionHandover("claimed")).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("rejected")).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("verified")).toBe(true);
    expect(feeStatusAllowsAdmissionHandover("waived")).toBe(true);
    expect(admissionHandoverBlockedByFeeMessage()).toMatch(/Accounts/i);
  });

  it("requires assessment, consent, and no open duplicate before request", () => {
    expect(
      canRequestFeeVerification({
        hasAssessment: true,
        hasConsent: true,
        hasOpenRequest: false,
        isAssignedCounsellorOrAdmin: true,
      }).ok,
    ).toBe(true);
    expect(
      canRequestFeeVerification({
        hasAssessment: false,
        hasConsent: true,
        hasOpenRequest: false,
        isAssignedCounsellorOrAdmin: true,
      }).ok,
    ).toBe(false);
    expect(
      canRequestFeeVerification({
        hasAssessment: true,
        hasConsent: true,
        hasOpenRequest: true,
        isAssignedCounsellorOrAdmin: true,
      }).ok,
    ).toBe(false);
  });

  it("validates summary length and draft eligibility default", () => {
    expect(validateFeeVerificationRequestSummary("short").ok).toBe(false);
    expect(validateFeeVerificationRequestSummary("Please verify claimed signup fee.").ok).toBe(
      true,
    );
    expect(normalizeAssessmentEligibilityForDraft("")).toBe("Pending Review");
    expect(normalizeAssessmentEligibilityForDraft("Good Fit")).toBe("Good Fit");
  });

  it("lets any Front Desk desk see the coordination queue (verify still separate)", () => {
    const fd = "fd-a";
    expect(
      frontDeskCanSeeFeeVerificationRequest({
        isAdmin: false,
        canVerifySignupFee: false,
        isFrontDesk: true,
        viewerUserId: fd,
        registrarId: "other-fd",
        studentRegisteredBy: "other-fd",
      }),
    ).toBe(true);
    expect(
      frontDeskCanSeeFeeVerificationRequest({
        isAdmin: false,
        canVerifySignupFee: false,
        isFrontDesk: false,
        viewerUserId: fd,
        registrarId: fd,
        studentRegisteredBy: fd,
      }),
    ).toBe(false);
    expect(feeVerificationTabForStatus("in_progress")).toBe("awaiting_finance");
    expect(feeVerificationStatusesForTab("open")).toEqual(["open"]);
    expect(normalizeRpcRowList(null)).toEqual([]);
    expect(normalizeRpcRowList({ id: "1" })).toEqual([{ id: "1" }]);
    expect(normalizeRpcRowList([{ id: "1" }, { id: "2" }])).toHaveLength(2);
  });
});
