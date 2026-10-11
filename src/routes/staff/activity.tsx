import { createFileRoute } from "@tanstack/react-router";
import { ActivityAuditLog } from "@/components/portal/ActivityAuditLog";

export const Route = createFileRoute("/staff/activity")({
  component: StaffActivity,
});

function StaffActivity() {
  return <ActivityAuditLog />;
}