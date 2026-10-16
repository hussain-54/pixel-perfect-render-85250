import { describe, expect, it } from "vitest";
import { validateAccountRoleUpdate } from "./account-provisioning";

describe("account role update rules", () => {
  it("accepts reassignment of an existing consultant to another staff business role", () => {
    const result = validateAccountRoleUpdate({
      targetAppRole: "consultant",
      nextBusinessRole: "admission_team",
      isSelf: false,
      protectedAdminCount: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appRole).toBe("consultant");
    expect(result.businessRole).toBe("admission_team");
    expect(result.needsConsultantDesk).toBe(true);
  });

  it("rejects super_admin targets and assignments", () => {
    expect(
      validateAccountRoleUpdate({
        targetAppRole: "super_admin",
        nextBusinessRole: "admin",
        isSelf: false,
        protectedAdminCount: 2,
      }).ok,
    ).toBe(false);
    expect(
      validateAccountRoleUpdate({
        targetAppRole: "consultant",
        nextBusinessRole: "not_a_role",
        isSelf: false,
        protectedAdminCount: 1,
      }).ok,
    ).toBe(false);
  });

  it("blocks demoting the last protected admin and self-demotion", () => {
    const lastAdmin = validateAccountRoleUpdate({
      targetAppRole: "admin",
      nextBusinessRole: "counsellor_consultant",
      isSelf: false,
      protectedAdminCount: 1,
    });
    expect(lastAdmin.ok).toBe(false);
    if (lastAdmin.ok) return;
    expect(lastAdmin.status).toBe(403);

    const selfDemote = validateAccountRoleUpdate({
      targetAppRole: "admin",
      nextBusinessRole: "manager",
      isSelf: true,
      protectedAdminCount: 3,
    });
    expect(selfDemote.ok).toBe(false);
    if (selfDemote.ok) return;
    expect(selfDemote.error).toMatch(/demote your own/i);
  });

  it("allows promoting a staff member to admin when another admin remains", () => {
    const result = validateAccountRoleUpdate({
      targetAppRole: "consultant",
      nextBusinessRole: "admin",
      isSelf: false,
      protectedAdminCount: 1,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.appRole).toBe("admin");
    expect(result.needsConsultantDesk).toBe(false);
  });
});
