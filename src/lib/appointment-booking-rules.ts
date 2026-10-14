/**
 * Student appointment request validation.
 * Aligns with public.appointments columns + default status `requested`.
 * Does not prove remote RLS/JWT.
 */

export const STUDENT_BOOKING_STATUSES = ["requested"] as const;
export type StudentBookingStatus = (typeof STUDENT_BOOKING_STATUSES)[number];

export const ALLOWED_DURATIONS_MINUTES = [15, 30, 45, 60] as const;
export const DEFAULT_DURATION_MINUTES = 30;
export const MAX_NOTES_LENGTH = 500;

/** Open statuses that block a duplicate slot for the same student. */
export const CONFLICTING_APPOINTMENT_STATUSES = ["requested", "confirmed", "rescheduled"] as const;

export type AppointmentBookingInput = {
  /** Calendar date YYYY-MM-DD (UTC date component). */
  date: string;
  /** Clock HH:MM (UTC). */
  time: string;
  notes?: string;
  durationMinutes?: number;
};

export type AppointmentBookingInsert = {
  status: StudentBookingStatus;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
};

function isValidDatePart(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const ms = Date.parse(`${date}T12:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  const iso = new Date(ms).toISOString().slice(0, 10);
  return iso === date;
}

/** Normalize HH:MM or HH:MM:SS → HH:MM. */
export function normalizeBookingTime(time: string): string | null {
  const t = time.trim();
  const m = t.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${m[1]}:${m[2]}`;
}

/**
 * Build an appointments INSERT payload from student form fields.
 * Never accepts student_id, consultant_id, status, or created_by from the client.
 */
export function buildStudentAppointmentBooking(
  input: AppointmentBookingInput,
  nowMs: number = Date.now(),
): { ok: true; insert: AppointmentBookingInsert } | { ok: false; error: string } {
  const date = input.date?.trim() ?? "";
  const timeRaw = input.time?.trim() ?? "";
  if (!date || !timeRaw) {
    return { ok: false, error: "Date and time are required." };
  }
  if (!isValidDatePart(date)) {
    return { ok: false, error: "Date must be YYYY-MM-DD." };
  }
  const time = normalizeBookingTime(timeRaw);
  if (!time) {
    return { ok: false, error: "Time must be HH:MM (UTC)." };
  }

  const scheduledAt = `${date}T${time}:00.000Z`;
  const scheduledMs = Date.parse(scheduledAt);
  if (Number.isNaN(scheduledMs)) {
    return { ok: false, error: "Invalid appointment date/time." };
  }
  if (scheduledMs <= nowMs) {
    return { ok: false, error: "Choose a future appointment time." };
  }

  let duration = DEFAULT_DURATION_MINUTES;
  if (input.durationMinutes !== undefined) {
    if (!(ALLOWED_DURATIONS_MINUTES as readonly number[]).includes(input.durationMinutes)) {
      return { ok: false, error: "Duration must be 15, 30, 45, or 60 minutes." };
    }
    duration = input.durationMinutes;
  }

  let notes: string | null = null;
  if (input.notes !== undefined) {
    const trimmed = input.notes.trim();
    if (trimmed.length > MAX_NOTES_LENGTH) {
      return { ok: false, error: `Notes must be at most ${MAX_NOTES_LENGTH} characters.` };
    }
    notes = trimmed.length ? trimmed : null;
  }

  return {
    ok: true,
    insert: {
      status: "requested",
      scheduled_at: scheduledAt,
      duration_minutes: duration,
      notes,
    },
  };
}

export type ExistingAppointmentSnap = {
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: string;
};

/**
 * Soft conflict: overlapping window with another open appointment for the same student.
 */
export function appointmentBookingConflicts(
  candidateScheduledAt: string,
  candidateDurationMinutes: number,
  existing: readonly ExistingAppointmentSnap[],
): boolean {
  const start = Date.parse(candidateScheduledAt);
  if (Number.isNaN(start)) return false;
  const end = start + candidateDurationMinutes * 60_000;

  for (const row of existing) {
    if (!(CONFLICTING_APPOINTMENT_STATUSES as readonly string[]).includes(row.status)) {
      continue;
    }
    if (!row.scheduled_at) continue;
    const otherStart = Date.parse(row.scheduled_at);
    if (Number.isNaN(otherStart)) continue;
    const otherDur = row.duration_minutes && row.duration_minutes > 0 ? row.duration_minutes : 30;
    const otherEnd = otherStart + otherDur * 60_000;
    if (start < otherEnd && otherStart < end) return true;
  }
  return false;
}

/** Unit helper: ensure client cannot dictate ownership or privileged columns. */
export function studentBookingPayloadIsSafe(payload: Record<string, unknown>): boolean {
  const forbidden = ["student_id", "consultant_id", "created_by", "id", "meeting_link", "location"];
  if (forbidden.some((k) => k in payload)) return false;
  if (payload["status"] !== undefined && payload["status"] !== "requested") return false;
  return true;
}
