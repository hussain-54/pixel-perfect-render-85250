/**
 * Map public.appointments rows to the existing portal Appointment DTO.
 * Timestamps are split in UTC — never treat timestamptz as a silent local wall clock.
 */
import type { Appointment, AppointmentStatus } from "@/types";
import type { AppointmentRow, AppointmentStatusDb } from "@/types/database";

const STATUS_TO_UI: Record<AppointmentStatusDb, AppointmentStatus> = {
  requested: "Requested",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

/** Neutral placeholder when DB has no appointment-type column. */
export const APPOINTMENT_TYPE_PLACEHOLDER = "—" as const;

export function mapAppointmentStatusDb(status: AppointmentStatusDb | string): AppointmentStatus {
  if (status in STATUS_TO_UI) {
    return STATUS_TO_UI[status as AppointmentStatusDb];
  }
  return "Requested";
}

/**
 * Split timestamptz into UTC calendar date (YYYY-MM-DD) and UTC clock (HH:MM UTC).
 * Null/invalid → neutral placeholders (fmtDate already treats "—" / empty safely).
 */
export function splitScheduledAtUtc(scheduledAt: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!scheduledAt?.trim()) {
    return { date: "—", time: "—" };
  }
  const ms = Date.parse(scheduledAt);
  if (Number.isNaN(ms)) {
    return { date: "—", time: "—" };
  }
  const iso = new Date(ms).toISOString();
  return {
    date: iso.slice(0, 10),
    time: `${iso.slice(11, 16)} UTC`,
  };
}

export type AppointmentMapContext = {
  /** Destination / study level from a trustworthy related student row only. */
  destination?: string | null;
  studyLevel?: string | null;
  studentName?: string | null;
  consultantName?: string | null;
};

export function mapAppointmentRow(
  row: AppointmentRow,
  ctx: AppointmentMapContext = {},
): Appointment {
  const { date, time } = splitScheduledAtUtc(row.scheduled_at);
  const appointment: Appointment = {
    id: row.id,
    studentId: row.student_id,
    type: APPOINTMENT_TYPE_PLACEHOLDER,
    date,
    time,
    consultantId: row.consultant_id ?? "",
    destination: ctx.destination?.trim() || "—",
    studyLevel: ctx.studyLevel?.trim() || "—",
    status: mapAppointmentStatusDb(row.status),
  };
  if (row.notes?.trim()) appointment.notes = row.notes.trim();
  if (ctx.studentName?.trim()) appointment.studentName = ctx.studentName.trim();
  if (ctx.consultantName?.trim()) appointment.consultantName = ctx.consultantName.trim();
  return appointment;
}
