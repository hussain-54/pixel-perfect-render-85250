import { createFileRoute } from "@tanstack/react-router";
import { FinanceModulePage } from "@/routes/admin/finance";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/finance")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "fees_payments"),
  component: FinanceModulePage,
});
