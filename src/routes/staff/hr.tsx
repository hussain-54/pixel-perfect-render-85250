import { createFileRoute } from "@tanstack/react-router";
import { HrModulePage } from "@/routes/admin/hr";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/hr")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "hr_attendance"),
  component: HrModulePage,
});
