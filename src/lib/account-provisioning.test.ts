import { describe, expect, it } from "vitest";
import {
  ACCOUNT_PROVISIONING_OPTIONS,
  appRoleForBusinessRole,
  assertRolePair,
  getProvisioningOption,
  isCreatableAppRole,
  isValidPersonName,
  isValidWorkEmail,
  normalizeWorkEmail,
} from "./account-provisioning";
import { BUSINESS_ROLES } from "./business-permissions";

describe("account provisioning role map", () => {
  it("covers every business role exactly once without super_admin", () => {
    expect(ACCOUNT_PROVISIONING_OPTIONS.map((o) => o.businessRole).sort()).toEqual(
      [...BUSINESS_ROLES].sort(),
    );
    expect(ACCOUNT_PROVISIONING_OPTIONS.some((o) => o.appRole === "super_admin")).toBe(false);
  });

  it("maps business roles to valid app roles", () => {
    expect(appRoleForBusinessRole("student_portal")).toBe("student");
    expect(appRoleForBusinessRole("front_desk_student_affairs")).toBe("consultant");
    expect(appRoleForBusinessRole("counsellor_consultant")).toBe("consultant");
    expect(appRoleForBusinessRole("admission_team")).toBe("consultant");
    expect(appRoleForBusinessRole("accounts_banking_finance")).toBe("consultant");
    expect(appRoleForBusinessRole("hr_system")).toBe("consultant");
    expect(appRoleForBusinessRole("digital_manager")).toBe("consultant");
    expect(appRoleForBusinessRole("office_ops")).toBe("consultant");
    expect(appRoleForBusinessRole("manager")).toBe("consultant");
    expect(appRoleForBusinessRole("admin")).toBe("admin");
  });

  it("rejects mismatched pairs and super_admin creation", () => {
    expect(() => assertRolePair("student", "admin")).toThrow();
    expect(() => assertRolePair("consultant", "student_portal")).toThrow();
    expect(isCreatableAppRole("super_admin")).toBe(false);
    expect(isCreatableAppRole("admin")).toBe(true);
  });

  it("validates name and email", () => {
    expect(isValidPersonName("A")).toBe(false);
    expect(isValidPersonName("Ada Lovelace")).toBe(true);
    expect(isValidWorkEmail("not-an-email")).toBe(false);
    expect(isValidWorkEmail("  Ada@GlobalRoots.pk ")).toBe(true);
    expect(normalizeWorkEmail("  Ada@GlobalRoots.pk ")).toBe("ada@globalroots.pk");
  });

  it("marks staff desks that need consultants rows", () => {
    expect(getProvisioningOption("admission_team")?.needsConsultantDesk).toBe(true);
    expect(getProvisioningOption("student_portal")?.needsConsultantDesk).toBe(false);
    expect(getProvisioningOption("admin")?.needsConsultantDesk).toBe(false);
  });
});
