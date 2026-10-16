import { describe, expect, it } from "vitest";
import { BUSINESS_ROLES, type BusinessRole } from "./business-permissions";
import { roleCanAccessPortal } from "./roles";
import {
  consultantMayAccessAdminPortal,
  specialtyNavForBusinessRole,
  staffLandingPathForBusinessRole,
} from "./specialty-desk-access";
import {
  isGenericPortalTitle,
  isKnownBusinessRole,
  workspaceBrandForSession,
  workspaceDocumentTitle,
  workspaceIdentityLabelForSession,
  workspaceTitleForSession,
  WORKSPACE_BRANDING_BY_BUSINESS_ROLE,
} from "./workspace-branding";

const EXPECTED_TITLES: Record<
  Exclude<BusinessRole, "student_portal">,
  string
> = {
  front_desk_student_affairs: "Front Desk & Student Affairs",
  counsellor_consultant: "Counselling & Student Guidance",
  admission_team: "Admissions & Application Management",
  accounts_banking_finance: "Accounts & Financial Operations",
  hr_system: "Human Resources & Attendance",
  digital_manager: "Digital Marketing & Growth",
  office_ops: "Office Operations & Administration",
  manager: "Management & Oversight",
  admin: "Administration & System Management",
};

describe("workspace branding", () => {
  it("maps each supported business role to the approved workspace title", () => {
    for (const [role, title] of Object.entries(EXPECTED_TITLES)) {
      expect(workspaceTitleForSession({ portal: "staff", businessRole: role })).toBe(title);
      expect(isGenericPortalTitle(title)).toBe(false);
      expect(WORKSPACE_BRANDING_BY_BUSINESS_ROLE[role as BusinessRole].title).toBe(title);
    }
    expect(workspaceTitleForSession({ portal: "student", businessRole: "student_portal" })).toBe(
      "Student Workspace",
    );
  });

  it("covers every BUSINESS_ROLES enum value without inventing roles", () => {
    for (const role of BUSINESS_ROLES) {
      expect(isKnownBusinessRole(role)).toBe(true);
      expect(WORKSPACE_BRANDING_BY_BUSINESS_ROLE[role].title.length).toBeGreaterThan(3);
      expect(isGenericPortalTitle(WORKSPACE_BRANDING_BY_BUSINESS_ROLE[role].title)).toBe(false);
    }
    expect(isKnownBusinessRole("not_a_role")).toBe(false);
    expect(isKnownBusinessRole(null)).toBe(false);
  });

  it("fails safe for unknown or missing roles without elevating access", () => {
    expect(workspaceTitleForSession({ portal: "staff", businessRole: null })).toBe(
      "Staff Workspace",
    );
    expect(workspaceTitleForSession({ portal: "staff", businessRole: "unknown_desk" })).toBe(
      "Staff Workspace",
    );
    expect(
      workspaceIdentityLabelForSession({ portal: "admin", businessRole: null, appRole: "admin" }),
    ).toBe("Admin");
    expect(workspaceDocumentTitle({ portal: "staff", businessRole: "manager" })).toMatch(
      /Management & Oversight — Global Roots/,
    );
    // Branding must not imply /admin access for consultants.
    expect(roleCanAccessPortal("consultant", "admin")).toBe(false);
    expect(consultantMayAccessAdminPortal()).toBe(false);
  });

  it("keeps role-specific navigation and landing paths unchanged", () => {
    expect(staffLandingPathForBusinessRole("consultant", "office_ops")).toBe("/staff/operations");
    expect(staffLandingPathForBusinessRole("consultant", "manager")).toBe("/staff/dashboard");
    expect(specialtyNavForBusinessRole("hr_system").map((i) => i.to)).toContain("/staff/hr");
    expect(specialtyNavForBusinessRole("hr_system").map((i) => i.to)).not.toContain(
      "/staff/marketing",
    );
    expect(workspaceBrandForSession({ portal: "staff", businessRole: "office_ops" }).title).toBe(
      "Office Operations & Administration",
    );
    expect(workspaceBrandForSession({ portal: "staff", businessRole: "manager" }).title).toBe(
      "Management & Oversight",
    );
  });
});
