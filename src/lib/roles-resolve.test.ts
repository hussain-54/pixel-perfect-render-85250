import { describe, expect, it } from "vitest";
import { portalHomeByRole, resolveAppRoleFromTrustedSources, roleCanAccessPortal } from "./roles";

describe("resolveAppRoleFromTrustedSources", () => {
  it("prefers profiles.role over stale app_metadata.student", () => {
    expect(
      resolveAppRoleFromTrustedSources({
        profileRole: "admin",
        appMetadataRole: "student",
      }),
    ).toBe("admin");
  });

  it("uses app_metadata when profile role is missing", () => {
    expect(
      resolveAppRoleFromTrustedSources({
        profileRole: null,
        appMetadataRole: "consultant",
      }),
    ).toBe("consultant");
  });

  it("defaults to student when both sources are empty", () => {
    expect(resolveAppRoleFromTrustedSources({})).toBe("student");
    expect(
      resolveAppRoleFromTrustedSources({
        profileRole: undefined,
        appMetadataRole: "not-a-role",
      }),
    ).toBe("student");
  });

  it("never invents super_admin from display labels", () => {
    expect(
      resolveAppRoleFromTrustedSources({
        profileRole: "Super Admin",
        appMetadataRole: "admin",
      }),
    ).toBe("admin");
  });

  it("routes verified admin to admin portal home", () => {
    const role = resolveAppRoleFromTrustedSources({
      profileRole: "admin",
      appMetadataRole: "student",
    });
    expect(portalHomeByRole[role]).toBe("/admin/dashboard");
    expect(roleCanAccessPortal(role, "admin")).toBe(true);
    expect(roleCanAccessPortal(role, "student")).toBe(false);
  });
});
