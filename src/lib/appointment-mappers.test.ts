import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_TYPE_PLACEHOLDER,
  mapAppointmentRow,
  mapAppointmentStatusDb,
  splitScheduledAtUtc,
} from "./appointment-mappers";
import type { AppointmentRow } from "@/types/database";

const baseRow = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  student_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  consultant_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  status: "confirmed",
  scheduled_at: "2026-06-15T13:45:00.000Z",
  duration_minutes: 30,
  meeting_link: null,
  location: null,
  notes: "Bring passport",
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
} as AppointmentRow;

describe("mapAppointmentStatusDb", () => {
  it("maps every database status to the UI label", () => {
    expect(mapAppointmentStatusDb("requested")).toBe("Requested");
    expect(mapAppointmentStatusDb("confirmed")).toBe("Confirmed");
    expect(mapAppointmentStatusDb("rescheduled")).toBe("Rescheduled");
    expect(mapAppointmentStatusDb("completed")).toBe("Completed");
    expect(mapAppointmentStatusDb("cancelled")).toBe("Cancelled");
    expect(mapAppointmentStatusDb("no_show")).toBe("No Show");
  });
});

describe("splitScheduledAtUtc", () => {
  it("splits timestamptz using UTC components", () => {
    expect(splitScheduledAtUtc("2026-06-15T13:45:00.000Z")).toEqual({
      date: "2026-06-15",
      time: "13:45 UTC",
    });
  });

  it("returns placeholders for null or invalid timestamps", () => {
    expect(splitScheduledAtUtc(null)).toEqual({ date: "—", time: "—" });
    expect(splitScheduledAtUtc(undefined)).toEqual({ date: "—", time: "—" });
    expect(splitScheduledAtUtc("not-a-date")).toEqual({ date: "—", time: "—" });
  });
});

describe("mapAppointmentRow", () => {
  it("maps a live row without inventing type and uses student context when provided", () => {
    const ui = mapAppointmentRow(baseRow, {
      destination: "UK",
      studyLevel: "Master",
      studentName: "Ayesha Khan",
      consultantName: "Desk Officer",
    });
    expect(ui.type).toBe(APPOINTMENT_TYPE_PLACEHOLDER);
    expect(ui.status).toBe("Confirmed");
    expect(ui.date).toBe("2026-06-15");
    expect(ui.time).toBe("13:45 UTC");
    expect(ui.destination).toBe("UK");
    expect(ui.studyLevel).toBe("Master");
    expect(ui.studentName).toBe("Ayesha Khan");
    expect(ui.consultantName).toBe("Desk Officer");
    expect(ui.notes).toBe("Bring passport");
  });

  it("uses neutral placeholders when related student fields are absent", () => {
    const ui = mapAppointmentRow({ ...baseRow, scheduled_at: null, notes: null });
    expect(ui.date).toBe("—");
    expect(ui.time).toBe("—");
    expect(ui.destination).toBe("—");
    expect(ui.studyLevel).toBe("—");
    expect(ui.studentName).toBeUndefined();
    expect(ui.consultantName).toBeUndefined();
  });
});

describe("student scoping intent", () => {
  it("keeps studentId from the row (caller must authorize via profile link)", () => {
    const ui = mapAppointmentRow(baseRow);
    expect(ui.studentId).toBe(baseRow.student_id);
    expect(ui.consultantId).toBe(baseRow.consultant_id);
  });
});
