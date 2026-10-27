import { createFileRoute } from "@tanstack/react-router";
import { ApplicationsPipeline } from "@/components/portal/ApplicationsPipeline";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";

export type ApplicationsSearch = {
  /**
   * Workbench KPI deep-link:
   * handovers = counsellor incoming queue; returned = clarification empty-state;
   * docs | in_progress | submitted | offers | action = application stage filters.
   */
  focus?: "docs" | "in_progress" | "submitted" | "offers" | "action" | "handovers" | "returned";
  /** Open pipeline detail dialog for this application. */
  applicationId?: string;
  /** Deep-link a student (UUID) into the handover panel + app filter — not free-text search. */
  studentId?: string;
};

export const Route = createFileRoute("/staff/applications")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "admissions"),
  validateSearch: (raw: Record<string, unknown>): ApplicationsSearch => {
    const out: ApplicationsSearch = {};
    const focus = raw["focus"];
    if (
      focus === "docs" ||
      focus === "in_progress" ||
      focus === "submitted" ||
      focus === "offers" ||
      focus === "action" ||
      focus === "handovers" ||
      focus === "returned"
    ) {
      out.focus = focus;
    }
    const applicationId = raw["applicationId"];
    if (typeof applicationId === "string" && applicationId.trim()) {
      out.applicationId = applicationId.trim();
    }
    const studentId = raw["studentId"];
    if (typeof studentId === "string" && studentId.trim()) {
      out.studentId = studentId.trim();
    }
    return out;
  },
  component: StaffApplications,
});

function StaffApplications() {
  const search = Route.useSearch();
  // Shared staff realtime: handovers, applications, notifications → invalidate queue keys.
  useCounsellorWorkbenchRealtime(true);
  return (
    <ApplicationsPipeline
      {...(search.focus ? { initialFocus: search.focus } : {})}
      {...(search.applicationId ? { initialApplicationId: search.applicationId } : {})}
      {...(search.studentId ? { initialStudentId: search.studentId } : {})}
    />
  );
}
