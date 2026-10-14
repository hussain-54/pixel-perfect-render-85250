/**
 * Staff appointment status transitions for public.appointments.
 * Mirrors appointment_status enum. Does not prove remote RLS/JWT.
 */

export const APPOINTMENT_STATUSES_DB = [
  "requested",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatusDbValue = (typeof APPOINTMENT_STATUSES_DB)[number];

/** UI labels used by the existing Appointment DTO. */
export const APPOINTMENT_STATUS_UI_TO_DB: Record<string, AppointmentStatusDbValue> = {
  Requested: "requested",
  Confirmed: "confirmed",
  Rescheduled: "rescheduled",
  Completed: "completed",
  Cancelled: "cancelled",
  "No Show": "no_show",
};

const STAFF_TRANSITIONS: Record<AppointmentStatusDbValue, readonly AppointmentStatusDbValue[]> = {
  requested: ["confirmed", "cancelled", "rescheduled"],
  confirmed: ["completed", "cancelled", "no_show", "rescheduled"],
  rescheduled: ["confirmed", "cancelled", "completed", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export function parseAppointmentStatusInput(
  value: string | null | undefined,
): AppointmentStatusDbValue | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if ((APPOINTMENT_STATUSES_DB as readonly string[]).includes(raw)) {
    return raw as AppointmentStatusDbValue;
  }
  return APPOINTMENT_STATUS_UI_TO_DB[raw] ?? null;
}

export function canStaffTransitionAppointmentStatus(
  from: string,
  to: AppointmentStatusDbValue,
): boolean {
  if (!(APPOINTMENT_STATUSES_DB as readonly string[]).includes(from)) return false;
  const allowed = STAFF_TRANSITIONS[from as AppointmentStatusDbValue];
  return allowed.includes(to);
}

/** Next actions shown in staff UI for a current DB or UI status. */
export function staffAppointmentStatusActions(current: string): AppointmentStatusDbValue[] {
  const db = parseAppointmentStatusInput(current);
  if (!db) return [];
  return [...STAFF_TRANSITIONS[db]];
}

export function appointmentStatusUpdateDenied(input: {
  fromStatus: string;
  toStatus: string;
  actorIsStaff: boolean;
}): string | null {
  if (!input.actorIsStaff) {
    return "Only staff can change appointment status.";
  }
  const to = parseAppointmentStatusInput(input.toStatus);
  if (!to) return "Invalid appointment status.";
  if (!canStaffTransitionAppointmentStatus(input.fromStatus, to)) {
    return `Cannot change appointment status from ${input.fromStatus} to ${to}.`;
  }
  return null;
}
