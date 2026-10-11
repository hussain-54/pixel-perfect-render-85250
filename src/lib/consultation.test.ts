import { describe, expect, it } from "vitest";
import {
  CONSULTATION_PERSISTENCE_ERROR,
  isConsultationReference,
  newConsultationReference,
  publicConsultationErrorMessage,
  resolveConsultationReference,
  resolveConsultationSubmitUi,
  validateConsultationRequest,
  type ConsultationSubmitResult,
} from "./consultation";

const validPayload = {
  name: "Sara Khan",
  email: "sara@example.com",
  phone: "+92 300 1234567",
  destination: "UK",
  level: "Master's",
  program: "CS",
  date: "",
  message: "Hello",
  whatsapp: "",
};

describe("consultation validation", () => {
  it("rejects incomplete submissions", () => {
    const r = validateConsultationRequest({ name: "A", email: "bad", phone: "12" });
    expect(r.success).toBe(false);
  });

  it("accepts a complete request", () => {
    const r = validateConsultationRequest(validPayload);
    expect(r.success).toBe(true);
  });

  it("accepts an optional retry reference_code", () => {
    const r = validateConsultationRequest({
      ...validPayload,
      reference_code: "REQ-ABC123",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a malformed reference_code", () => {
    const r = validateConsultationRequest({
      ...validPayload,
      reference_code: "not-a-ref",
    });
    expect(r.success).toBe(false);
  });
});

describe("consultation references", () => {
  it("builds REQ references", () => {
    expect(newConsultationReference()).toMatch(/^REQ-[A-Z0-9]+$/);
    expect(isConsultationReference("REQ-ZZ99")).toBe(true);
    expect(isConsultationReference("req-zz99")).toBe(false);
  });

  it("reuses the same reference for retries of one attempt", () => {
    const first = resolveConsultationReference(null);
    const again = resolveConsultationReference(first);
    expect(again).toBe(first);
  });
});

describe("consultation submit UI (fail-closed)", () => {
  it("shows success with reference only when persisted", () => {
    const result: ConsultationSubmitResult = {
      ok: true,
      persisted: true,
      ref: "REQ-OK1",
    };
    expect(resolveConsultationSubmitUi(result)).toEqual({
      kind: "success",
      ref: "REQ-OK1",
    });
  });

  it("treats persisted: false as failure, not success", () => {
    const result: ConsultationSubmitResult = {
      ok: false,
      persisted: false,
      ref: "REQ-FAIL1",
      error: CONSULTATION_PERSISTENCE_ERROR,
    };
    const ui = resolveConsultationSubmitUi(result);
    expect(ui.kind).toBe("failure");
    expect(ui.ref).toBe("REQ-FAIL1");
    expect(ui.error).toBe(CONSULTATION_PERSISTENCE_ERROR);
    expect(ui.error).not.toMatch(/will contact you/i);
  });

  it("maps thrown/internal server errors to a safe public message", () => {
    expect(publicConsultationErrorMessage("503:permission denied for table consultation_requests")).toBe(
      CONSULTATION_PERSISTENCE_ERROR,
    );
    expect(publicConsultationErrorMessage("42501: RLS")).toBe(CONSULTATION_PERSISTENCE_ERROR);
    expect(publicConsultationErrorMessage("400:Please enter your full name.")).toBe(
      "Please enter your full name.",
    );
  });

  it("failed submission keeps the attempt reference for retry", () => {
    const failed: ConsultationSubmitResult = {
      ok: false,
      persisted: false,
      ref: "REQ-RETRY1",
      error: CONSULTATION_PERSISTENCE_ERROR,
    };
    const ui = resolveConsultationSubmitUi(failed);
    expect(ui.kind).toBe("failure");
    expect(resolveConsultationReference(ui.ref)).toBe("REQ-RETRY1");
  });
});