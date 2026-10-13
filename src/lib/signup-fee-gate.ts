/**
 * Signup-fee / portal-activation workflow rules (pure).
 * Module permissions never bypass these gates.
 */
import type { SignupFeeStatusDb } from "@/types/database";

export function isSignupFeeVerified(status: SignupFeeStatusDb | null | undefined): boolean {
  return status === "verified" || status === "waived";
}

/** Claimed/unpaid/rejected are not activation. */
export function canActivatePortalFromFeeStatus(
  status: SignupFeeStatusDb | null | undefined,
): boolean {
  return isSignupFeeVerified(status);
}

export function isPortalActivated(portalActivatedAt: string | null | undefined): boolean {
  return Boolean(portalActivatedAt?.trim());
}

/**
 * Student portal CRM access requires activation after verified/waived signup fee.
 * Demo sessions bypass (mock plane).
 */
export function studentPortalAccessAllowed(input: {
  source: "supabase" | "demo";
  portalActivatedAt: string | null | undefined;
}): boolean {
  if (input.source === "demo") return true;
  return isPortalActivated(input.portalActivatedAt);
}

/**
 * Fee status may already be persisted when activation fails — never report a clean success.
 * Callers must surface this error to the operator for retry/remediation.
 */
export function formatFeeActivationPartialFailure(input: {
  feeStatus: SignupFeeStatusDb;
  activationError: string;
}): string {
  const detail = input.activationError.trim() || "unknown error";
  return `Signup fee was updated to ${input.feeStatus}, but portal activation failed: ${detail}. Resolve student access and re-run activation; do not treat the fee change as a completed activation.`;
}
