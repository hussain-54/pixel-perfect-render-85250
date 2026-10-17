/**
 * Single load path for the business-role × module permission matrix.
 * Authorization prefers the database table when the live plane is available.
 */
import type { TrustedSession } from "@/server/portal-auth";
import {
  cloneDefaultPermissionMatrix,
  mergePermissionMatrixCells,
  type BusinessModule,
  type BusinessRole,
  type PermissionLevel,
  type PermissionMatrix,
  type PermissionMatrixCell,
} from "@/lib/business-permissions";
import {
  resolveAuthorizationMatrixOutcome,
  resolveMatrixLoadPlane,
  type MatrixLoadOutcome,
} from "@/lib/permission-matrix-load-rules";
import {
  readAuthorizationMatrixCache,
  writeAuthorizationMatrixCache,
  type AuthorizationMatrixCacheEntry,
} from "@/lib/authorization-matrix-cache-rules";

export type AuthorizationMatrixSource = MatrixLoadOutcome;

export type AuthorizationMatrixResult = {
  matrix: PermissionMatrix;
  source: AuthorizationMatrixSource;
};

/** Org-wide matrix cache (not user records). Invalidated on Admin matrix writes. */
let authorizationMatrixCache: AuthorizationMatrixCacheEntry<AuthorizationMatrixResult> | null =
  null;

export function invalidateAuthorizationMatrixCache(): void {
  authorizationMatrixCache = null;
}

function isProductionRuntime(): boolean {
  try {
    return Boolean(import.meta.env?.PROD);
  } catch {
    return process.env["NODE_ENV"] === "production";
  }
}

/**
 * Load matrix for authorization.
 * - Demo sessions: defaults (no DB).
 * - Live + production: database authoritative; missing/empty/errors → unavailable (fail closed).
 * - Live + non-production: missing/empty relation → defaults for local/dev; unexpected errors → unavailable.
 */
export async function loadAuthorizationMatrix(
  session: TrustedSession,
): Promise<AuthorizationMatrixResult> {
  const plane = resolveMatrixLoadPlane({
    sessionSource: session.source,
    isProduction: isProductionRuntime(),
  });

  if (plane === "demo") {
    return { matrix: cloneDefaultPermissionMatrix(), source: "defaults" };
  }

  const now = Date.now();
  const cached = readAuthorizationMatrixCache(authorizationMatrixCache, now);
  if (cached && (cached.source === "database" || cached.source === "defaults")) {
    return cached;
  }

  try {
    const { requireAoSupabaseClient } = await import("@/server/ao-data");
    const client = requireAoSupabaseClient();
    const { data, error } = await client
      .from("business_module_permissions")
      .select("business_role, module, permission_level");

    const outcome = resolveAuthorizationMatrixOutcome({
      plane,
      errorMessage: error?.message ?? null,
      rowCount: data?.length ?? 0,
    });

    if (outcome === "unavailable") {
      // Do not cache unavailable — allows recovery after RLS/migration apply.
      if (error?.message) {
        console.warn(
          "[permission-matrix] authorization load unavailable:",
          error.message.slice(0, 200),
        );
      } else {
        console.warn(
          "[permission-matrix] authorization load unavailable: empty result (check RLS SELECT for authenticated).",
        );
      }
      return { matrix: cloneDefaultPermissionMatrix(), source: "unavailable" };
    }
    if (outcome === "defaults") {
      const result = { matrix: cloneDefaultPermissionMatrix(), source: "defaults" as const };
      authorizationMatrixCache = writeAuthorizationMatrixCache(result, now);
      return result;
    }

    const cells: PermissionMatrixCell[] = (data ?? []).map((row) => ({
      businessRole: row.business_role as BusinessRole,
      module: row.module as BusinessModule,
      level: row.permission_level as PermissionLevel,
    }));

    const result: AuthorizationMatrixResult = {
      matrix: mergePermissionMatrixCells(cells),
      source: "database",
    };
    authorizationMatrixCache = writeAuthorizationMatrixCache(result, now);
    return result;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "unknown";
    console.warn("[permission-matrix] authorization load error:", message.slice(0, 200));
    const outcome = resolveAuthorizationMatrixOutcome({
      plane,
      errorMessage: message,
      rowCount: null,
    });
    return {
      matrix: cloneDefaultPermissionMatrix(),
      source: outcome === "defaults" ? "defaults" : "unavailable",
    };
  }
}

/** Display/admin UI load — same merge rules; never returns unavailable (falls to defaults). */
export async function loadPermissionMatrixForDisplay(): Promise<{
  matrix: PermissionMatrix;
  source: "database" | "defaults";
}> {
  const { requireAoSupabaseClient } = await import("@/server/ao-data");
  const client = requireAoSupabaseClient();
  const { data, error } = await client
    .from("business_module_permissions")
    .select("business_role, module, permission_level");

  if (error) {
    if (/does not exist|relation|permission|policy/i.test(error.message)) {
      return { matrix: cloneDefaultPermissionMatrix(), source: "defaults" };
    }
    throw new Error(error.message);
  }

  if (!data?.length) {
    return { matrix: cloneDefaultPermissionMatrix(), source: "defaults" };
  }

  const cells: PermissionMatrixCell[] = data.map((row) => ({
    businessRole: row.business_role as BusinessRole,
    module: row.module as BusinessModule,
    level: row.permission_level as PermissionLevel,
  }));

  return {
    matrix: mergePermissionMatrixCells(cells),
    source: "database",
  };
}
