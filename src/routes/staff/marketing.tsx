import { createFileRoute } from "@tanstack/react-router";
import { MarketingModulePage } from "@/routes/admin/marketing";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/marketing")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "digital_marketing"),
  component: MarketingModulePage,
});
