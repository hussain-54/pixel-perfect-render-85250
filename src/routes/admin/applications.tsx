import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  LoadingRows,
  EmptyState,
  ErrorState,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
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
      <PageHeader
        title="Admissions"
        subtitle="University applications and catalog references for admissions work."
      />
      <AdminModuleSubnav
        items={[
          { to: "/admin/applications", label: "Applications" },
          { to: "/admin/universities", label: "Universities" },
          { to: "/admin/programs", label: "Programs" },
          { to: "/admin/scholarships", label: "Scholarships" },
        ]}
      />
      {appsQ.isLoading ? (
        <LoadingRows />
      ) : appsQ.isError ? (
        <ErrorState body={portalErrorMessage(appsQ.error)} />
      ) : !appsQ.data?.length ? (
        <EmptyState title="No applications" body="No university applications in scope yet." />
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
            {appsQ.data.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td className="font-medium text-navy">
                  {a.studentName ?? lookupStudent(a.studentId)?.name ?? "—"}
                </td>
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
