import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getAppointments, lookupStudent } from "@/services";

export const Route = createFileRoute("/staff/appointments")({
  component: StaffAppointments,
});

function StaffAppointments() {
  // Desk scoping is enforced server-side via the trusted session consultant id.
  const apptsQ = useData(["appointments"], getAppointments);
  const rows = [...(apptsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Your consultation calendar." />
      {apptsQ.isLoading ? (
        <LoadingRows />
      ) : !rows.length ? (
        <EmptyState title="No appointments" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Type</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  {fmtDate(a.date)} · {a.time}
                </td>
                <td className="font-medium text-navy">
                  {a.studentName ?? lookupStudent(a.studentId)?.name ?? "—"}
                </td>
                <td>{a.type}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td className="max-w-xs text-sm text-muted-foreground">{a.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
