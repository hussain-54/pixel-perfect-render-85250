import { createFileRoute } from "@tanstack/react-router";
import { ReportsAnalytics } from "@/components/portal/ReportsAnalytics";

export const Route = createFileRoute("/staff/reports")({
  component: StaffReports,
});

function StaffReports() {
  return <ReportsAnalytics />;
}