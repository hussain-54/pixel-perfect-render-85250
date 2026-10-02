import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getApplications, lookupStudent } from "@/services";

export const Route = createFileRoute("/admin/applications")({
  component: AdminApplications,
});

function AdminApplications() {
  const appsQ = useData(["applications"], getApplications);

  return (
    <div>
      <PageHeader title="Applications" subtitle="All university applications." />
      {appsQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>ID</th>
              <th>Student</th>
              <th>University</th>
              <th>Program</th>
              <th>Intake</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(appsQ.data ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td className="font-medium text-navy">{lookupStudent(a.studentId)?.name ?? "—"}</td>
                <td>{a.university}</td>
                <td>{a.program}</td>
                <td>{a.intake}</td>
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
