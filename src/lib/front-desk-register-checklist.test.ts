import { describe, expect, it } from "vitest";
import {
  buildRegisterChecklist,
  countRequiredRemaining,
  registerFormCanSubmit,
  type RegisterFormSnapshot,
} from "./front-desk-register-checklist";

const base: RegisterFormSnapshot = {
  fullName: "",
  email: "",
  phone: "",
  whatsapp: "",
  whatsappSameAsPhone: true,
  city: "",
  cityOther: "",
  destination: "",
  destinationOther: "",
  program: "",
  programOther: "",
  studyLevel: "",
  studyLevelOther: "",
  inquirySource: "",
  inquirySourceOther: "",
  feeAmount: "",
  assignedConsultantId: "",
};

describe("front-desk register checklist", () => {
  it("keeps Register disabled until required contact + preference fields are valid", () => {
    expect(registerFormCanSubmit(base)).toBe(false);
    expect(countRequiredRemaining(base)).toBe(5);

    const filled: RegisterFormSnapshot = {
      ...base,
      fullName: "Sara Khan",
      email: "sara@example.com",
      phone: "+92 300 1234567",
      destination: "United Kingdom",
      program: "Computer Science",
    };
    expect(registerFormCanSubmit(filled)).toBe(true);
    expect(countRequiredRemaining(filled)).toBe(0);

    const checklist = buildRegisterChecklist(filled);
    expect(checklist.find((s) => s.id === "contact")?.status).toBe("complete");
    expect(checklist.find((s) => s.id === "preferences")?.status).toBe("complete");
    expect(checklist.find((s) => s.id === "signup_fee")?.status).toBe("optional");
    expect(checklist.find((s) => s.id === "counsellor")?.status).toBe("optional");
    expect(checklist.find((s) => s.id === "final")?.status).toBe("complete");
  });

  it("does not treat optional fee/counsellor as required; Other needs custom text", () => {
    const withOther: RegisterFormSnapshot = {
      ...base,
      fullName: "Sara Khan",
      email: "sara@example.com",
      phone: "+92 300 1234567",
      destination: "Other",
      destinationOther: "",
      program: "Computer Science",
      feeAmount: "5000",
      assignedConsultantId: "c1",
    };
    expect(registerFormCanSubmit(withOther)).toBe(false);
    withOther.destinationOther = "Spain";
    expect(registerFormCanSubmit(withOther)).toBe(true);
    const checklist = buildRegisterChecklist(withOther);
    expect(checklist.find((s) => s.id === "signup_fee")?.status).toBe("complete");
    expect(checklist.find((s) => s.id === "counsellor")?.status).toBe("complete");
  });
});
