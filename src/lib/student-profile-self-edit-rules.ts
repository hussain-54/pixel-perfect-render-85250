/**
 * Student self-service contact edits on public.students.
 * Mirrors students_update_self_contact + enforce_student_staff_fields allow path.
 * Does not prove remote RLS/JWT.
 */

export const STUDENT_SELF_EDIT_FIELDS = [
  "phone",
  "whatsapp",
  "city",
  "dob",
  "destination",
  "program",
  "study_level",
] as const;

export type StudentSelfEditField = (typeof STUDENT_SELF_EDIT_FIELDS)[number];

export type StudentSelfEditInput = {
  phone?: string;
  whatsapp?: string;
  city?: string;
  dob?: string;
  destination?: string;
  program?: string;
  studyLevel?: string;
};

export type StudentSelfEditPatch = Partial<Record<StudentSelfEditField, string | null>>;

function trimOrNull(value: string | undefined, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  if (!t) return null;
  if (t.length > max) return undefined; // signal invalid via caller
  return t;
}

function isValidDob(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T12:00:00.000Z`);
  return !Number.isNaN(t);
}

/**
 * Build a DB patch from client form fields.
 * Rejects unknown keys by never reading them. Validates lengths/dates.
 */
export function buildStudentSelfEditPatch(
  input: StudentSelfEditInput,
): { ok: true; patch: StudentSelfEditPatch } | { ok: false; error: string } {
  const patch: StudentSelfEditPatch = {};

  const phone = trimOrNull(input.phone, 40);
  if (input.phone !== undefined) {
    if (phone === undefined) return { ok: false, error: "Phone is too long." };
    if (phone && phone.replace(/\D/g, "").length < 8) {
      return { ok: false, error: "Enter a valid phone number." };
    }
    patch.phone = phone;
  }

  const whatsapp = trimOrNull(input.whatsapp, 40);
  if (input.whatsapp !== undefined) {
    if (whatsapp === undefined) return { ok: false, error: "WhatsApp is too long." };
    patch.whatsapp = whatsapp;
  }

  const city = trimOrNull(input.city, 80);
  if (input.city !== undefined) {
    if (city === undefined) return { ok: false, error: "City is too long." };
    patch.city = city;
  }

  if (input.dob !== undefined) {
    const dob = input.dob.trim() === "" ? null : input.dob.trim();
    if (!isValidDob(dob)) return { ok: false, error: "Date of birth must be YYYY-MM-DD." };
    patch.dob = dob;
  }

  const destination = trimOrNull(input.destination, 80);
  if (input.destination !== undefined) {
    if (destination === undefined) return { ok: false, error: "Destination is too long." };
    patch.destination = destination;
  }

  const program = trimOrNull(input.program, 120);
  if (input.program !== undefined) {
    if (program === undefined) return { ok: false, error: "Program is too long." };
    patch.program = program;
  }

  const studyLevel = trimOrNull(input.studyLevel, 80);
  if (input.studyLevel !== undefined) {
    if (studyLevel === undefined) return { ok: false, error: "Study level is too long." };
    patch.study_level = studyLevel;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No profile changes to save." };
  }
  return { ok: true, patch };
}

/** Unit helper: ensure patch never includes staff-locked columns. */
export function studentSelfEditPatchIsSafe(patch: Record<string, unknown>): boolean {
  const keys = Object.keys(patch);
  if (!keys.length) return false;
  return keys.every((k) => (STUDENT_SELF_EDIT_FIELDS as readonly string[]).includes(k));
}
