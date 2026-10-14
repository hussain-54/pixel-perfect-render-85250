import { describe, expect, it } from "vitest";
import {
  buildStudentSelfEditPatch,
  studentSelfEditPatchIsSafe,
} from "./student-profile-self-edit-rules";
import { studentStaffFieldUpdateDenied } from "./student-staff-field-rules";

describe("student profile self-edit rules", () => {
  it("builds allow-listed contact patch and rejects invalid input", () => {
    const ok = buildStudentSelfEditPatch({
      phone: "+92 300 1234567",
      city: "Lahore",
      studyLevel: "Master",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.patch).toEqual({
        phone: "+92 300 1234567",
        city: "Lahore",
        study_level: "Master",
      });
      expect(studentSelfEditPatchIsSafe(ok.patch)).toBe(true);
    }

    expect(buildStudentSelfEditPatch({ phone: "123" }).ok).toBe(false);
    expect(buildStudentSelfEditPatch({ dob: "01-01-2000" }).ok).toBe(false);
    expect(buildStudentSelfEditPatch({}).ok).toBe(false);
  });

  it("clears optional fields with empty strings", () => {
    const ok = buildStudentSelfEditPatch({ whatsapp: "  ", city: "" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.patch).toEqual({ whatsapp: null, city: null });
    }
  });

  it("aligns with staff-field guard: owning student may change phone/city, not email/name", () => {
    const owning = {
      isAdmin: false,
      isAssignedConsultant: false,
      canVerifySignupFee: false,
      isRegistrarOwner: false,
      isOwningStudent: true,
    };
    expect(
      studentStaffFieldUpdateDenied({
        actor: owning,
        changedFields: [
          "phone",
          "whatsapp",
          "city",
          "destination",
          "program",
          "study_level",
          "dob",
        ],
        registeredByChanged: false,
      }),
    ).toBeNull();
    expect(
      studentStaffFieldUpdateDenied({
        actor: owning,
        changedFields: ["email"],
        registeredByChanged: false,
      }),
    ).toMatch(/staff-controlled/);
    expect(
      studentStaffFieldUpdateDenied({
        actor: owning,
        changedFields: ["full_name"],
        registeredByChanged: false,
      }),
    ).toMatch(/staff-controlled/);
  });
});
