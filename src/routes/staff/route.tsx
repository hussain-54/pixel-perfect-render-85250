import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PortalShell } from "@/components/portal/PortalShell";
import { requirePortalAccess } from "@/lib/portal-guard";
import { pageHead } from "@/lib/seo";
import {
  isFrontDeskBusinessRole,
  isFrontDeskDeniedPath,
  staffHomeForBusinessRole,
} from "@/lib/staff-business-access";
import { specialtyOnlyPathAllowed } from "@/lib/specialty-desk-access";
import { buildStaffNav } from "@/lib/staff-nav";
import type { PermissionMatrix } from "@/lib/business-permissions";
import { cloneDefaultPermissionMatrix } from "@/lib/business-permissions";
import { workspaceDocumentTitle } from "@/lib/workspace-branding";
import type { PublicSession } from "@/server/portal-data";
import { getEffectiveStaffAccess } from "@/services";

export type StaffRouteContext = {
  auth: PublicSession;
  permissionMatrix: PermissionMatrix;
  matrixSource: "database" | "defaults";
};

export const Route = createFileRoute("/staff")({
  beforeLoad: async (ctx) => {
    const result = await requirePortalAccess("staff")();
    const auth = result.auth as PublicSession;
    const businessRole = auth.businessRole;
    const pathname =
      typeof window !== "undefined" ? window.location.pathname : (ctx.location?.pathname ?? "");

    let permissionMatrix = cloneDefaultPermissionMatrix();
    let matrixSource: StaffRouteContext["matrixSource"] = "defaults";
    try {
      const access = await getEffectiveStaffAccess();
      if (access?.matrix) {
        permissionMatrix = access.matrix;
        // portalGetEffectiveStaffAccess already maps unavailable → defaults.
        matrixSource = access.source === "database" ? "database" : "defaults";
      }
    } catch {
      permissionMatrix = cloneDefaultPermissionMatrix();
      matrixSource = "defaults";
    }

    if (
      isFrontDeskBusinessRole(businessRole) &&
      isFrontDeskDeniedPath(pathname, permissionMatrix, businessRole)
    ) {
      throw redirect({ to: "/staff/front-desk" });
    }

    if (!specialtyOnlyPathAllowed(businessRole, pathname, permissionMatrix)) {
      throw redirect({
        href: staffHomeForBusinessRole(auth.role ?? "consultant", businessRole),
      });
    }

    return {
      ...result,
      auth,
      permissionMatrix,
      matrixSource,
    } satisfies StaffRouteContext & typeof result;
  },
  head: ({ match }) => {
    const auth = (match.context as { auth?: PublicSession }).auth;
    return pageHead({
      path: "/staff",
      title: workspaceDocumentTitle({
        portal: "staff",
        businessRole: auth?.businessRole,
        appRole: auth?.role,
      }),
      description: "Authenticated staff workspace.",
      indexable: false,
    });
  },
  component: StaffPortalLayout,
});

function StaffPortalLayout() {
  const ctx = Route.useRouteContext() as StaffRouteContext;
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  /**
   * Live effective-access query — same key Admin invalidates after matrix saves.
   * Refetch on focus + short interval so grant/revoke propagates without logout.
   * Authorization still re-checked on every server mutation via requireModulePermission.
   */
  const accessQ = useQuery({
    queryKey: ["staff", "effective-access"],
    queryFn: getEffectiveStaffAccess,
    initialData: {
      businessRole: ctx.auth?.businessRole ?? null,
      matrix: ctx.permissionMatrix,
      source: ctx.matrixSource,
      specialtyPaths: [] as string[],
    },
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const businessRole = accessQ.data?.businessRole ?? ctx.auth?.businessRole ?? null;
  const matrix = accessQ.data?.matrix ?? ctx.permissionMatrix;
  const nav = buildStaffNav(businessRole, matrix);

  useEffect(() => {
    if (!accessQ.isFetched && !accessQ.isSuccess) return;
    if (
      isFrontDeskBusinessRole(businessRole) &&
      isFrontDeskDeniedPath(pathname, matrix, businessRole)
    ) {
      void navigate({ to: "/staff/front-desk" });
      return;
    }
    if (!specialtyOnlyPathAllowed(businessRole, pathname, matrix)) {
      void navigate({
        href: staffHomeForBusinessRole(ctx.auth?.role ?? "consultant", businessRole),
      });
    }
  }, [
    accessQ.dataUpdatedAt,
    accessQ.isFetched,
    accessQ.isSuccess,
    businessRole,
    matrix,
    pathname,
    navigate,
    ctx.auth?.role,
  ]);

  return <PortalShell role="staff" nav={nav} session={ctx.auth} />;
}
