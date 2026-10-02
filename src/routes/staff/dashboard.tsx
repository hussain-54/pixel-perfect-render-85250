import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Users, Inbox } from "lucide-react";
import { DEMO_CONSULTANT_ID, DEMO_TODAY } from "@/components/portal/demo";
import {
  PageHeader,
  Panel,
  StatCard,
  TableWrap,
  fmtDate,
  LoadingRows,
  ErrorState,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Initials } from "@/components/common";
import { useData } from "@/lib/useData";
import {
  getConsultant,
  getStudents,
  getAppointments,
  getDocuments,
  lookupStudent,
  stageLabel,
} from "@/services";

export const Route = createFileRoute("/staff/dashboard")({
  component: StaffDashboard,
});

function StaffDashboard() {
  const consultantQ = useData(["staff", "consultant", DEMO_CONSULTANT_ID], () =>
    getConsultant(DEMO_CONSULTANT_ID),
  );
  const studentsQ = useData(["students"], getStudents);
  const apptsQ = useData(["appointments"], getAppointments);
  const docsQ = useData(["documents"], getDocuments);

  if (consultantQ.isLoading || studentsQ.isLoading) return <LoadingRows rows={6} />;
  if (!consultantQ.data) return <ErrorState body="Demo consultant not found." />;

  const consultant = consultantQ.data;
  const myStudents = (studentsQ.data ?? []).filter((s) => s.consultantId === DEMO_CONSULTANT_ID);
  const todayAppts = (apptsQ.data ?? []).filter(
    (a) => a.consultantId === DEMO_CONSULTANT_ID && a.date === DEMO_TODAY,
  );
  const pendingAppts = (apptsQ.data ?? []).filter(
    (a) => a.consultantId === DEMO_CONSULTANT_ID && a.status === "Requested",
  );
  const pendingDocs = (docsQ.data ?? []).filter(
    (d) => d.status === "Pending Review" && myStudents.some((s) => s.id === d.studentId),
  );

  return (
    <div>
      <PageHeader
        title={`Good day, ${consultant.name.split(" ")[0]}`}
        subtitle={`Demo consultant · ${consultant.role} · ${consultant.department}`}
      />
      <p className="mb-4 rounded-md border border-dashed border-royal/30 bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
        Logged in as <strong className="text-navy">{consultant.name}</strong> (mock consultant c1).
        Schedule uses demo date {fmtDate(DEMO_TODAY)}.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned students" value={myStudents.length} icon={<Users />} />
        <StatCard
          label="Today’s sessions"
          value={todayAppts.length}
          hint="On demo calendar date"
          icon={<Calendar />}
        />
        <StatCard label="Pending requests" value={pendingAppts.length} icon={<Inbox />} />
        <StatCard label="Docs to review" value={pendingDocs.length} icon={<Inbox />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Today’s schedule">
          {!todayAppts.length ? (
            <p className="text-sm text-muted-foreground">No appointments on the demo date.</p>
          ) : (
            <ul className="space-y-3">
              {todayAppts.map((a) => {
                const st = lookupStudent(a.studentId);
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 border-t pt-3 first:border-0 first:pt-0"
                  >
                    <Initials name={st?.name ?? "?"} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy">{st?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.time} · {a.type}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/staff/appointments"
            className="mt-4 inline-block text-sm font-semibold text-royal hover:underline"
          >
            Full calendar →
          </Link>
        </Panel>

        <Panel title="Assigned students">
          <TableWrap>
            <thead>
              <tr>
                <th>Student</th>
                <th>Destination</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {myStudents.slice(0, 5).map((s) => (
                <tr key={s.id}>
                  <td className="font-medium text-navy">{s.name}</td>
                  <td>{s.destination}</td>
                  <td className="text-xs">{stageLabel(s.stage)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Link
            to="/staff/students"
            className="mt-4 inline-block text-sm font-semibold text-royal hover:underline"
          >
            All students →
          </Link>
        </Panel>
      </div>
    </div>
  );
}
