/**
 * Client route beforeLoad helper for specialty staff module pages.
 * Server functions remain authoritative — this only blocks obviously denied UI routes.
 */
import { redirect } from "@tanstack/react-router";
import type { BusinessModule, BusinessRole } from "@/lib/business-permissions";
import { canViewModule } from "@/lib/business-permissions";
import { staffLandingPathForBusinessRole } from "@/lib/specialty-desk-access";
import type { AppRole } from "@/lib/roles";

export function assertSpecialtyStaffModuleAccess(opts: {
  appRole?: AppRole | null;
  businessRole?: BusinessRole | null;
  module: BusinessModule;
}): void {
  const role = opts.appRole ?? null;
  const businessRole = opts.businessRole ?? null;
  if (role === "admin" || role === "super_admin") return;
  if (role !== "consultant") {
    throw redirect({ to: "/sign-in" });
  }
  if (!canViewModule(businessRole, opts.module)) {
    const home = staffLandingPathForBusinessRole("consultant", businessRole);
    throw redirect({ href: home });
  }
}
