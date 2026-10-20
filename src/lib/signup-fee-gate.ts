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

export type MappedSignupFeeRpcError = {
  status: number;
  message: string;
};

/**
 * Maps verify_signup_fee_and_activate Postgres errors to safe client messages.
 * Pure — does not call the database. Never forwards raw SQL/connection details.
 */
export function mapVerifySignupFeeRpcError(rawMessage: string): MappedSignupFeeRpcError {
  const message = rawMessage.trim();
  if (/does not exist|Could not find the function|PGRST202/i.test(message)) {
    return {
      status: 503,
      message:
        "Fee verification RPC unavailable. Apply migration 20261013020000_signup_fee_verify_activate_rpc.sql.",
    };
  }
  if (/authentication required/i.test(message)) {
    return { status: 401, message: "Sign in required to verify signup fees." };
  }
  if (/not authorized to verify signup fees/i.test(message)) {
    return {
      status: 403,
      message: "Only Accounts/Finance or Admin may verify signup fees.",
    };
  }
  if (/signup fee row not found/i.test(message)) {
    return { status: 404, message: "Signup fee record not found." };
  }
  if (/invalid action/i.test(message)) {
    return { status: 400, message: "Invalid verification action." };
  }
  if (/student row missing/i.test(message)) {
    return { status: 404, message: "Student record not found for activation." };
  }
  if (/fee is not in a terminal/i.test(message)) {
    return {
      status: 400,
      message:
        "Cannot close the verification request until Accounts verifies, waives, or rejects the signup fee.",
    };
  }
  if (/not authorized to reconcile/i.test(message)) {
    return {
      status: 403,
      message: "Not authorized to reconcile fee-verification requests.",
    };
  }
  return {
    status: 400,
    message: "Could not verify the signup fee. Try again or contact an administrator.",
  };
}
