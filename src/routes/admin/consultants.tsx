import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  LoadingRows,
  EmptyState,
  ErrorState,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { useData } from "@/lib/useData";
import { getConsultants } from "@/services";

export const Route = createFileRoute("/admin/consultants")({
  component: AdminConsultants,
});

function AdminConsultants() {
  const consQ = useData(["consultants"], getConsultants);

  return (
    <div>
      <PageHeader
        title="Consultants"
        subtitle="Live consultant desks with active student counts. Other performance totals stay zero until operational aggregates exist."
      />
      <AdminModuleSubnav
        items={[
          { to: "/admin/students", label: "Roster" },
          { to: "/admin/leads", label: "Leads" },
          { to: "/admin/consultants", label: "Consultants" },
        ]}
      />
      {consQ.isLoading ? (
        <LoadingRows />
      ) : consQ.isError ? (
        <ErrorState body={portalErrorMessage(consQ.error)} />
      ) : !consQ.data?.length ? (
        <EmptyState title="No consultants" body="No consultant desks are linked yet." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Email</th>
              <th>Students</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {consQ.data.map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-navy">{c.name}</td>
                <td>{c.role}</td>
                <td>{c.department}</td>
                <td>{c.email || "—"}</td>
                <td>{c.metrics.students}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
