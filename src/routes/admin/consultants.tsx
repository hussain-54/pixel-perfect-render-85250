import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, LoadingRows } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getConsultants } from "@/services";

export const Route = createFileRoute("/admin/consultants")({
  component: AdminConsultants,
});

function AdminConsultants() {
  const consQ = useData(["consultants"], getConsultants);

  return (
    <div>
      <PageHeader title="Consultants" subtitle="Team roster and departments." />
      {consQ.isLoading ? (
        <LoadingRows />
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
            {(consQ.data ?? []).map((c) => (
              <tr key={c.id}>
                <td className="font-medium text-navy">{c.name}</td>
                <td>{c.role}</td>
                <td>{c.department}</td>
                <td>{c.email}</td>
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
