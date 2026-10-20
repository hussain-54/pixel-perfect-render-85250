import { describe, expect, it } from "vitest";
import {
  buildServiceRoleStudentProfilePatch,
  canReuseExistingStudentProfileForLink,
  frontDeskProvisionSendsAuthEmail,
  provisionPartialFailureMessage,
  serviceRoleMaySetBusinessRoleOnUpdate,
  serviceRoleProfileRoleUpdateDenied,
  STUDENT_PORTAL_BUSINESS_ROLE,
} from "./student-portal-provision-rules";
import { profileRoleGuardDenied } from "./profile-role-guard-rules";

describe("student portal provision vs business-role guard", () => {
  it("documents that service-role business_role UPDATEs are denied", () => {
    expect(serviceRoleMaySetBusinessRoleOnUpdate()).toBe(false);
    expect(
      serviceRoleProfileRoleUpdateDenied({
        roleChanged: false,
        businessRoleChanged: true,
      }),
    ).toBe("Business role changes require admin privileges");
  });

  it("allows Front Desk callers to change neither role nor business_role", () => {
    expect(
      profileRoleGuardDenied({
        callerAppRole: "consultant",
        roleChanged: false,
        businessRoleChanged: true,
      }),
    ).toBe("Business role changes require admin privileges");
    expect(
      profileRoleGuardDenied({
        callerAppRole: "admin",
        roleChanged: false,
        businessRoleChanged: true,
      }),
    ).toBeNull();
  });

  it("builds a service-role safe patch without role fields", () => {
    const patch = buildServiceRoleStudentProfilePatch({
      email: "Ali@Example.com",
      fullName: "Ali Khan",
    });
    expect(patch).toEqual({ email: "ali@example.com", full_name: "Ali Khan" });
    expect(patch).not.toHaveProperty("business_role");
    expect(patch).not.toHaveProperty("role");
  });

  it("reuses unlinked student profiles and rejects staff", () => {
    expect(
      canReuseExistingStudentProfileForLink({
        role: "student",
        businessRole: STUDENT_PORTAL_BUSINESS_ROLE,
        profileLinkedStudentId: null,
        targetStudentId: "stu-1",
      }).ok,
    ).toBe(true);
    expect(
      canReuseExistingStudentProfileForLink({
        role: "consultant",
        businessRole: "front_desk_student_affairs",
        profileLinkedStudentId: null,
        targetStudentId: "stu-1",
      }).ok,
    ).toBe(false);
    expect(
      canReuseExistingStudentProfileForLink({
        role: "student",
        businessRole: null,
        profileLinkedStudentId: "stu-2",
        targetStudentId: "stu-1",
      }).ok,
    ).toBe(false);
  });

  it("keeps fee-gate and no-email invariants in the provision helper surface", () => {
    expect(frontDeskProvisionSendsAuthEmail()).toBe(false);
    expect(provisionPartialFailureMessage("profile")).toMatch(/Retry provisioning/i);
    expect(provisionPartialFailureMessage("link")).toMatch(/could not be linked/i);
  });
});
