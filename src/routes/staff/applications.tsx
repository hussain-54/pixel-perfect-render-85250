import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPipeline } from "@/components/portal/ApplicationsPipeline";

export const Route = createFileRoute("/staff/applications")({
  component: StaffApplications,
});

function StaffApplications() {
  return <ApplicationsPipeline />;
}
