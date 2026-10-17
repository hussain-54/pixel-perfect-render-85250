import { describe, expect, it } from "vitest";
import {
  HANDOVER_INITIATE_MINIMUM,
  HANDOVER_INITIATE_MODULE,
  HANDOVER_QUEUE_MUTATE_MINIMUM,
  HANDOVER_QUEUE_MODULE,
  HANDOVER_QUEUE_VIEW_MINIMUM,
  assessmentSatisfiesHandover,
  handoverDuplicateMessage,
  validateAssessmentForSave,
} from "./counsellor-handover-rules";
import { canEditModule, getPermissionLevel } from "./business-permissions";
import { assertModulePermission } from "@/server/staff-access";
import { AuthError, type TrustedSession } from "@/server/portal-auth";

function session(
  businessRole: NonNullable<TrustedSession["businessRole"]>,
): TrustedSession {
  return {
    email: "c@example.com",
    source: "demo",
    userId: "u1",
    role: "consultant",
    businessRole,
  };
}

describe("counsellor admission handover authorization", () => {
  it("gates initiate on counselling Edit, not admissions Edit", () => {
    expect(HANDOVER_INITIATE_MODULE).toBe("counselling");
    expect(HANDOVER_INITIATE_MINIMUM).toBe(2);
    expect(canEditModule("counsellor_consultant", "counselling")).toBe(true);
    expect(canEditModule("counsellor_consultant", "admissions")).toBe(false);
    expect(() =>
      assertModulePermission(
        session("counsellor_consultant"),
        HANDOVER_INITIATE_MODULE,
        HANDOVER_INITIATE_MINIMUM,
        "admission handover",
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(session("counsellor_consultant"), "admissions", 2, "admission handover"),
    ).toThrow(AuthError);
  });

  it("allows counsellor View of queue; accept/return needs admissions Edit", () => {
    expect(HANDOVER_QUEUE_MODULE).toBe("admissions");
    expect(HANDOVER_QUEUE_VIEW_MINIMUM).toBe(1);
    expect(HANDOVER_QUEUE_MUTATE_MINIMUM).toBe(2);
    expect(getPermissionLevel("admission_team", "admissions")).toBe(3);
    expect(() =>
      assertModulePermission(
        session("counsellor_consultant"),
        HANDOVER_QUEUE_MODULE,
        HANDOVER_QUEUE_VIEW_MINIMUM,
        "admission handover queue",
      ),
    ).not.toThrow();
    expect(() =>
      assertModulePermission(
        session("counsellor_consultant"),
        HANDOVER_QUEUE_MODULE,
        HANDOVER_QUEUE_MUTATE_MINIMUM,
        "admission handover queue",
      ),
    ).toThrow(AuthError);
    expect(() =>
      assertModulePermission(
        session("admission_team"),
        HANDOVER_QUEUE_MODULE,
        HANDOVER_QUEUE_MUTATE_MINIMUM,
        "admission handover queue",
      ),
    ).not.toThrow();
  });

  it("does not grant fee verification to counsellors as a side effect", () => {
    expect(canEditModule("counsellor_consultant", "fees_payments")).toBe(false);
  });
});

describe("eligibility assessment validation", () => {
  it("requires eligibility outcome and rejects blank save", () => {
    const blank = validateAssessmentForSave({ eligibility: "  ", applicationTarget: 3 });
    expect(blank.ok).toBe(false);
    if (!blank.ok) {
      expect(blank.message).toMatch(/eligibility/i);
      expect(blank.missing).toContain("eligibility outcome");
    }
  });

  it("accepts a valid outcome", () => {
    expect(validateAssessmentForSave({ eligibility: "Good Fit", applicationTarget: 5 })).toEqual({
      ok: true,
    });
  });

  it("handover requires saved assessment with eligibility text", () => {
    expect(
      assessmentSatisfiesHandover({ hasAssessmentRow: false, eligibilitySummary: "Good Fit" }).ok,
    ).toBe(false);
    expect(
      assessmentSatisfiesHandover({ hasAssessmentRow: true, eligibilitySummary: "  " }).ok,
    ).toBe(false);
    expect(
      assessmentSatisfiesHandover({ hasAssessmentRow: true, eligibilitySummary: "Borderline" }),
    ).toEqual({ ok: true });
  });

  it("duplicate handover copy is actionable", () => {
    expect(handoverDuplicateMessage()).toMatch(/already/i);
  });
});
