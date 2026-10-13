/**
 * Pure rules for Front Desk registration ↔ Auth profile linking.
 * Ownership is never established from a client-supplied student id.
 */

export type LinkOutcome =
  | { ok: true; mode: "already_linked" | "linked_by_email" | "staff_set_existing_profile" }
  | { ok: false; reason: "email_mismatch" | "already_linked_other" | "no_match" | "missing_email" };

/** Staff intake: attach profile_id only when a profiles row exists for the same email. */
export function resolveProfileIdForIntake(input: {
  studentEmail: string;
  existingProfileId: string | null | undefined;
}): { profileId: string | null; outcome: LinkOutcome } {
  const email = input.studentEmail.trim().toLowerCase();
  if (!email) {
    return { profileId: null, outcome: { ok: false, reason: "missing_email" } };
  }
  if (input.existingProfileId) {
    return {
      profileId: input.existingProfileId,
      outcome: { ok: true, mode: "staff_set_existing_profile" },
    };
  }
  return { profileId: null, outcome: { ok: false, reason: "no_match" } };
}

/** Student claim: auth email must match CRM email; cannot steal another profile_id. */
export function evaluateStudentClaim(input: {
  authUserId: string;
  authEmail: string;
  crm: { id: string; email: string; profile_id: string | null } | null;
}): LinkOutcome {
  if (!input.authEmail.trim()) return { ok: false, reason: "missing_email" };
  if (!input.crm) return { ok: false, reason: "no_match" };
  if (input.crm.profile_id === input.authUserId) {
    return { ok: true, mode: "already_linked" };
  }
  if (input.crm.profile_id && input.crm.profile_id !== input.authUserId) {
    return { ok: false, reason: "already_linked_other" };
  }
  if (input.crm.email.trim().toLowerCase() !== input.authEmail.trim().toLowerCase()) {
    return { ok: false, reason: "email_mismatch" };
  }
  return { ok: true, mode: "linked_by_email" };
}
