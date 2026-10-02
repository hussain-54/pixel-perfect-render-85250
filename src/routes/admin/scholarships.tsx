import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getScholarships } from "@/services";

export const Route = createFileRoute("/admin/scholarships")({
  component: AdminScholarships,
});

function AdminScholarships() {
  const scQ = useData(["scholarships"], getScholarships);

  return (
    <div>
      <PageHeader title="Scholarships" subtitle="Funding opportunities database." />
      {scQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>Level</th>
              <th>Funding</th>
              <th>Field</th>
              <th>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {(scQ.data ?? []).map((s) => (
              <tr key={s.id}>
                <td className="font-medium text-navy">{s.name}</td>
                <td>{s.country}</td>
                <td>{s.level}</td>
                <td>
                  <StatusBadge status={s.funding} />
                </td>
                <td>{s.field}</td>
                <td>{fmtDate(s.deadline)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
