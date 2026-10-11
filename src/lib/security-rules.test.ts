import { describe, expect, it } from "vitest";
import { normalizeAppRole, roleCanAccessPortal, STAFF_DESK_ROLES, ADMISSION_OFFICER_ROLE } from "./roles";
import { validateConsultationRequest, newConsultationReference } from "./consultation";
import { findDemoAccountByEmail } from "./demo-auth";

describe("role normalization", () => {
  it("maps admission_officer and staff aliases to consultant", () => {
    expect(normalizeAppRole("admission_officer")).toBe("consultant");
    expect(normalizeAppRole("staff")).toBe("consultant");
    expect(normalizeAppRole("ADMISSION_OFFICER")).toBe("consultant");
  });

  it("does not elevate unknown or empty roles", () => {
    expect(normalizeAppRole("superuser")).toBeNull();
    expect(normalizeAppRole("")).toBeNull();
    expect(normalizeAppRole(null)).toBeNull();
  });

  it("keeps Admission Officer on the consultant desk for compatibility", () => {
    expect(ADMISSION_OFFICER_ROLE).toBe("consultant");
    expect(STAFF_DESK_ROLES).toContain("consultant");
    expect(roleCanAccessPortal("consultant", "staff")).toBe(true);
    expect(roleCanAccessPortal("student", "staff")).toBe(false);
    expect(roleCanAccessPortal("student", "admin")).toBe(false);
  });
});

describe("consultation validation", () => {
  it("rejects incomplete submissions", () => {
    const r = validateConsultationRequest({ name: "A", email: "bad", phone: "12" });
    expect(r.success).toBe(false);
  });

  it("accepts a complete request and builds a REQ reference", () => {
    const r = validateConsultationRequest({
      name: "Sara Khan",
      email: "sara@example.com",
      phone: "+92 300 1234567",
      destination: "UK",
      level: "Master's",
      program: "CS",
      date: "",
      message: "Hello",
      whatsapp: "",
    });
    expect(r.success).toBe(true);
    expect(newConsultationReference()).toMatch(/^REQ-[A-Z0-9]+$/);
  });
});

describe("demo account role source", () => {
  it("binds demo student to a known mock email", () => {
    const account = findDemoAccountByEmail("ayesha@globalroots.pk");
    expect(account?.role).toBe("student");
  });

  it("does not invent staff roles for unknown emails", () => {
    expect(findDemoAccountByEmail("attacker@example.com")).toBeNull();
  });
});
