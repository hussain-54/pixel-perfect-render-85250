/**
 * Regression coverage for access-control defects fixed in the role-security pass.
 * Uses pure helpers only — no live credentials.
 */
import { describe, expect, it } from "vitest";
import {
  BUSINESS_MODULES,
  BUSINESS_ROLES,
  getPermissionLevel,
  type BusinessModule,
  type BusinessRole,
} from "./business-permissions";
import { canViewAdminOpsOverview } from "./admin-ops-overview";
import {
  canAttributeInquiryCampaign,
  canMutateMarketing,
  canViewMarketing,
} from "./marketing-rules";
import { canViewReportsPortal } from "./report-rules";
import { roleCanAccessPortal } from "./roles";
import {
  FRONT_DESK_DENIED_MODULES,
  isFrontDeskDeniedPath,
  moduleDeniedForFrontDesk,
} from "./staff-business-access";
import { canViewConsultantLeaderboard } from "./leaderboard-rules";
import {
  consultantMayAccessAdminPortal,
  staffLandingPathForBusinessRole,
} from "./specialty-desk-access";

describe("role security regression", () => {
  it("portal entry: student/staff/admin shells stay role-isolated", () => {
    expect(roleCanAccessPortal("student", "student")).toBe(true);
    expect(roleCanAccessPortal("student", "staff")).toBe(false);
    expect(roleCanAccessPortal("student", "admin")).toBe(false);
    expect(roleCanAccessPortal("consultant", "staff")).toBe(true);
    expect(roleCanAccessPortal("consultant", "admin")).toBe(false);
    expect(consultantMayAccessAdminPortal()).toBe(false);
    expect(roleCanAccessPortal("admin", "admin")).toBe(true);
    expect(roleCanAccessPortal("admin", "staff")).toBe(false);
    expect(roleCanAccessPortal("super_admin", "admin")).toBe(true);
  });

  it("specialty desks use /staff module homes — never /admin", () => {
    expect(staffLandingPathForBusinessRole("consultant", "hr_system")).toBe("/staff/hr");
    expect(staffLandingPathForBusinessRole("consultant", "accounts_banking_finance")).toBe(
      "/staff/finance",
    );
    expect(staffLandingPathForBusinessRole("consultant", "office_ops").startsWith("/staff/")).toBe(
      true,
    );
    expect(staffLandingPathForBusinessRole("consultant", "digital_manager")).not.toMatch(
      /^\/admin/,
    );
  });

  it("Front Desk product denials cover marketing/reports/settings modules and staff CRM paths", () => {
    for (const mod of FRONT_DESK_DENIED_MODULES) {
      expect(moduleDeniedForFrontDesk(mod)).toBe(true);
    }
    expect(moduleDeniedForFrontDesk("digital_marketing")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/reports")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/leads")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/dashboard")).toBe(true);
    expect(isFrontDeskDeniedPath("/staff/front-desk")).toBe(false);
  });

  it("inquiry attribution is not open to every consultant", () => {
    expect(
      canAttributeInquiryCampaign({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canAttributeInquiryCampaign({
        appRole: "consultant",
        businessRole: "admission_team",
      }),
    ).toBe(false);
    expect(
      canAttributeInquiryCampaign({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
    expect(
      canAttributeInquiryCampaign({
        appRole: "consultant",
        businessRole: "digital_manager",
      }),
    ).toBe(true);
  });

  it("Front Desk cannot view/mutate marketing despite matrix View=1", () => {
    expect(getPermissionLevel("front_desk_student_affairs", "digital_marketing")).toBe(1);
    expect(
      canViewMarketing({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
    expect(
      canMutateMarketing({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
  });

  it("firm-wide ops overview and leaderboard stay admin/manager scoped", () => {
    expect(
      canViewAdminOpsOverview({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canViewAdminOpsOverview({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(false);
    expect(
      canViewConsultantLeaderboard({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canViewConsultantLeaderboard({ appRole: "admin", businessRole: "admin" }),
    ).toBe(true);
  });

  it("documents default matrix: FD/counsellor Edit; student View; accounts none", () => {
    expect(getPermissionLevel("front_desk_student_affairs", "documents")).toBe(2);
    expect(getPermissionLevel("counsellor_consultant", "documents")).toBe(2);
    expect(getPermissionLevel("student_portal", "documents")).toBe(2);
    expect(getPermissionLevel("accounts_banking_finance", "documents")).toBe(0);
  });

  it("reports portal view remains matrix-based (FD deny is enforced on server handlers)", () => {
    // Matrix still grants FD reports View — handlers must denyFrontDesk separately.
    expect(
      canViewReportsPortal({
        appRole: "consultant",
        businessRole: "front_desk_student_affairs",
      }),
    ).toBe(true);
    expect(moduleDeniedForFrontDesk("digital_marketing")).toBe(true);
  });

  it("documents a complete default matrix for all 10 roles × 12 modules", () => {
    const snapshot: Record<BusinessRole, Record<BusinessModule, number>> = {} as never;
    for (const role of BUSINESS_ROLES) {
      snapshot[role] = {} as Record<BusinessModule, number>;
      for (const mod of BUSINESS_MODULES) {
        snapshot[role][mod] = getPermissionLevel(role, mod);
      }
    }
    // Spot-check critical cells rather than inventing new permissions.
    expect(snapshot.admin.settings).toBe(3);
    expect(snapshot.manager.settings).toBe(1);
    expect(snapshot.counsellor_consultant.digital_marketing).toBe(0);
    expect(snapshot.digital_manager.digital_marketing).toBe(3);
    expect(snapshot.admission_team.admissions).toBe(3);
    expect(snapshot.hr_system.hr_attendance).toBe(3);
    expect(snapshot.office_ops.orders_sales_purchase).toBe(3);
    expect(snapshot.accounts_banking_finance.fees_payments).toBe(3);
    expect(snapshot.student_portal.users_roles).toBe(0);
    expect(snapshot.front_desk_student_affairs.users_roles).toBe(0);
  });
});
