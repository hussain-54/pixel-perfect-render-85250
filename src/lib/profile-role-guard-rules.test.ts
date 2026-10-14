import { describe, expect, it } from "vitest";
import {
  PRIVILEGED_BUSINESS_ROLE_SELF_PROMOTE_TARGETS,
  profileRoleGuardDenied,
} from "./profile-role-guard-rules";

describe("enforce_profile_role_guard mirror (…14030000)", () => {
  it("blocks non-admin self-promotion of business_role to privileged desks", () => {
    for (const target of PRIVILEGED_BUSINESS_ROLE_SELF_PROMOTE_TARGETS) {
      expect(
        profileRoleGuardDenied({
          callerAppRole: "consultant",
          roleChanged: false,
          businessRoleChanged: true,
        }),
      ).toMatch(/Business role changes require admin/);
      void target;
    }
  });

  it("blocks student self-set of business_role and app role", () => {
    expect(
      profileRoleGuardDenied({
        callerAppRole: "student",
        roleChanged: false,
        businessRoleChanged: true,
      }),
    ).toMatch(/Business role/);
    expect(
      profileRoleGuardDenied({
        callerAppRole: "student",
        roleChanged: true,
        businessRoleChanged: false,
      }),
    ).toMatch(/Role changes require admin/);
  });

  it("allows admin / super_admin to change business_role and app role", () => {
    expect(
      profileRoleGuardDenied({
        callerAppRole: "admin",
        roleChanged: true,
        businessRoleChanged: true,
      }),
    ).toBeNull();
    expect(
      profileRoleGuardDenied({
        callerAppRole: "super_admin",
        roleChanged: false,
        businessRoleChanged: true,
      }),
    ).toBeNull();
  });

  it("denies when caller role cannot be resolved (null auth.uid() / missing profile)", () => {
    expect(
      profileRoleGuardDenied({
        callerAppRole: null,
        roleChanged: false,
        businessRoleChanged: true,
      }),
    ).toMatch(/Business role/);
  });

  it("allows non-admin updates that do not change role fields", () => {
    expect(
      profileRoleGuardDenied({
        callerAppRole: "consultant",
        roleChanged: false,
        businessRoleChanged: false,
      }),
    ).toBeNull();
  });
});
