/**
 * Counsellor → Front Desk fee-verification request rules.
 * Distinct from admission_handovers and from Accounts verify/waive/reject.
 */

export const FEE_VERIFICATION_REQUEST_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "cancelled",
] as const;

export type FeeVerificationRequestStatus = (typeof FEE_VERIFICATION_REQUEST_STATUSES)[number];

export const FEE_STATUSES_ALLOWING_ADMISSION_HANDOVER = ["verified", "waived"] as const;

export function feeStatusAllowsAdmissionHandover(
  status: string | null | undefined,
): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return (FEE_STATUSES_ALLOWING_ADMISSION_HANDOVER as readonly string[]).includes(s);
}

export function validateFeeVerificationRequestSummary(
  summary: string,
): { ok: true } | { ok: false; message: string } {
  const t = summary.trim();
  if (t.length < 10) {
    return {
      ok: false,
      message: "Add a short verification request summary (at least 10 characters).",
    };
  }
  return { ok: true };
}

export function canRequestFeeVerification(input: {
  hasAssessment: boolean;
  hasConsent: boolean;
  hasOpenRequest: boolean;
  isAssignedCounsellorOrAdmin: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (!input.isAssignedCounsellorOrAdmin) {
    return { ok: false, message: "You may only request verification for your assigned students." };
  }
  if (!input.hasAssessment) {
    return { ok: false, message: "Save the eligibility assessment before requesting fee verification." };
  }
  if (!input.hasConsent) {
    return { ok: false, message: "Record counselling consent before requesting fee verification." };
  }
  if (input.hasOpenRequest) {
    return { ok: false, message: "A fee verification request is already open for this student." };
  }
  return { ok: true };
}

export function admissionHandoverBlockedByFeeMessage(): string {
  return "Signup fee must be verified or waived by Accounts before handover to Admission.";
}

/**
 * Mirrors list_counselling_fee_verification_requests visibility for Front Desk
 * (after migration 20261020160000). Admin / fee-verifiers see all open rows.
 */
export function frontDeskCanSeeFeeVerificationRequest(input: {
  isAdmin: boolean;
  canVerifySignupFee: boolean;
  isFrontDesk: boolean;
  viewerUserId: string | null;
  registrarId: string | null;
  studentRegisteredBy: string | null;
}): boolean {
  if (input.isAdmin || input.canVerifySignupFee) return true;
  if (!input.isFrontDesk || !input.viewerUserId) return false;
  if (input.registrarId === input.viewerUserId) return true;
  if (input.studentRegisteredBy === input.viewerUserId) return true;
  // Unowned intake: any Front Desk may coordinate.
  if (input.registrarId == null && input.studentRegisteredBy == null) return true;
  return false;
}

/** Draft save: eligibility may be empty and will be stored as Pending Review. */
export function normalizeAssessmentEligibilityForDraft(
  eligibility: string | null | undefined,
): string {
  const t = eligibility?.trim() ?? "";
  return t || "Pending Review";
}
