import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  ErrorState,
  LoadingRows,
  EmptyState,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getCurrentStudent, getAppointments, lookupConsultant } from "@/services";

export const Route = createFileRoute("/student/appointments")({
  component: StudentAppointments,
});

function StudentAppointments() {
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const sid = studentQ.data?.id ?? "";
  const apptsQ = useData(["student", sid, "appts"], () =>
    sid ? getAppointments(sid) : Promise.resolve([]),
  );

  if (studentQ.isLoading) return <LoadingRows rows={5} />;
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const rows = [...(apptsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Demo schedule for your case — book changes via your consultant."
      />
      {apptsQ.isLoading ? (
        <LoadingRows />
      ) : !rows.length ? (
        <EmptyState title="No appointments" body="Your consultation history will appear here." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Consultant</th>
              <th>Destination</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  {fmtDate(a.date)} · {a.time}
                </td>
                <td className="font-medium text-navy">{a.type}</td>
                <td>{lookupConsultant(a.consultantId)?.name ?? "—"}</td>
                <td>{a.destination}</td>
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
