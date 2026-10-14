import { describe, expect, it } from "vitest";
import {
  appointmentStatusUpdateDenied,
  canStaffTransitionAppointmentStatus,
  parseAppointmentStatusInput,
  staffAppointmentStatusActions,
} from "./appointment-status-rules";

describe("appointment status rules (staff)", () => {
  it("parses DB and UI status labels", () => {
    expect(parseAppointmentStatusInput("confirmed")).toBe("confirmed");
    expect(parseAppointmentStatusInput("Confirmed")).toBe("confirmed");
    expect(parseAppointmentStatusInput("No Show")).toBe("no_show");
    expect(parseAppointmentStatusInput("bogus")).toBeNull();
  });

  it("allows counsellor confirm/cancel from requested", () => {
    expect(canStaffTransitionAppointmentStatus("requested", "confirmed")).toBe(true);
    expect(canStaffTransitionAppointmentStatus("requested", "cancelled")).toBe(true);
    expect(canStaffTransitionAppointmentStatus("requested", "completed")).toBe(false);
  });

  it("blocks terminal statuses and non-staff", () => {
    expect(staffAppointmentStatusActions("completed")).toEqual([]);
    expect(
      appointmentStatusUpdateDenied({
        fromStatus: "completed",
        toStatus: "confirmed",
        actorIsStaff: true,
      }),
    ).toMatch(/Cannot change/);
    expect(
      appointmentStatusUpdateDenied({
        fromStatus: "requested",
        toStatus: "confirmed",
        actorIsStaff: false,
      }),
    ).toMatch(/Only staff/);
  });

  it("exposes UI actions for requested appointments", () => {
    expect(staffAppointmentStatusActions("Requested")).toEqual([
      "confirmed",
      "cancelled",
      "rescheduled",
    ]);
  });
});
