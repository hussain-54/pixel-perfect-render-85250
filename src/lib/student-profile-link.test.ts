import { describe, expect, it } from "vitest";
import { evaluateStudentClaim, resolveProfileIdForIntake } from "./student-profile-link";

describe("resolveProfileIdForIntake", () => {
  it("attaches existing profile id by email match path", () => {
    const r = resolveProfileIdForIntake({
      studentEmail: "Ali@Example.com",
      existingProfileId: "prof-1",
    });
    expect(r.profileId).toBe("prof-1");
    expect(r.outcome).toEqual({ ok: true, mode: "staff_set_existing_profile" });
  });

  it("leaves profile null when no auth profile exists yet", () => {
    const r = resolveProfileIdForIntake({
      studentEmail: "new@example.com",
      existingProfileId: null,
    });
    expect(r.profileId).toBeNull();
    expect(r.outcome.ok).toBe(false);
  });
});

describe("evaluateStudentClaim", () => {
  it("allows claim when emails match and profile_id is null", () => {
    const r = evaluateStudentClaim({
      authUserId: "u1",
      authEmail: "ali@example.com",
      crm: { id: "s1", email: "Ali@example.com", profile_id: null },
    });
    expect(r).toEqual({ ok: true, mode: "linked_by_email" });
  });

  it("rejects client ownership when CRM linked to another user", () => {
    const r = evaluateStudentClaim({
      authUserId: "u1",
      authEmail: "ali@example.com",
      crm: { id: "s1", email: "ali@example.com", profile_id: "other" },
    });
    expect(r).toEqual({ ok: false, reason: "already_linked_other" });
  });

  it("rejects email mismatch (never trust client student id alone)", () => {
    const r = evaluateStudentClaim({
      authUserId: "u1",
      authEmail: "one@example.com",
      crm: { id: "s1", email: "two@example.com", profile_id: null },
    });
    expect(r).toEqual({ ok: false, reason: "email_mismatch" });
  });
});
