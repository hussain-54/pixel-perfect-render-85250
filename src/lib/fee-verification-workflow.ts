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
 * Mirrors list_counselling_fee_verification_requests visibility after
 * migration 20261020170000: any Front Desk desk sees the coordination queue.
 * Fee VERIFY remains Accounts-only (separate permission).
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
  return Boolean(input.isFrontDesk && input.viewerUserId);
}

export type FeeVerificationQueueTab = "open" | "awaiting_finance" | "needs_correction" | "completed";

export function feeVerificationTabForStatus(status: string): FeeVerificationQueueTab {
  const s = status.trim().toLowerCase();
  if (s === "in_progress") return "awaiting_finance";
  if (s === "cancelled") return "needs_correction";
  if (s === "resolved") return "completed";
  return "open";
}

export function feeVerificationStatusesForTab(tab: FeeVerificationQueueTab): string[] {
  switch (tab) {
    case "awaiting_finance":
      return ["in_progress"];
    case "needs_correction":
      return ["cancelled"];
    case "completed":
      return ["resolved"];
    case "open":
    default:
      return ["open"];
  }
}

/** Fee obligation reached an authorized Accounts decision (not merely claimed). */
export function signupFeeIsTerminalDecision(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "verified" || s === "waived" || s === "rejected";
}

/**
 * Request still open/forwarded while signup fee already has a terminal decision.
 * Safe to reconcile request from fee truth (never invent a verification).
 */
export function requestStuckAfterFeeDecision(input: {
  requestStatus: string;
  signupFeeStatus: string | null | undefined;
}): boolean {
  const req = input.requestStatus.trim().toLowerCase();
  return (
    (req === "open" || req === "in_progress") &&
    signupFeeIsTerminalDecision(input.signupFeeStatus)
  );
}

/**
 * Request marked completed but fee gate is not satisfied — must not unlock admission.
 */
export function requestCompletedWithoutFeeAuthorization(input: {
  requestStatus: string;
  signupFeeStatus: string | null | undefined;
}): boolean {
  return (
    input.requestStatus.trim().toLowerCase() === "resolved" &&
    !feeStatusAllowsAdmissionHandover(input.signupFeeStatus)
  );
}

export function describeFeeClaimDisplay(input: {
  signupFeeStatus: string | null | undefined;
  feeAmount: number | null | undefined;
  feeCurrency: string | null | undefined;
  feePaymentMethod: string | null | undefined;
  feeReferenceReceipt: string | null | undefined;
}): {
  feeStatusLabel: string;
  claimLabel: string;
  hasFeeRecord: boolean;
  claimFieldsMissing: boolean;
} {
  const hasFeeRecord = Boolean(input.signupFeeStatus?.trim());
  const feeStatusLabel = hasFeeRecord
    ? input.signupFeeStatus!.replaceAll("_", " ")
    : "No fee record";
  const claimBits = [
    input.feeAmount != null
      ? `${input.feeCurrency || ""} ${input.feeAmount}`.trim()
      : null,
    input.feePaymentMethod,
    input.feeReferenceReceipt ? `Ref: ${input.feeReferenceReceipt}` : null,
  ].filter(Boolean) as string[];
  if (!hasFeeRecord) {
    return {
      feeStatusLabel,
      claimLabel: "No signup fee record on file",
      hasFeeRecord: false,
      claimFieldsMissing: true,
    };
  }
  if (!claimBits.length) {
    return {
      feeStatusLabel,
      claimLabel: "Fee on file — amount/method/reference not recorded",
      hasFeeRecord: true,
      claimFieldsMissing: true,
    };
  }
  return {
    feeStatusLabel,
    claimLabel: claimBits.join(" · "),
    hasFeeRecord: true,
    claimFieldsMissing: false,
  };
}

export function normalizeRpcRowList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") return [data as Record<string, unknown>];
  return [];
}

/** Draft save: eligibility may be empty and will be stored as Pending Review. */
export function normalizeAssessmentEligibilityForDraft(
  eligibility: string | null | undefined,
): string {
  const t = eligibility?.trim() ?? "";
  return t || "Pending Review";
}
