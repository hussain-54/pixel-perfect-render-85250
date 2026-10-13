/**
 * Locks staging account docs to exact schema/code role values.
 * Does not provision users or prove remote Auth.
 */
import { describe, expect, it } from "vitest";
import { BUSINESS_ROLES, resolveBusinessRoleFromTrustedAppRole } from "./business-permissions";
import { normalizeAppRole, portalHomeByRole, roleCanAccessPortal, type AppRole } from "./roles";

/** Mirrors docs/testing/STAGING-TEST-ACCOUNTS.md matrix (technical + business). */
const STAGING_MATRIX: Array<{
  id: string;
  appRole: AppRole;
  businessRole: (typeof BUSINESS_ROLES)[number] | null;
  portal: "student" | "staff" | "admin";
}> = [
  { id: "STU-A", appRole: "student", businessRole: "student_portal", portal: "student" },
  { id: "FD", appRole: "consultant", businessRole: "front_desk_student_affairs", portal: "staff" },
  { id: "ACC", appRole: "consultant", businessRole: "accounts_banking_finance", portal: "staff" },
  { id: "CON", appRole: "consultant", businessRole: "counsellor_consultant", portal: "staff" },
  { id: "AO", appRole: "consultant", businessRole: "admission_team", portal: "staff" },
  { id: "HR", appRole: "consultant", businessRole: "hr_system", portal: "staff" },
  { id: "MKT", appRole: "consultant", businessRole: "digital_manager", portal: "staff" },
  { id: "OPS", appRole: "consultant", businessRole: "office_ops", portal: "staff" },
  { id: "ADM", appRole: "admin", businessRole: "admin", portal: "admin" },
  { id: "SADM", appRole: "super_admin", businessRole: "admin", portal: "admin" },
  { id: "MGR", appRole: "consultant", businessRole: "manager", portal: "staff" },
];

describe("staging account matrix vs code enums", () => {
  it("uses only exact app_role and business_role values", () => {
    for (const row of STAGING_MATRIX) {
      expect(normalizeAppRole(row.appRole)).toBe(row.appRole);
      if (row.businessRole) {
        expect(BUSINESS_ROLES).toContain(row.businessRole);
      }
      expect(roleCanAccessPortal(row.appRole, row.portal)).toBe(true);
      expect(portalHomeByRole[row.appRole]).toMatch(/^\/(student|staff|admin)\//);
    }
  });

  it("does not treat admission_officer as a stored app_role", () => {
    expect(normalizeAppRole("admission_officer")).toBe("consultant");
    expect(normalizeAppRole("front_desk")).toBeNull();
    expect(normalizeAppRole("accounts")).toBeNull();
  });

  it("maps trusted AppRole defaults without inventing specialized desks", () => {
    expect(resolveBusinessRoleFromTrustedAppRole("consultant")).toBe("counsellor_consultant");
    expect(resolveBusinessRoleFromTrustedAppRole("student")).toBe("student_portal");
    expect(resolveBusinessRoleFromTrustedAppRole("admin")).toBe("admin");
  });

  it("keeps finance/hr/marketing/ops pages behind admin portal kind", () => {
    expect(roleCanAccessPortal("consultant", "admin")).toBe(false);
    expect(roleCanAccessPortal("admin", "admin")).toBe(true);
    expect(roleCanAccessPortal("student", "staff")).toBe(false);
  });
});
