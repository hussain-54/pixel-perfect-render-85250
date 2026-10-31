import { createFileRoute } from "@tanstack/react-router";
import { TaskOperationsCenter } from "@/components/portal/TaskOperationsCenter";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";
import { TASK_FILTER_TABS, type TaskFilterTab } from "@/types/tasks-ops";

export type TasksSearch = {
  tab?: TaskFilterTab;
  q?: string;
  studentId?: string;
};

const TAB_KEYS = new Set<string>(TASK_FILTER_TABS.map((t) => t.key));

export const Route = createFileRoute("/staff/tasks")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "counselling"),
  validateSearch: (raw: Record<string, unknown>): TasksSearch => {
    const out: TasksSearch = {};
    const tab = raw["tab"];
    if (typeof tab === "string" && TAB_KEYS.has(tab)) {
      out.tab = tab as TaskFilterTab;
    }
    const q = raw["q"];
    if (typeof q === "string" && q.trim()) out.q = q.trim();
    const studentId = raw["studentId"];
    if (typeof studentId === "string" && studentId.trim()) {
      out.studentId = studentId.trim();
    }
    return out;
  },
  component: StaffTasks,
});

function StaffTasks() {
  const search = Route.useSearch();
  useCounsellorWorkbenchRealtime(true);
  return (
    <TaskOperationsCenter
      {...(search.tab ? { initialTab: search.tab } : {})}
      {...(search.q ? { initialQ: search.q } : {})}
      {...(search.studentId ? { initialStudentId: search.studentId } : {})}
    />
  );
}
