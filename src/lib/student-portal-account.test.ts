import { describe, expect, it } from "vitest";
import {
  decideStudentPortalLink,
  frontDeskProvisionUsesPasswordCreateOnly,
  intakePortalStatusFromRow,
  inviteEmailFailureMessage,
  mapStudentPortalLinkRpcError,
  portalActivationUnchangedByLink,
  sanitizeProvisionErrorMessage,
  studentFacingFeeHint,
  studentFacingFeeLabel,
  studentPortalAccountStatus,
  studentPortalAccountStatusLabel,
  studentProfileCompletion,
} from "./student-portal-account";
import { validatePasswordConfirmation } from "./password-policy";

describe("student portal account status", () => {
  it("stays inactive until portal_activated_at even after sign-in", () => {
    expect(
      studentPortalAccountStatus({
        profileId: "user-1",
        hasSignedIn: true,
        portalActivatedAt: null,
      }),
    ).toBe("pending_activation");
    expect(
      studentPortalAccountStatus({
        profileId: "user-1",
        hasSignedIn: false,
        portalActivatedAt: null,
      }),
    ).toBe("pending_setup");
    expect(
      studentPortalAccountStatus({
        profileId: "user-1",
        hasSignedIn: true,
        portalActivatedAt: "2026-10-12T00:00:00Z",
      }),
    ).toBe("active");
  });

  it("maps intake rows to Not created / Pending activation / Active after password create", () => {
    expect(
      studentPortalAccountStatusLabel(
        intakePortalStatusFromRow({ profileId: null, portalActivatedAt: null }),
      ),
    ).toBe("Not created");
    expect(
      studentPortalAccountStatusLabel(
        intakePortalStatusFromRow({ profileId: "user-1", portalActivatedAt: null }),
      ),
    ).toBe("Pending activation");
    expect(
      studentPortalAccountStatusLabel(
        intakePortalStatusFromRow({
          profileId: "user-1",
          portalActivatedAt: "2026-10-12T00:00:00Z",
        }),
      ),
    ).toBe("Active");
  });
});

describe("front desk password create (no invite email)", () => {
  it("uses password create only — no invite or recovery redirect in this path", () => {
    expect(frontDeskProvisionUsesPasswordCreateOnly()).toBe(true);
  });

  it("rejects mismatched and weak passwords with the shared policy", () => {
    expect(validatePasswordConfirmation("short", "short").ok).toBe(false);
    expect(validatePasswordConfirmation("ValidPass123!", "OtherPass123!").ok).toBe(false);
    expect(validatePasswordConfirmation("ValidPass123!", "ValidPass123!").ok).toBe(true);
  });

  it("never surfaces passwords or service-role keys in sanitized errors", () => {
    const msg = sanitizeProvisionErrorMessage(
      "failed password: SuperSecret123! service_role=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123def456.ghi789jkl012",
    );
    expect(msg.toLowerCase()).not.toContain("supersecret123");
    expect(msg).not.toMatch(/eyJ/);
    expect(msg).toMatch(/password=\[omitted\]/i);
  });
});

describe("student portal link decision", () => {
  const base = {
    studentId: "stu-1",
    studentEmail: "Ali@example.com",
    studentProfileId: null as string | null,
    accountUserId: "user-1",
    accountEmail: "ali@example.com",
    accountRole: "student",
    accountLinkedStudentId: null as string | null,
  };

  it("allows first-time provisioning and safe re-link of the same student account", () => {
    expect(decideStudentPortalLink(base)).toEqual({ ok: true, mode: "link" });
    expect(decideStudentPortalLink({ ...base, studentProfileId: "user-1" })).toEqual({
      ok: true,
      mode: "already_linked",
    });
  });

  it("rejects staff accounts and email mismatches", () => {
    expect(decideStudentPortalLink({ ...base, accountEmail: "other@example.com" })).toEqual({
      ok: false,
      reason: "email_mismatch",
    });
    expect(decideStudentPortalLink({ ...base, accountRole: "consultant" })).toEqual({
      ok: false,
      reason: "not_student_role",
    });
    expect(decideStudentPortalLink({ ...base, accountRole: "admin" })).toEqual({
      ok: false,
      reason: "not_student_role",
    });
  });

  it("rejects an account already linked to another student", () => {
    expect(decideStudentPortalLink({ ...base, accountLinkedStudentId: "stu-2" })).toEqual({
      ok: false,
      reason: "linked_other_student",
    });
    expect(decideStudentPortalLink({ ...base, studentProfileId: "user-2" })).toEqual({
      ok: false,
      reason: "linked_other_profile",
    });
  });
});

describe("portal activation stays unchanged by link", () => {
  it("treats null before and after as unchanged", () => {
    expect(portalActivationUnchangedByLink({ before: null, after: null })).toBe(true);
    expect(portalActivationUnchangedByLink({ before: null, after: undefined })).toBe(true);
  });

  it("detects an unexpected activation write", () => {
    expect(
      portalActivationUnchangedByLink({
        before: null,
        after: "2026-10-12T00:00:00Z",
      }),
    ).toBe(false);
  });
});

describe("RPC and invite error mapping", () => {
  it("maps unauthorized and not-found RPC failures", () => {
    expect(mapStudentPortalLinkRpcError("Not authorized for this student")).toEqual({
      status: 403,
      message: "You cannot link this student.",
    });
    expect(mapStudentPortalLinkRpcError("Student record not found")).toEqual({
      status: 404,
      message: "Student or account was not found.",
    });
  });

  it("maps conflict failures without leaking tokens", () => {
    const mapped = mapStudentPortalLinkRpcError(
      "This account is already linked to another student token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123def456.ghi789jkl012",
    );
    expect(mapped.status).toBe(409);
    expect(mapped.message).not.toMatch(/eyJ/);
    expect(mapped.message).toContain("token=[omitted]");
    expect(mapped.message).toContain("already linked to another student");
  });

  it("returns a safe invite-email failure message for legacy paths", () => {
    const msg = inviteEmailFailureMessage(
      "SMTP failed https://example.com/invite?token=supersecrettokenvalue123",
    );
    expect(msg).toContain("[link omitted]");
    expect(msg.toLowerCase()).not.toContain("supersecrettokenvalue123");
    expect(inviteEmailFailureMessage("")).toMatch(/could not send the account setup email/i);
  });

  it("sanitizes password-like fragments", () => {
    expect(sanitizeProvisionErrorMessage("password: hunter2 and token=abc")).toMatch(
      /password=\[omitted\]/i,
    );
  });
});

describe("student-facing summaries", () => {
  it("counts only filled profile fields", () => {
    expect(
      studentProfileCompletion({
        phone: "0300",
        city: "",
        destination: "UK",
        program: null,
        studyLevel: "Masters",
        dob: "2000-01-01",
      }),
    ).toEqual({ done: 4, total: 6, percent: 67 });
  });

  it("does not include amounts in the fee label", () => {
    expect(studentFacingFeeLabel("claimed")).toBe("Awaiting Finance verification");
    expect(studentFacingFeeLabel("unpaid")).toBe("Payment pending");
    expect(studentFacingFeeLabel("verified")).toBe("Verified");
    expect(studentFacingFeeLabel(null)).toBe("Not recorded");
  });

  it("explains fee status in StatCard hints without amounts", () => {
    expect(studentFacingFeeHint("rejected", false)).toMatch(/rejected/i);
    expect(studentFacingFeeHint("claimed", false)).toMatch(/reviewing/i);
    expect(studentFacingFeeHint("unpaid", false)).toMatch(/voucher/i);
    expect(studentFacingFeeHint("verified", true)).toMatch(/active/i);
  });
});
