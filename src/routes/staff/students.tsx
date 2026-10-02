import { createFileRoute } from "@tanstack/react-router";
import { DEMO_CONSULTANT_ID } from "@/components/portal/demo";
import { PageHeader, TableWrap, fmtDate, LoadingRows, EmptyState } from "@/components/common";
import { useData } from "@/lib/useData";
import { getStudents, stageLabel } from "@/services";

export const Route = createFileRoute("/staff/students")({
  component: StaffStudents,
});

function StaffStudents() {
  const studentsQ = useData(["students"], getStudents);
  const myStudents = (studentsQ.data ?? []).filter((s) => s.consultantId === DEMO_CONSULTANT_ID);

  return (
    <div>
      <PageHeader title="Students" subtitle="Students assigned to you in the demo dataset." />
      {studentsQ.isLoading ? (
        <LoadingRows />
      ) : !myStudents.length ? (
        <EmptyState title="No assigned students" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Case</th>
              <th>Destination</th>
              <th>Program</th>
              <th>Stage</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {myStudents.map((s) => (
              <tr key={s.id}>
                <td className="font-medium text-navy">{s.name}</td>
                <td>{s.caseId}</td>
                <td>{s.destination}</td>
                <td>{s.program}</td>
                <td>{stageLabel(s.stage)}</td>
                <td>{fmtDate(s.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
