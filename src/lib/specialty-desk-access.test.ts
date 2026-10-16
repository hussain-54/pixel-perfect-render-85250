import { describe, expect, it } from "vitest";
import { roleCanAccessPortal } from "./roles";
import {
  consultantMayAccessAdminPortal,
  isSpecialtyOnlyBusinessRole,
  shouldIncludeCounsellorCrmNav,
  specialtyNavForBusinessRole,
  specialtyOnlyPathAllowed,
  staffLandingPathForBusinessRole,
} from "./specialty-desk-access";
import { staffHomeForBusinessRole } from "./staff-business-access";

describe("specialty desk portal access", () => {
  it("keeps consultants out of /admin while landing specialty desks on /staff modules", () => {
    expect(roleCanAccessPortal("consultant", "admin")).toBe(false);
    expect(consultantMayAccessAdminPortal()).toBe(false);
    expect(staffLandingPathForBusinessRole("consultant", "hr_system")).toBe("/staff/hr");
    expect(staffLandingPathForBusinessRole("consultant", "digital_manager")).toBe(
      "/staff/marketing",
    );
    expect(staffLandingPathForBusinessRole("consultant", "accounts_banking_finance")).toBe(
      "/staff/finance",
    );
    expect(staffLandingPathForBusinessRole("consultant", "office_ops")).toBe("/staff/operations");
    expect(staffHomeForBusinessRole("consultant", "hr_system")).toBe("/staff/hr");
    expect(staffLandingPathForBusinessRole("admin", "hr_system")).toBe("/admin/dashboard");
  });

  it("builds specialty nav from matrix View only", () => {
    const hr = specialtyNavForBusinessRole("hr_system").map((i) => i.to);
    expect(hr).toContain("/staff/hr");
    expect(hr).not.toContain("/staff/marketing");

    const digital = specialtyNavForBusinessRole("digital_manager").map((i) => i.to);
    expect(digital).toContain("/staff/marketing");
    // Matrix grants digital_manager HR View=1 — nav may include /staff/hr.
    expect(digital).toContain("/staff/reports");
    expect(digital).not.toContain("/staff/operations");

    const accounts = specialtyNavForBusinessRole("accounts_banking_finance").map((i) => i.to);
    expect(accounts).toEqual(
      expect.arrayContaining(["/staff/finance", "/staff/banking", "/staff/reports"]),
    );
    expect(accounts).not.toContain("/staff/marketing");

    const manager = specialtyNavForBusinessRole("manager").map((i) => i.to);
    expect(manager).toEqual(
      expect.arrayContaining([
        "/staff/hr",
        "/staff/marketing",
        "/staff/finance",
        "/staff/operations",
      ]),
    );
  });

  it("denies specialty-only desks counsellor CRM paths; allows their modules", () => {
    expect(isSpecialtyOnlyBusinessRole("hr_system")).toBe(true);
    expect(shouldIncludeCounsellorCrmNav("hr_system")).toBe(false);
    expect(shouldIncludeCounsellorCrmNav("manager")).toBe(true);
    expect(shouldIncludeCounsellorCrmNav("counsellor_consultant")).toBe(true);

    expect(specialtyOnlyPathAllowed("hr_system", "/staff/students")).toBe(false);
    expect(specialtyOnlyPathAllowed("hr_system", "/staff/hr")).toBe(true);
    expect(specialtyOnlyPathAllowed("digital_manager", "/staff/marketing")).toBe(true);
    expect(specialtyOnlyPathAllowed("digital_manager", "/staff/applications")).toBe(false);
    expect(specialtyOnlyPathAllowed("manager", "/staff/students")).toBe(true);
  });

  it("Front Desk and counsellor landing unchanged", () => {
    expect(staffLandingPathForBusinessRole("consultant", "front_desk_student_affairs")).toBe(
      "/staff/front-desk",
    );
    expect(staffLandingPathForBusinessRole("consultant", "counsellor_consultant")).toBe(
      "/staff/dashboard",
    );
    expect(staffLandingPathForBusinessRole("consultant", "admission_team")).toBe(
      "/staff/dashboard",
    );
  });
});
