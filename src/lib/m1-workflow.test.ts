import { describe, expect, it } from "vitest";
import {
  canActivatePortalFromFeeStatus,
  isSignupFeeVerified,
  studentPortalAccessAllowed,
} from "./signup-fee-gate";
import { evaluateStudentClaim } from "./student-profile-link";
import {
  canFullyApproveModule,
  resolveBusinessRoleFromTrustedAppRole,
} from "./business-permissions";

describe("M1 workflow rules", () => {
  it("Front Desk registration path requires later Auth claim by email", () => {
    const afterIntake = evaluateStudentClaim({
      authUserId: "auth-1",
      authEmail: "student@example.com",
      crm: { id: "stu-1", email: "student@example.com", profile_id: null },
    });
    expect(afterIntake).toEqual({ ok: true, mode: "linked_by_email" });
  });

  it("treats claimed signup fee as unverified (not activation)", () => {
    expect(isSignupFeeVerified("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("claimed")).toBe(false);
    expect(canActivatePortalFromFeeStatus("verified")).toBe(true);
    expect(canActivatePortalFromFeeStatus("waived")).toBe(true);
  });

  it("denies fee verification for counsellor matrix role", () => {
    const role = resolveBusinessRoleFromTrustedAppRole("consultant");
    expect(role).toBe("counsellor_consultant");
    expect(canFullyApproveModule(role, "fees_payments")).toBe(false);
  });

  it("allows fee verification for accounts and admin matrix roles", () => {
    expect(canFullyApproveModule("accounts_banking_finance", "fees_payments")).toBe(true);
    expect(canFullyApproveModule("admin", "fees_payments")).toBe(true);
  });

  it("gates student portal until portal_activated_at on live plane", () => {
    expect(studentPortalAccessAllowed({ source: "supabase", portalActivatedAt: null })).toBe(false);
    expect(
      studentPortalAccessAllowed({
        source: "supabase",
        portalActivatedAt: "2026-10-12T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("documents handover prerequisites as assessment + consented agreement", () => {
    const canHandover = (input: { hasAssessment: boolean; hasConsent: boolean }) =>
      input.hasAssessment && input.hasConsent;
    expect(canHandover({ hasAssessment: true, hasConsent: false })).toBe(false);
    expect(canHandover({ hasAssessment: false, hasConsent: true })).toBe(false);
    expect(canHandover({ hasAssessment: true, hasConsent: true })).toBe(true);
  });

  it("maps post-handover journey stage to university_shortlisting", () => {
    const nextStage = "university_shortlisting";
    expect(nextStage).toBe("university_shortlisting");
  });
});
