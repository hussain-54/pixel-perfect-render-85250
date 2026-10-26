/**
 * Contract rules for Admission Team student SELECT/mutate after handover.
 * Mirrors migration 20261026120000 — unit/contract only, not live JWT proof.
 */

/** students_select_access uses can_access_student (includes submitted|accepted handover). */
export const ADMISSION_STUDENTS_SELECT_USES_CAN_ACCESS = true;

/** Mutate requires accepted handover ownership (to_owner_id), not submitted alone. */
export const ADMISSION_MUTATE_REQUIRES_ACCEPTED_OWNERSHIP = true;

export function admissionCanSelectStudentViaHandover(input: {
  businessRole: string | null | undefined;
  handoverStatus: string | null | undefined;
}): boolean {
  const role = (input.businessRole ?? "").toLowerCase();
  if (role !== "admission_team" && role !== "manager") return false;
  const status = (input.handoverStatus ?? "").toLowerCase();
  return status === "submitted" || status === "accepted";
}

export function admissionCanMutateStudentViaHandover(input: {
  businessRole: string | null | undefined;
  handoverStatus: string | null | undefined;
  toOwnerId: string | null | undefined;
  actorUserId: string | null | undefined;
}): boolean {
  const role = (input.businessRole ?? "").toLowerCase();
  if (role !== "admission_team" && role !== "manager") return false;
  if ((input.handoverStatus ?? "").toLowerCase() !== "accepted") return false;
  const owner = input.toOwnerId?.trim();
  const actor = input.actorUserId?.trim();
  if (!owner || !actor) return false;
  return owner === actor;
}
