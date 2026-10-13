import { describe, expect, it } from "vitest";
import {
  BUSINESS_PERMISSION_MATRIX,
  canFullyApproveModule,
  getPermissionLevel,
} from "./business-permissions";
import { portalHomeByRole, roleCanAccessPortal } from "./roles";

describe("portal access authorization", () => {
  it("denies students and consultants from admin portal routes", () => {
    expect(roleCanAccessPortal("student", "admin")).toBe(false);
    expect(roleCanAccessPortal("consultant", "admin")).toBe(false);
    expect(roleCanAccessPortal("admin", "admin")).toBe(true);
  });

  it("keeps consultants on staff home and students on student home", () => {
    expect(portalHomeByRole.consultant).toBe("/staff/dashboard");
    expect(portalHomeByRole.student).toBe("/student/dashboard");
    expect(roleCanAccessPortal("consultant", "staff")).toBe(true);
    expect(roleCanAccessPortal("student", "staff")).toBe(false);
  });

  it("does not grant front-desk users_roles full/approve access", () => {
    expect(getPermissionLevel("front_desk_student_affairs", "users_roles")).toBe(0);
    expect(canFullyApproveModule("front_desk_student_affairs", "users_roles")).toBe(false);
    expect(getPermissionLevel("admin", "users_roles")).toBe(3);
    expect(BUSINESS_PERMISSION_MATRIX.admin[10]).toBe(3);
  });
});
