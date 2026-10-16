import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETE_CASCADES_ONLY,
  ACCOUNT_DELETE_PRESERVES,
  accountAccessIsRevoked,
  authBanDurationForRemoveAccess,
  validateAccountAccessAction,
} from "./account-access-rules";

describe("account access rules — Remove Access / Delete User", () => {
  it("blocks unauthorized-shaped inputs (missing actor/target)", () => {
    expect(
      validateAccountAccessAction({
        action: "remove_access",
        actorUserId: "",
        targetUserId: "t1",
        targetAppRole: "consultant",
        protectedAdminCount: 2,
      }).ok,
    ).toBe(false);
    expect(
      validateAccountAccessAction({
        action: "delete_user",
        actorUserId: "a1",
        targetUserId: "",
        targetAppRole: "consultant",
        protectedAdminCount: 2,
      }).ok,
    ).toBe(false);
  });

  it("blocks self remove-access and self delete", () => {
    const remove = validateAccountAccessAction({
      action: "remove_access",
      actorUserId: "admin-1",
      targetUserId: "admin-1",
      targetAppRole: "admin",
      protectedAdminCount: 3,
    });
    expect(remove.ok).toBe(false);
    if (!remove.ok) expect(remove.code).toBe("self_action_denied");

    const del = validateAccountAccessAction({
      action: "delete_user",
      actorUserId: "admin-1",
      targetUserId: "admin-1",
      targetAppRole: "admin",
      protectedAdminCount: 3,
    });
    expect(del.ok).toBe(false);
    if (!del.ok) {
      expect(del.code).toBe("self_action_denied");
      expect(del.error).toMatch(/own signed-in/i);
    }
  });

  it("blocks removing or deleting the last protected administrator", () => {
    const remove = validateAccountAccessAction({
      action: "remove_access",
      actorUserId: "a1",
      targetUserId: "a2",
      targetAppRole: "admin",
      protectedAdminCount: 1,
    });
    expect(remove.ok).toBe(false);
    if (!remove.ok) expect(remove.code).toBe("last_admin_protected");

    const del = validateAccountAccessAction({
      action: "delete_user",
      actorUserId: "a1",
      targetUserId: "a2",
      targetAppRole: "super_admin",
      protectedAdminCount: 1,
    });
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error).toMatch(/last protected administrator/i);
  });

  it("allows remove access for staff/students when another admin remains", () => {
    for (const role of ["student", "consultant", "admin"] as const) {
      const r = validateAccountAccessAction({
        action: "remove_access",
        actorUserId: "actor",
        targetUserId: "target",
        targetAppRole: role,
        protectedAdminCount: role === "admin" ? 2 : 1,
      });
      expect(r).toEqual({ ok: true, strategy: "revoke_access" });
    }
    expect(authBanDurationForRemoveAccess()).toMatch(/h$/);
  });

  it("blocks hard delete when a student CRM profile is linked", () => {
    const r = validateAccountAccessAction({
      action: "delete_user",
      actorUserId: "actor",
      targetUserId: "stu-login",
      targetAppRole: "student",
      protectedAdminCount: 2,
      links: {
        linkedStudentProfiles: 1,
        assignedStudents: 0,
        applicationsOwned: 0,
        documentVersionsUploaded: 0,
        auditEventsAsActor: 0,
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("linked_student_blocks_delete");
      expect(r.error).toMatch(/Remove Access/i);
    }
  });

  it("allows hard delete of staff without student CRM; documents SET NULL safety contract", () => {
    const r = validateAccountAccessAction({
      action: "delete_user",
      actorUserId: "actor",
      targetUserId: "staff-1",
      targetAppRole: "consultant",
      protectedAdminCount: 2,
      links: {
        linkedStudentProfiles: 0,
        assignedStudents: 4,
        applicationsOwned: 2,
        documentVersionsUploaded: 1,
        auditEventsAsActor: 9,
      },
    });
    expect(r).toEqual({ ok: true, strategy: "hard_delete_auth" });
    expect(ACCOUNT_DELETE_PRESERVES.join(" ")).toMatch(/students/i);
    expect(ACCOUNT_DELETE_PRESERVES.join(" ")).toMatch(/audit/i);
    expect(ACCOUNT_DELETE_CASCADES_ONLY.join(" ")).toMatch(/consultants/i);
    expect(ACCOUNT_DELETE_CASCADES_ONLY.join(" ")).not.toMatch(/applications/i);
  });

  it("treats banned or inactive desk as access revoked for status helpers", () => {
    expect(accountAccessIsRevoked({ banned: true, deskStatus: "active" })).toBe(true);
    expect(accountAccessIsRevoked({ banned: false, deskStatus: "inactive" })).toBe(true);
    expect(accountAccessIsRevoked({ banned: false, deskStatus: "active" })).toBe(false);
    expect(accountAccessIsRevoked({ banned: false, deskStatus: "n/a" })).toBe(false);
  });

  it("deactivation/remove-access path preserves linked business data (no hard delete)", () => {
    const r = validateAccountAccessAction({
      action: "remove_access",
      actorUserId: "actor",
      targetUserId: "stu-login",
      targetAppRole: "student",
      protectedAdminCount: 1,
      links: {
        linkedStudentProfiles: 1,
        assignedStudents: 0,
        applicationsOwned: 5,
        documentVersionsUploaded: 3,
        auditEventsAsActor: 0,
      },
    });
    expect(r).toEqual({ ok: true, strategy: "revoke_access" });
  });
});
