import { createFileRoute } from "@tanstack/react-router";
import { DEMO_CONSULTANT_ID } from "@/components/portal/demo";
import { PageHeader, TableWrap, fmtDate, LoadingRows, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getLeads } from "@/services";

export const Route = createFileRoute("/staff/leads")({
  component: StaffLeads,
});

function StaffLeads() {
  const leadsQ = useData(["leads"], getLeads);
  const rows = (leadsQ.data ?? []).filter((l) => l.consultantId === DEMO_CONSULTANT_ID);

  return (
    <div>
      <PageHeader title="Leads" subtitle="Prospects assigned to you in the demo CRM." />
      {leadsQ.isLoading ? (
        <LoadingRows />
      ) : !rows.length ? (
        <EmptyState title="No leads assigned" body="Try the admin leads view for all enquiries." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>Program</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="font-medium text-navy">{l.name}</td>
                <td>{l.country}</td>
                <td>{l.program}</td>
                <td>{l.source}</td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td>{fmtDate(l.created)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
