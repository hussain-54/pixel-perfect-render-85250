/**
 * Shared beforeLoad for /staff specialty module routes.
 * Re-fetches effective matrix so Admin grant/revoke is not stuck on stale layout context.
 */
import type { BusinessModule } from "@/lib/business-permissions";
import { assertSpecialtyStaffModuleAccess } from "@/lib/specialty-desk-route-guard";
import { preferFreshPermissionMatrix, readStaffAuthContext } from "@/lib/staff-route-context";
import { getEffectiveStaffAccess } from "@/services";

export async function enforceSpecialtyStaffModuleBeforeLoad(
  context: unknown,
  module: BusinessModule,
): Promise<void> {
  const { appRole, businessRole, matrix: contextMatrix } = readStaffAuthContext(context);
  let freshMatrix = contextMatrix;
  try {
    const access = await getEffectiveStaffAccess();
    freshMatrix = preferFreshPermissionMatrix(access?.matrix, contextMatrix);
  } catch {
    /* keep layout context / defaults path inside assertSpecialtyStaffModuleAccess */
  }
  assertSpecialtyStaffModuleAccess({
    appRole,
    businessRole,
    module,
    matrix: freshMatrix,
  });
}
