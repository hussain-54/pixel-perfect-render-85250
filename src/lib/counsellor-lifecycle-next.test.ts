import { describe, expect, it } from "vitest";
import {
  counsellorLifecycleProgressSteps,
  DEFAULT_ADMISSION_HANDOVER_SUMMARY,
  DEFAULT_FEE_VERIFICATION_SUMMARY,
  normalizeOptionalActionSummary,
  resolveCounsellorLifecycleNext,
} from "./counsellor-lifecycle-next";
import { feeStatusAllowsAdmissionHandover } from "./fee-verification-workflow";

describe("counsellor lifecycle next-step", () => {
  it("asks for assessment first when none is saved", () => {
    const next = resolveCounsellorLifecycleNext({
      hasSavedAssessment: false,
      hasConsent: false,
      signupFeeStatus: "claimed",
      openFeeRequestStatus: null,
      handoverStatus: null,
    });
    expect(next.stepId).toBe("complete_assessment");
    expect(next.primaryAction).toBe("go_assessment");
  });

  it("asks for consent after assessment", () => {
    const next = resolveCounsellorLifecycleNext({
      hasSavedAssessment: true,
      hasConsent: false,
      signupFeeStatus: "claimed",
      openFeeRequestStatus: null,
      handoverStatus: null,
    });
    expect(next.stepId).toBe("record_consent");
    expect(next.primaryAction).toBe("record_consent");
  });

  it("requests fee verification when fee not authorized and no open request", () => {
    const next = resolveCounsellorLifecycleNext({
      hasSavedAssessment: true,
      hasConsent: true,
      signupFeeStatus: "claimed",
      openFeeRequestStatus: null,
      handoverStatus: null,
    });
    expect(next.stepId).toBe("request_fee_verification");
    expect(feeStatusAllowsAdmissionHandover("claimed")).toBe(false);
  });

  it("awaits finance when request is in_progress", () => {
    const next = resolveCounsellorLifecycleNext({
      hasSavedAssessment: true,
      hasConsent: true,
      signupFeeStatus: "claimed",
      openFeeRequestStatus: "in_progress",
      handoverStatus: null,
    });
    expect(next.stepId).toBe("await_fee_decision");
    expect(next.primaryAction).toBe("none");
  });

  it("offers admission only when fee is verified or waived", () => {
    for (const status of ["verified", "waived"] as const) {
      const next = resolveCounsellorLifecycleNext({
        hasSavedAssessment: true,
        hasConsent: true,
        signupFeeStatus: status,
        openFeeRequestStatus: null,
        handoverStatus: null,
      });
      expect(next.stepId).toBe("forward_admission");
      expect(next.primaryAction).toBe("forward_admission");
    }
  });

  it("does not unlock admission on claimed fee", () => {
    const next = resolveCounsellorLifecycleNext({
      hasSavedAssessment: true,
      hasConsent: true,
      signupFeeStatus: "claimed",
      openFeeRequestStatus: null,
      handoverStatus: null,
    });
    expect(next.primaryAction).not.toBe("forward_admission");
  });

  it("shows with-admission after submitted handover", () => {
    const next = resolveCounsellorLifecycleNext({
      hasSavedAssessment: true,
      hasConsent: true,
      signupFeeStatus: "verified",
      openFeeRequestStatus: null,
      handoverStatus: "submitted",
    });
    expect(next.stepId).toBe("with_admission");
  });

  it("uses factual defaults for blank optional notes", () => {
    expect(normalizeOptionalActionSummary("", DEFAULT_FEE_VERIFICATION_SUMMARY)).toBe(
      DEFAULT_FEE_VERIFICATION_SUMMARY,
    );
    expect(normalizeOptionalActionSummary("  ", DEFAULT_ADMISSION_HANDOVER_SUMMARY)).toBe(
      DEFAULT_ADMISSION_HANDOVER_SUMMARY,
    );
    expect(
      normalizeOptionalActionSummary("Please check bank slip", DEFAULT_FEE_VERIFICATION_SUMMARY),
    ).toBe("Please check bank slip");
  });

  it("marks progress from persisted evidence only", () => {
    const steps = counsellorLifecycleProgressSteps({
      hasSavedAssessment: true,
      hasConsent: true,
      signupFeeStatus: "claimed",
      openFeeRequestStatus: "open",
      handoverStatus: null,
    });
    expect(steps.find((s) => s.id === "assessment")?.done).toBe(true);
    expect(steps.find((s) => s.id === "consent")?.done).toBe(true);
    expect(steps.find((s) => s.id === "fee")?.done).toBe(false);
    expect(steps.find((s) => s.id === "admission")?.done).toBe(false);
  });
});
