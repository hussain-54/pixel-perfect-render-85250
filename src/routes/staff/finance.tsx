import { createFileRoute } from "@tanstack/react-router";
import { FinanceModulePage } from "@/routes/admin/finance";
import { assertSpecialtyStaffModuleAccess } from "@/lib/specialty-desk-route-guard";
import type { BusinessRole } from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";

export const Route = createFileRoute("/staff/finance")({
  beforeLoad: ({ context }) => {
    const auth = (
      context as { auth?: { role?: AppRole; businessRole?: BusinessRole | null } }
    ).auth;
    assertSpecialtyStaffModuleAccess({
      appRole: auth?.role ?? null,
      businessRole: auth?.businessRole ?? null,
      module: "fees_payments",
    });
  },
  component: FinanceModulePage,
});
