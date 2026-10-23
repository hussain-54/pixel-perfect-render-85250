import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPipeline } from "@/components/portal/ApplicationsPipeline";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";

export const Route = createFileRoute("/staff/applications")({
  component: StaffApplications,
});

function StaffApplications() {
  // Shared staff realtime: handovers, applications, notifications → invalidate queue keys.
  useCounsellorWorkbenchRealtime(true);
  return <ApplicationsPipeline />;
}
