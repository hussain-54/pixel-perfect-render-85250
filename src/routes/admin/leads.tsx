import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getLeads, lookupConsultant } from "@/services";

export const Route = createFileRoute("/admin/leads")({
  component: AdminLeads,
});

function AdminLeads() {
  const leadsQ = useData(["leads"], getLeads);

  return (
    <div>
      <PageHeader title="Leads" subtitle="All enquiries in the demo CRM." />
      {leadsQ.isLoading ? (
        <LoadingRows />
      ) : !leadsQ.data?.length ? (
        <EmptyState title="No leads" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Country</th>
              <th>Program</th>
              <th>Source</th>
              <th>Consultant</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {leadsQ.data.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td className="font-medium text-navy">{l.name}</td>
                <td>{l.country}</td>
                <td>{l.program}</td>
                <td>{l.source}</td>
                <td>{l.consultantId ? lookupConsultant(l.consultantId)?.name : "Unassigned"}</td>
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
