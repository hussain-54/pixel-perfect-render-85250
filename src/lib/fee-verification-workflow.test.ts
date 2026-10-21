import { describe, expect, it } from "vitest";
import {
  admissionHandoverBlockedByFeeMessage,
  canRequestFeeVerification,
  describeFeeClaimDisplay,
  feeStatusAllowsAdmissionHandover,
  feeVerificationStatusesForTab,
  feeVerificationTabForStatus,
  frontDeskCanSeeFeeVerificationRequest,
  normalizeAssessmentEligibilityForDraft,
  normalizeRpcRowList,
  requestCompletedWithoutFeeAuthorization,
  requestStuckAfterFeeDecision,
  signupFeeIsTerminalDecision,
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

  it("treats fee-request notes as optional (no min length)", () => {
    expect(validateFeeVerificationRequestSummary("").ok).toBe(true);
    expect(validateFeeVerificationRequestSummary("short").ok).toBe(true);
    expect(validateFeeVerificationRequestSummary("Please verify claimed signup fee.").ok).toBe(
      true,
    );
    expect(validateFeeVerificationRequestSummary("x".repeat(2001)).ok).toBe(false);
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

  it("detects fee-verified but request still pending (reconcile candidate)", () => {
    expect(signupFeeIsTerminalDecision("verified")).toBe(true);
    expect(signupFeeIsTerminalDecision("claimed")).toBe(false);
    expect(
      requestStuckAfterFeeDecision({
        requestStatus: "in_progress",
        signupFeeStatus: "verified",
      }),
    ).toBe(true);
    expect(
      requestStuckAfterFeeDecision({
        requestStatus: "in_progress",
        signupFeeStatus: "claimed",
      }),
    ).toBe(false);
    expect(
      requestStuckAfterFeeDecision({
        requestStatus: "resolved",
        signupFeeStatus: "verified",
      }),
    ).toBe(false);
  });

  it("blocks fee-gate when request is resolved without verified/waived fee", () => {
    expect(
      requestCompletedWithoutFeeAuthorization({
        requestStatus: "resolved",
        signupFeeStatus: "claimed",
      }),
    ).toBe(true);
    expect(
      requestCompletedWithoutFeeAuthorization({
        requestStatus: "resolved",
        signupFeeStatus: "verified",
      }),
    ).toBe(false);
    expect(feeStatusAllowsAdmissionHandover("claimed")).toBe(false);
  });

  it("distinguishes missing fee row from missing claim fields", () => {
    expect(
      describeFeeClaimDisplay({
        signupFeeStatus: null,
        feeAmount: null,
        feeCurrency: null,
        feePaymentMethod: null,
        feeReferenceReceipt: null,
      }).claimLabel,
    ).toMatch(/No signup fee record/i);
    expect(
      describeFeeClaimDisplay({
        signupFeeStatus: "claimed",
        feeAmount: null,
        feeCurrency: "PKR",
        feePaymentMethod: null,
        feeReferenceReceipt: null,
      }).claimLabel,
    ).toMatch(/not recorded/i);
    expect(
      describeFeeClaimDisplay({
        signupFeeStatus: "verified",
        feeAmount: 5000,
        feeCurrency: "PKR",
        feePaymentMethod: "cash",
        feeReferenceReceipt: "R-1",
      }).claimLabel,
    ).toContain("5000");
  });
});
