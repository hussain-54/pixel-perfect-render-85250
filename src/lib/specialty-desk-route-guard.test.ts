import { describe, expect, it, vi } from "vitest";
import { cloneDefaultPermissionMatrix } from "./business-permissions";
import { assertSpecialtyStaffModuleAccess } from "./specialty-desk-route-guard";

vi.mock("@tanstack/react-router", () => ({
  redirect: (opts: { to?: string; href?: string }) => {
    const err = new Error("REDIRECT") as Error & { redirect: typeof opts };
    err.redirect = opts;
    throw err;
  },
}));

describe("assertSpecialtyStaffModuleAccess", () => {
  it("redirects Admission away from digital_marketing (Leads) on default matrix", () => {
    expect(() =>
      assertSpecialtyStaffModuleAccess({
        appRole: "consultant",
        businessRole: "admission_team",
        module: "digital_marketing",
        matrix: cloneDefaultPermissionMatrix(),
      }),
    ).toThrow(/REDIRECT/);
  });

  it("allows Admission reports View on default matrix", () => {
    expect(() =>
      assertSpecialtyStaffModuleAccess({
        appRole: "consultant",
        businessRole: "admission_team",
        module: "reports",
        matrix: cloneDefaultPermissionMatrix(),
      }),
    ).not.toThrow();
  });

  it("allows Digital Manager digital_marketing", () => {
    expect(() =>
      assertSpecialtyStaffModuleAccess({
        appRole: "consultant",
        businessRole: "digital_manager",
        module: "digital_marketing",
        matrix: cloneDefaultPermissionMatrix(),
      }),
    ).not.toThrow();
  });
});
