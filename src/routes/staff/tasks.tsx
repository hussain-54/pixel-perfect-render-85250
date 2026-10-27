import { createFileRoute } from "@tanstack/react-router";
import { TaskOperationsCenter } from "@/components/portal/TaskOperationsCenter";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/tasks")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "counselling"),
  component: StaffTasks,
});

function StaffTasks() {
  return <TaskOperationsCenter />;
}
