/**
 * Admin permission-matrix read/write — persists to business_module_permissions.
 * Authorization uses trusted technical app_role only (admin / super_admin).
 * Client-supplied roles are never trusted.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  BUSINESS_MODULES,
  BUSINESS_ROLES,
  BUSINESS_PERMISSION_MATRIX,
  cloneDefaultPermissionMatrix,
  flattenPermissionMatrix,
  validatePermissionMatrixChange,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
  type PermissionMatrix,
  type PermissionMatrixCell,
} from "@/lib/business-permissions";
import { loadPermissionMatrixForDisplay } from "@/server/permission-matrix-store";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function requirePermissionMatrixManager(session: TrustedSession) {
  // Technical admin only — business_role labels / client claims cannot escalate here.
  requireRoles(session, ["admin", "super_admin"]);
}

export type PermissionMatrixSnapshot = {
  matrix: PermissionMatrix;
  cells: PermissionMatrixCell[];
  source: "database" | "defaults";
  canEdit: boolean;
  roles: readonly BusinessRole[];
  modules: readonly BusinessModule[];
};

function snapshotFromMatrix(
  matrix: PermissionMatrix,
  source: "database" | "defaults",
  canEdit: boolean,
): PermissionMatrixSnapshot {
  return {
    matrix,
    cells: flattenPermissionMatrix(matrix),
    source,
    canEdit,
    roles: BUSINESS_ROLES,
    modules: BUSINESS_MODULES,
  };
}

export const portalGetPermissionMatrix = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const session = await requireTrustedSession();
    requirePermissionMatrixManager(session);

    if (session.source === "demo") {
      return snapshotFromMatrix(cloneDefaultPermissionMatrix(), "defaults", false);
    }

    try {
      const loaded = await loadPermissionMatrixForDisplay();
      // Only allow edits when the live table responded successfully.
      return snapshotFromMatrix(loaded.matrix, loaded.source, loaded.source === "database");
    } catch {
      return snapshotFromMatrix(cloneDefaultPermissionMatrix(), "defaults", false);
    }
  } catch (error) {
    toError(error);
  }
});

export type UpdatePermissionMatrixInput = {
  businessRole: BusinessRole;
  module: BusinessModule;
  level: PermissionLevel;
};

export const portalUpdatePermissionMatrixCell = createServerFn({ method: "POST" })
  .validator((data: UpdatePermissionMatrixInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requirePermissionMatrixManager(session);

      if (session.source !== "supabase" || !session.userId) {
        throw new AuthError(
          "Permission changes require a live Supabase admin session. Demo sessions cannot persist the matrix.",
          403,
        );
      }

      const validated = validatePermissionMatrixChange(data);
      if (!validated.ok) throw new AuthError(validated.error, 400);

      const { requireAoSupabaseClient } = await import("@/server/ao-data");
      const client = requireAoSupabaseClient();

      const { data: existing, error: readErr } = await client
        .from("business_module_permissions")
        .select("permission_level")
        .eq("business_role", validated.businessRole)
        .eq("module", validated.module)
        .maybeSingle();
      if (readErr) {
        if (/does not exist|relation/i.test(readErr.message)) {
          throw new AuthError(
            "Permission matrix table is not available. Apply migration 20261014010000_business_module_permissions.sql.",
            503,
          );
        }
        throw new Error(readErr.message);
      }

      const previousLevel =
        existing?.permission_level ??
        BUSINESS_PERMISSION_MATRIX[validated.businessRole][
          BUSINESS_MODULES.indexOf(validated.module)
        ] ??
        0;

      if (previousLevel === validated.level) {
        const loaded = await loadPermissionMatrixForDisplay();
        return {
          ok: true as const,
          message: "No change — permission already set to that level.",
          cell: {
            businessRole: validated.businessRole,
            module: validated.module,
            level: validated.level,
          },
          matrix: loaded.matrix,
        };
      }

      const { error: upsertErr } = await client.from("business_module_permissions").upsert(
        {
          business_role: validated.businessRole,
          module: validated.module,
          permission_level: validated.level,
          updated_by: session.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_role,module" },
      );

      if (upsertErr) {
        if (/does not exist|relation/i.test(upsertErr.message)) {
          throw new AuthError(
            "Permission matrix table is not available. Apply migration 20261014010000_business_module_permissions.sql.",
            503,
          );
        }
        if (/permission|policy|row-level/i.test(upsertErr.message)) {
          throw new AuthError("You do not have permission to change role permissions.", 403);
        }
        throw new Error(upsertErr.message);
      }

      try {
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "permissions.matrix_cell_updated",
          entity_type: "business_module_permissions",
          entity_id: null,
          metadata: {
            businessRole: validated.businessRole,
            module: validated.module,
            previousLevel,
            level: validated.level,
            by: session.userId,
          },
        });
      } catch {
        /* audit failure must not hide successful persist */
      }

      const loaded = await loadPermissionMatrixForDisplay();
      return {
        ok: true as const,
        message: "Permission saved.",
        cell: {
          businessRole: validated.businessRole,
          module: validated.module,
          level: validated.level,
        },
        matrix: loaded.matrix,
      };
    } catch (error) {
      toError(error);
    }
  });
