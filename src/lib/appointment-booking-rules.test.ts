import { describe, expect, it } from "vitest";
import {
  appointmentBookingConflicts,
  buildStudentAppointmentBooking,
  studentBookingPayloadIsSafe,
} from "./appointment-booking-rules";

const NOW = Date.parse("2026-10-14T10:00:00.000Z");

describe("buildStudentAppointmentBooking", () => {
  it("builds a requested insert with UTC scheduled_at", () => {
    const result = buildStudentAppointmentBooking(
      { date: "2026-10-20", time: "14:30", notes: " Visa chat ", durationMinutes: 45 },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.insert).toEqual({
        status: "requested",
        scheduled_at: "2026-10-20T14:30:00.000Z",
        duration_minutes: 45,
        notes: "Visa chat",
      });
      expect(studentBookingPayloadIsSafe(result.insert)).toBe(true);
    }
  });

  it("rejects past times, bad formats, and invalid duration", () => {
    expect(buildStudentAppointmentBooking({ date: "2026-10-14", time: "09:00" }, NOW).ok).toBe(
      false,
    );
    expect(buildStudentAppointmentBooking({ date: "20-10-2026", time: "14:00" }, NOW).ok).toBe(
      false,
    );
    expect(buildStudentAppointmentBooking({ date: "2026-10-20", time: "25:00" }, NOW).ok).toBe(
      false,
    );
    expect(
      buildStudentAppointmentBooking(
        { date: "2026-10-20", time: "14:00", durationMinutes: 90 },
        NOW,
      ).ok,
    ).toBe(false);
    expect(buildStudentAppointmentBooking({ date: "", time: "" }, NOW).ok).toBe(false);
  });

  it("marks payloads with ownership fields as unsafe", () => {
    expect(
      studentBookingPayloadIsSafe({
        status: "requested",
        student_id: "x",
        scheduled_at: "2026-10-20T14:00:00.000Z",
      }),
    ).toBe(false);
    expect(studentBookingPayloadIsSafe({ status: "confirmed" })).toBe(false);
  });
});

describe("appointmentBookingConflicts", () => {
  it("detects overlapping open appointments and ignores cancelled", () => {
    const existing = [
      {
        scheduled_at: "2026-10-20T14:00:00.000Z",
        duration_minutes: 30,
        status: "requested",
      },
      {
        scheduled_at: "2026-10-21T10:00:00.000Z",
        duration_minutes: 30,
        status: "cancelled",
      },
    ];
    expect(appointmentBookingConflicts("2026-10-20T14:15:00.000Z", 30, existing)).toBe(true);
    expect(appointmentBookingConflicts("2026-10-20T15:00:00.000Z", 30, existing)).toBe(false);
    expect(appointmentBookingConflicts("2026-10-21T10:00:00.000Z", 30, existing)).toBe(false);
  });
});
