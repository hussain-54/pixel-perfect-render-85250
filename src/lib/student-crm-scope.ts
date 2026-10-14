/**
 * Resolve which student ids a CRM list (applications / documents) may include.
 * Server still enforces visibility via resolveOwnStudentDb / assertStudentVisibleDb / RLS.
 */
import type { AppRole } from "@/lib/roles";

export function resolveCrmListStudentIds(input: {
  role: AppRole;
  ownStudentId: string | null;
  requestedStudentId: string | null | undefined;
  visibleStudentIds: string[];
}): { ok: true; studentIds: string[] } | { ok: false; status: 400 | 403; error: string } {
  const requested = input.requestedStudentId?.trim() || null;

  if (input.role === "student") {
    if (!input.ownStudentId) {
      return {
        ok: false,
        status: 403,
        error: "No student profile is linked to this account.",
      };
    }
    if (requested && requested !== input.ownStudentId) {
      return {
        ok: false,
        status: 403,
        error: "Students may only view their own records.",
      };
    }
    return { ok: true, studentIds: [input.ownStudentId] };
  }

  if (requested) {
    if (!input.visibleStudentIds.includes(requested)) {
      return {
        ok: false,
        status: 403,
        error: "You do not have access to this student record.",
      };
    }
    return { ok: true, studentIds: [requested] };
  }

  return { ok: true, studentIds: input.visibleStudentIds };
}
