import { createFileRoute } from "@tanstack/react-router";
import { ReportsAnalytics } from "@/components/portal/ReportsAnalytics";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/reports")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "reports"),
  component: StaffReports,
});

function StaffReports() {
  return <ReportsAnalytics />;
}
