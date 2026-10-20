import { describe, expect, it } from "vitest";
import {
  canRestoreArchivedRegistration,
  diffIntakeRegistrationFields,
  emailChangeAllowedForIntake,
  FRONT_DESK_INTAKE_PROTECTED_FIELDS,
  isFrontDeskIntakeEditableField,
  mapFrontDeskIntakeManageRpcError,
  validateArchiveReason,
} from "./front-desk-intake-manage";

describe("front desk intake manage rules", () => {
  it("allows editable intake fields and blocks protected ones", () => {
    expect(isFrontDeskIntakeEditableField("phone")).toBe(true);
    expect(isFrontDeskIntakeEditableField("next_follow_up_at")).toBe(true);
    expect(FRONT_DESK_INTAKE_PROTECTED_FIELDS).toContain("portal_activated_at");
    expect(isFrontDeskIntakeEditableField("portal_activated_at")).toBe(false);
  });

  it("blocks email changes after portal link", () => {
    expect(
      emailChangeAllowedForIntake({
        profileId: "user-1",
        previousEmail: "a@example.com",
        nextEmail: "b@example.com",
      }).ok,
    ).toBe(false);
    expect(
      emailChangeAllowedForIntake({
        profileId: null,
        previousEmail: "a@example.com",
        nextEmail: "b@example.com",
      }).ok,
    ).toBe(true);
  });

  it("requires archive reason and admin-only restore", () => {
    expect(validateArchiveReason("ab").ok).toBe(false);
    expect(validateArchiveReason("Duplicate walk-in").ok).toBe(true);
    expect(canRestoreArchivedRegistration({ isAdmin: false })).toBe(false);
    expect(canRestoreArchivedRegistration({ isAdmin: true })).toBe(true);
  });

  it("diffs only editable fields for audit", () => {
    const changes = diffIntakeRegistrationFields(
      { phone: "0300", city: "Lahore", portal_activated_at: null },
      { phone: "0301", city: "Lahore", portal_activated_at: "x" },
    );
    expect(changes).toEqual([{ field: "phone", from: "0300", to: "0301" }]);
  });

  it("maps concurrency and migration errors", () => {
    expect(mapFrontDeskIntakeManageRpcError("updated by someone else").status).toBe(409);
    expect(mapFrontDeskIntakeManageRpcError("Could not find the function").status).toBe(503);
    expect(mapFrontDeskIntakeManageRpcError("Not authorized for this student").status).toBe(403);
  });
});
