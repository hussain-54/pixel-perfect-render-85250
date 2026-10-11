import { createFileRoute } from "@tanstack/react-router";
import { TaskOperationsCenter } from "@/components/portal/TaskOperationsCenter";

export const Route = createFileRoute("/staff/tasks")({
  component: StaffTasks,
});

function StaffTasks() {
  return <TaskOperationsCenter />;
}