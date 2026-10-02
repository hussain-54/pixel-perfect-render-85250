import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Timeline, LoadingRows, EmptyState } from "@/components/common";
import { useData } from "@/lib/useData";
import { getActivity, getStudents } from "@/services";
import { DEMO_CONSULTANT_ID } from "@/components/portal/demo";

export const Route = createFileRoute("/staff/activity")({
  component: StaffActivity,
});

function StaffActivity() {
  const studentsQ = useData(["students"], getStudents);
  const myStudents = (studentsQ.data ?? []).filter((s) => s.consultantId === DEMO_CONSULTANT_ID);
  const primary = myStudents[0]?.id ?? "s1";
  const activityQ = useData(["activity", primary], () => getActivity(primary));

  return (
    <div>
      <PageHeader
        title="Activity"
        subtitle={`Demo timeline for ${myStudents[0]?.name ?? "assigned student"}.`}
      />
      {studentsQ.isLoading || activityQ.isLoading ? (
        <LoadingRows />
      ) : !activityQ.data?.length ? (
        <EmptyState title="No activity logged" />
      ) : (
        <Panel title="Recent case events">
          <Timeline items={activityQ.data} />
        </Panel>
      )}
    </div>
  );
}
