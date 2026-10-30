/**
 * Front Desk fee-coordination access rules (mirrors …30120000 RPCs).
 * Org fee queue may surface another registrar's student; Fix must still open
 * and allow voucher/proof — without granting fee VERIFY or PII edit.
 */

import { feeVerificationRowMatchesTab } from "@/lib/fee-verification-workflow";

export function frontDeskCanCoordinateStudent(input: {
  isAdmin: boolean;
  isFrontDesk: boolean;
  isIntakeRegistrar: boolean;
  hasFeeVerificationRequest: boolean;
}): boolean {
  if (input.isAdmin) return true;
  if (!input.isFrontDesk) return false;
  return input.isIntakeRegistrar || input.hasFeeVerificationRequest;
}

export function frontDeskRecordCapabilities(input: {
  isAdmin: boolean;
  isFrontDesk: boolean;
  isIntakeRegistrar: boolean;
  hasFeeVerificationRequest: boolean;
  assignmentStatus: "pending" | "assigned";
}): {
  canOpenRecord: boolean;
  canEditRegistration: boolean;
  canAssignCounsellor: boolean;
  canRecordSignupFee: boolean;
  canVerifySignupFee: false;
} {
  const canOpen = frontDeskCanCoordinateStudent(input);
  const registrar = input.isAdmin || input.isIntakeRegistrar;
  return {
    canOpenRecord: canOpen,
    canEditRegistration: registrar,
    canAssignCounsellor: registrar && input.assignmentStatus === "pending",
    canRecordSignupFee: canOpen,
    canVerifySignupFee: false,
  };
}

/** Count helpers must split cancelled rows the same way as fee tabs. */
export function countFeeVerificationNeedsCorrection(
  rows: { status: string; signupFeeStatus?: string | null }[],
): number {
  return rows.filter((r) => feeVerificationRowMatchesTab(r, "needs_correction")).length;
}

export function countFeeVerificationCancelledHistory(
  rows: { status: string; signupFeeStatus?: string | null }[],
): number {
  return rows.filter((r) => feeVerificationRowMatchesTab(r, "cancelled")).length;
}
