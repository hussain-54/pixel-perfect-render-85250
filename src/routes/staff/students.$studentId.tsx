import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  LoadingRows,
  ErrorState,
  EmptyState,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { StudentProfileWorkspaceView } from "@/components/portal/StudentProfileWorkspace";
import { useData } from "@/lib/useData";
import { getStudentProfile } from "@/services";
import {
  STUDENT_PROFILE_TABS,
  type ProfileTabId,
} from "@/types/student-profile";

const TAB_IDS = new Set(STUDENT_PROFILE_TABS.map((t) => t.id));

type ProfileSearch = {
  tab: ProfileTabId;
};

export const Route = createFileRoute("/staff/students/$studentId")({
  validateSearch: (search: Record<string, unknown>): ProfileSearch => {
    const raw = typeof search["tab"] === "string" ? search["tab"] : "assessment";
    const tab = (TAB_IDS.has(raw as ProfileTabId) ? raw : "assessment") as ProfileTabId;
    return { tab };
  },
  component: StaffStudentProfile,
});

function StaffStudentProfile() {
  const { studentId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/staff/students/$studentId" });
  const profileQ = useData(["officer", "student-profile", studentId], () =>
    getStudentProfile(studentId),
  );

  if (profileQ.isLoading) return <LoadingRows rows={8} />;

  if (profileQ.isError) {
    const msg = portalErrorMessage(profileQ.error);
    if (String(profileQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  const workspace = profileQ.data;
  if (!workspace) return <EmptyState title="Student not found" />;

  return (
    <StudentProfileWorkspaceView
      workspace={workspace}
      tab={tab}
      onTabChange={(next) => {
        void navigate({
          search: (prev) => ({ ...prev, tab: next }),
          replace: true,
        });
      }}
    />
  );
}
