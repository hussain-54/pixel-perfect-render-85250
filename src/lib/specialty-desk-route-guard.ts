/**
 * Client route beforeLoad helper for specialty staff module pages.
 * Server functions remain authoritative — this only blocks obviously denied UI routes.
 *
 * Precedence for module View on specialty paths:
 * 1. Technical admin / super_admin → allow
 * 2. Non-consultant appRole → sign-in
 * 3. Effective (persisted) permission matrix when provided
 * 4. Compile-time BUSINESS_PERMISSION_MATRIX defaults as last resort
 *
 * Front Desk hard denials for /staff/reports and /staff/marketing are enforced
 * in the staff layout (`isFrontDeskDeniedPath`), not here.
 */
import { redirect } from "@tanstack/react-router";
import type { BusinessModule, BusinessRole, PermissionMatrix } from "@/lib/business-permissions";
import { canViewModule, canViewModuleInMatrix } from "@/lib/business-permissions";
import { staffLandingPathForBusinessRole } from "@/lib/specialty-desk-access";
import type { AppRole } from "@/lib/roles";

export function assertSpecialtyStaffModuleAccess(opts: {
  appRole?: AppRole | null;
  businessRole?: BusinessRole | null;
  module: BusinessModule;
  /** Persisted/effective matrix from staff layout context when available. */
  matrix?: PermissionMatrix | null;
}): void {
  const role = opts.appRole ?? null;
  const businessRole = opts.businessRole ?? null;
  if (role === "admin" || role === "super_admin") return;
  if (role !== "consultant") {
    throw redirect({ to: "/sign-in" });
  }
  const allowed = opts.matrix
    ? canViewModuleInMatrix(opts.matrix, businessRole, opts.module)
    : canViewModule(businessRole, opts.module);
  if (!allowed) {
    const home = staffLandingPathForBusinessRole("consultant", businessRole);
    throw redirect({ href: home });
  }
}
