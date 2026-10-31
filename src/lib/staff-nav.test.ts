import { describe, expect, it } from "vitest";
import { cloneDefaultPermissionMatrix } from "./business-permissions";
import { buildStaffNav } from "./staff-nav";

describe("buildStaffNav", () => {
  it("does not repeat the Modules section label on every specialty item", () => {
    const matrix = cloneDefaultPermissionMatrix();
    // Finance desk sees specialty home + modules from matrix.
    const nav = buildStaffNav("accounts_banking_finance", matrix);
    const sectionLabels = nav.map((i) => i.section).filter(Boolean);
    const modulesCount = sectionLabels.filter((s) => s === "Modules").length;
    expect(modulesCount).toBeLessThanOrEqual(1);
  });

  it("keeps Front Desk primary routes without Modules prefix on each", () => {
    const nav = buildStaffNav("front_desk_student_affairs", cloneDefaultPermissionMatrix());
    expect(nav.some((i) => i.to === "/staff/front-desk")).toBe(true);
    expect(nav.some((i) => i.to === "/staff/register")).toBe(true);
    const modules = nav.filter((i) => i.section === "Modules");
    expect(modules.length).toBeLessThanOrEqual(1);
  });

  it("hides Leads for Admission when digital_marketing matrix cell is No access", () => {
    const nav = buildStaffNav("admission_team", cloneDefaultPermissionMatrix());
    expect(nav.some((i) => i.to === "/staff/applications")).toBe(true);
    expect(nav.some((i) => i.to === "/staff/leads")).toBe(false);
  });

  it("labels Admission CRM as Workspace and includes Fees when matrix allows", () => {
    const nav = buildStaffNav("admission_team", cloneDefaultPermissionMatrix());
    expect(nav[0]?.section).toBe("Workspace");
    expect(nav.some((i) => i.to === "/staff/finance")).toBe(true);
    expect(nav.some((i) => i.to === "/staff/offers")).toBe(true);
    expect(nav.some((i) => i.to === "/staff/activity")).toBe(true);
  });

  it("hides Leads for Counsellor when digital_marketing matrix cell is No access", () => {
    const nav = buildStaffNav("counsellor_consultant", cloneDefaultPermissionMatrix());
    expect(nav.some((i) => i.to === "/staff/dashboard")).toBe(true);
    expect(nav.some((i) => i.to === "/staff/leads")).toBe(false);
  });
});
