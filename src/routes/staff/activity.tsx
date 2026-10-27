import { createFileRoute } from "@tanstack/react-router";
import { ActivityAuditLog } from "@/components/portal/ActivityAuditLog";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/activity")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "students"),
  component: StaffActivity,
});

function StaffActivity() {
  return <ActivityAuditLog />;
}
