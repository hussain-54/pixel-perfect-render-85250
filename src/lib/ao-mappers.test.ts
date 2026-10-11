import { describe, expect, it } from "vitest";
import { mapStudentRow, mapApplicationRow, uiStatusToAppStage } from "./ao-mappers";
import type { ApplicationRow, StudentRow } from "@/types/database";

const student = {
  id: "11111111-1111-1111-1111-111111111111",
  profile_id: null,
  case_id: "GR-100",
  full_name: "Test Student",
  email: "test@example.com",
  phone: "123",
  whatsapp: null,
  city: null,
  dob: null,
  destination: "UK",
  program: "CS",
  study_level: "Master",
  journey_stage: "documents_under_review",
  assigned_consultant_id: "22222222-2222-2222-2222-222222222222",
  last_activity_at: null,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
} as StudentRow;

describe("ao-mappers", () => {
  it("maps student UUID and assignment fields", () => {
    const ui = mapStudentRow(student);
    expect(ui.id).toBe(student.id);
    expect(ui.caseId).toBe("GR-100");
    expect(ui.consultantId).toBe(student.assigned_consultant_id);
    expect(ui.stage).toBe("documents_under_review");
  });

  it("maps application stages to Title Case UI statuses", () => {
    const row = {
      id: "33333333-3333-3333-3333-333333333333",
      student_id: student.id,
      university_id: null,
      program_id: null,
      university_name: "Test U",
      program_name: "MSc",
      country: "UK",
      intake: "Sep 2026",
      deadline: "2026-06-01",
      stage: "under_review",
      portal_ref: null,
      submitted_at: null,
      decision_at: null,
      owned_by_consultant_id: student.assigned_consultant_id,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    } as ApplicationRow;
    expect(mapApplicationRow(row).status).toBe("Under Review");
    expect(uiStatusToAppStage("Ready to Submit")).toBe("ready_to_submit");
  });
});
