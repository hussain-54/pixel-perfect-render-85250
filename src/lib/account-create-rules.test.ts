import { describe, expect, it } from "vitest";
import {
  assertRolePair,
  getProvisioningOption,
  isCreatableAppRole,
  isValidPersonName,
  isValidWorkEmail,
  normalizeWorkEmail,
} from "./account-provisioning";
import { validatePasswordConfirmation } from "./password-policy";

/**
 * Mirrors server-side portalCreateAccount validation (pure rules only).
 * Does not call Auth Admin — covers direct-create acceptance criteria without secrets.
 */
function validateDirectCreateInput(input: {
  fullName: string;
  email: string;
  businessRole: string;
  temporaryPassword: string;
  confirmPassword: string;
  appRoleClaim?: string;
}) {
  if (!isValidPersonName(input.fullName)) {
    return { ok: false as const, error: "Enter the person's full name.", status: 400 };
  }
  if (!isValidWorkEmail(input.email)) {
    return { ok: false as const, error: "Enter a valid work email address.", status: 400 };
  }
  const pw = validatePasswordConfirmation(input.temporaryPassword, input.confirmPassword);
  if (!pw.ok) return { ok: false as const, error: pw.error, status: 400 };

  const option = getProvisioningOption(input.businessRole);
  if (!option) return { ok: false as const, error: "Unsupported business role.", status: 400 };
  try {
    assertRolePair(option.appRole, option.businessRole);
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Invalid role pair.",
      status: 400,
    };
  }
  if (input.appRoleClaim === "super_admin" || option.appRole === "super_admin") {
    return {
      ok: false as const,
      error: "super_admin cannot be assigned through this form.",
      status: 403,
    };
  }
  if (input.appRoleClaim && !isCreatableAppRole(input.appRoleClaim)) {
    return { ok: false as const, error: "Invalid app role.", status: 400 };
  }
  return {
    ok: true as const,
    email: normalizeWorkEmail(input.email),
    appRole: option.appRole,
    businessRole: option.businessRole,
    invited: false,
    sendsInvitationEmail: false,
    forcesFirstLoginPasswordChange: false,
  };
}

describe("direct account creation rules", () => {
  it("accepts a valid create payload without invitation email", () => {
    const result = validateDirectCreateInput({
      fullName: "Sam Staff",
      email: "  Sam@GlobalRoots.pk ",
      businessRole: "counsellor_consultant",
      temporaryPassword: "TempPass12",
      confirmPassword: "TempPass12",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email).toBe("sam@globalroots.pk");
    expect(result.appRole).toBe("consultant");
    expect(result.invited).toBe(false);
    expect(result.sendsInvitationEmail).toBe(false);
    expect(result.forcesFirstLoginPasswordChange).toBe(false);
  });

  it("rejects weak / mismatched temporary passwords", () => {
    expect(
      validateDirectCreateInput({
        fullName: "Sam Staff",
        email: "sam@globalroots.pk",
        businessRole: "front_desk_student_affairs",
        temporaryPassword: "short",
        confirmPassword: "short",
      }).ok,
    ).toBe(false);
    expect(
      validateDirectCreateInput({
        fullName: "Sam Staff",
        email: "sam@globalroots.pk",
        businessRole: "hr_system",
        temporaryPassword: "TempPass12",
        confirmPassword: "TempPass13",
      }).ok,
    ).toBe(false);
  });

  it("rejects invalid roles and super_admin claims", () => {
    expect(
      validateDirectCreateInput({
        fullName: "Sam Staff",
        email: "sam@globalroots.pk",
        businessRole: "not_a_role",
        temporaryPassword: "TempPass12",
        confirmPassword: "TempPass12",
      }).ok,
    ).toBe(false);
    expect(
      validateDirectCreateInput({
        fullName: "Sam Staff",
        email: "sam@globalroots.pk",
        businessRole: "admin",
        temporaryPassword: "TempPass12",
        confirmPassword: "TempPass12",
        appRoleClaim: "super_admin",
      }),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("maps business roles without granting org-wide admin", () => {
    for (const role of [
      "front_desk_student_affairs",
      "counsellor_consultant",
      "admission_team",
      "accounts_banking_finance",
      "hr_system",
      "digital_manager",
      "office_ops",
      "manager",
    ] as const) {
      const result = validateDirectCreateInput({
        fullName: "Staff Member",
        email: `${role}@example.com`,
        businessRole: role,
        temporaryPassword: "TempPass12",
        confirmPassword: "TempPass12",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.appRole).toBe("consultant");
        expect(result.appRole).not.toBe("super_admin");
        expect(result.appRole).not.toBe("admin");
      }
    }
  });
});
