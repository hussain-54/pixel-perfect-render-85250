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
