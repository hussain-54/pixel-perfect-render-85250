import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getAppointments, lookupStudent, lookupConsultant } from "@/services";

export const Route = createFileRoute("/admin/appointments")({
  component: AdminAppointments,
});

function AdminAppointments() {
  const apptsQ = useData(["appointments"], getAppointments);
  const rows = [...(apptsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Firm-wide schedule (demo)." />
      {apptsQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Consultant</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  {fmtDate(a.date)} · {a.time}
                </td>
                <td className="font-medium text-navy">{lookupStudent(a.studentId)?.name ?? "—"}</td>
                <td>{lookupConsultant(a.consultantId)?.name ?? "—"}</td>
                <td>{a.type}</td>
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
