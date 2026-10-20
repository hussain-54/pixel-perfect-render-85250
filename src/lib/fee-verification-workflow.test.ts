import { describe, expect, it } from "vitest";
import {
  admissionHandoverBlockedByFeeMessage,
  canRequestFeeVerification,
  feeStatusAllowsAdmissionHandover,
  normalizeAssessmentEligibilityForDraft,
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
});
