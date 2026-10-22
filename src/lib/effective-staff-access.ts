/**

 * Staff effective-access helpers for nav/path decisions from a permission matrix.

 * Server `requireModulePermission` remains authoritative for data mutations.

 *

 * Effective-permission precedence (single model — no parallel tables):

 * 1. Account must be active (portal-auth / session); deactivated → no session.

 * 2. Trusted `profiles.business_role` (never client-supplied labels).

 * 3. Org-wide Admin-persisted `business_module_permissions` merged onto

 *    compile-time `BUSINESS_PERMISSION_MATRIX` defaults (DB cells win per cell).

 * 4. Technical admin/super_admin bypass module checks on the server.

 * 5. Product hard-denies (e.g. Front Desk → Reports / Marketing) can only

 *    restrict further; they never grant above the matrix.

 * 6. Workflow gates (fee verify/waive, admission handover) stay separate from

 *    module View/Edit — matrix View does not unlock verify.

 */

import { cloneDefaultPermissionMatrix, type PermissionMatrix } from "@/lib/business-permissions";

import { specialtyNavForBusinessRole, type SpecialtyNavDef } from "@/lib/specialty-desk-access";

import type { BusinessRole } from "@/lib/business-permissions";

import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";

/**

 * Specialty paths Front Desk must not open even when the matrix grants View.

 * - reports: CRM-style analytics; server handlers deny Front Desk.

 * - marketing: product deny in marketing-rules (even if matrix View=1).

 * Fees / Banking / HR / Ops follow the Admin-persisted matrix.

 */

export const FRONT_DESK_SPECIALTY_HARD_DENY_PATHS = ["/staff/reports", "/staff/marketing"] as const;

export function isFrontDeskSpecialtyHardDenyPath(path: string): boolean {
  return FRONT_DESK_SPECIALTY_HARD_DENY_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function resolveNavMatrix(matrix: PermissionMatrix | null | undefined): PermissionMatrix {
  return matrix ?? cloneDefaultPermissionMatrix();
}

/**

 * Specialty nav for a business role from the effective matrix.

 * Front Desk never receives Reports/Marketing even if Admin grants View.

 */

export function specialtyNavFromEffectiveMatrix(
  businessRole: BusinessRole | null | undefined,

  matrix: PermissionMatrix | null | undefined,
): SpecialtyNavDef[] {
  const items = specialtyNavForBusinessRole(businessRole, resolveNavMatrix(matrix));

  if (!isFrontDeskBusinessRole(businessRole)) return items;

  return items.filter((item) => !isFrontDeskSpecialtyHardDenyPath(item.to));
}
