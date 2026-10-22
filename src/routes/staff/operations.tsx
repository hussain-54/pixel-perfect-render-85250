import { createFileRoute } from "@tanstack/react-router";
import { OperationsModulePage } from "@/routes/admin/operations";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/operations")({
  beforeLoad: ({ context }) =>
    enforceSpecialtyStaffModuleBeforeLoad(context, "orders_sales_purchase"),
  component: OperationsModulePage,
});
