import { createFileRoute } from "@tanstack/react-router";
import { DEMO_CONSULTANT_ID } from "@/components/portal/demo";
import { PageHeader, TableWrap, fmtDate, LoadingRows, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getApplications, getStudents, lookupStudent } from "@/services";

export const Route = createFileRoute("/staff/applications")({
  component: StaffApplications,
});

function StaffApplications() {
  const appsQ = useData(["applications"], getApplications);
  const studentsQ = useData(["students"], getStudents);
  const myStudentIds = new Set(
    (studentsQ.data ?? []).filter((s) => s.consultantId === DEMO_CONSULTANT_ID).map((s) => s.id),
  );
  const rows = (appsQ.data ?? []).filter((a) => myStudentIds.has(a.studentId));

  return (
    <div>
      <PageHeader title="Applications" subtitle="Applications for your assigned students." />
      {appsQ.isLoading || studentsQ.isLoading ? (
        <LoadingRows />
      ) : !rows.length ? (
        <EmptyState title="No applications" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Student</th>
              <th>University</th>
              <th>Program</th>
              <th>Deadline</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="font-medium text-navy">{lookupStudent(a.studentId)?.name ?? "—"}</td>
                <td>{a.university}</td>
                <td>{a.program}</td>
                <td>{fmtDate(a.deadline)}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
