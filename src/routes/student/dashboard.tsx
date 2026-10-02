import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, FileWarning, GraduationCap } from "lucide-react";
import { JourneyTracker } from "@/components/JourneyTracker";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionRequiredBanner, filterActionRequired } from "@/components/portal/ActionRequiredDocs";
import { PageHeader, Panel, StatCard, fmtDate, ErrorState, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import {
  getCurrentStudent,
  getAppointments,
  getDocuments,
  getApplications,
  lookupConsultant,
} from "@/services";

export const Route = createFileRoute("/student/dashboard")({
  component: StudentDashboard,
});

function StudentDashboard() {
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const studentId = studentQ.data?.id;

  const sid = studentId ?? "";
  const apptsQ = useData(["student", sid, "appts"], () =>
    sid ? getAppointments(sid) : Promise.resolve([]),
  );
  const docsQ = useData(["student", sid, "docs"], () =>
    sid ? getDocuments(sid) : Promise.resolve([]),
  );
  const appsQ = useData(["student", sid, "apps"], () =>
    sid ? getApplications(sid) : Promise.resolve([]),
  );

  if (studentQ.isLoading) return <LoadingRows rows={6} />;
  if (studentQ.isError || !studentQ.data)
    return <ErrorState body="Could not load your demo profile." />;

  const student = studentQ.data;
  const consultant = lookupConsultant(student.consultantId);
  const docs = docsQ.data ?? [];
  const actionCount = filterActionRequired(docs).length;
  const upcoming = (apptsQ.data ?? [])
    .filter((a) => a.status === "Confirmed" || a.status === "Requested")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const apps = appsQ.data ?? [];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${student.name.split(" ")[0]}`}
        subtitle={`Demo student · Case ${student.caseId} · ${student.destination} · ${student.program}`}
      />

      <p className="mb-4 rounded-md border border-dashed border-royal/30 bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
        You are viewing the portal as <strong className="text-navy">{student.name}</strong> (first
        mock student). Data is read-only demo content.
      </p>

      <div className="mb-6">
        <JourneyTracker stage={student.stage} />
      </div>

      <ActionRequiredBanner docs={docs} uploadLink="/student/documents" />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Action required"
          value={actionCount}
          hint="Documents to fix or re-upload"
          icon={<FileWarning />}
        />
        <StatCard
          label="Applications"
          value={apps.length}
          hint="Universities in your pipeline"
          icon={<GraduationCap />}
        />
        <StatCard
          label="Documents"
          value={docs.length}
          hint="Files on your case file"
          icon={<FileWarning />}
        />
        <StatCard
          label="Consultant"
          value={consultant?.name.split(" ")[0] ?? "—"}
          {...(consultant?.role ? { hint: consultant.role } : {})}
          icon={<Calendar />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Next appointment">
          {apptsQ.isLoading ? (
            <LoadingRows rows={2} />
          ) : upcoming ? (
            <div className="space-y-2">
              <p className="font-semibold text-navy">{upcoming.type}</p>
              <p className="text-sm text-muted-foreground">
                {fmtDate(upcoming.date)} at {upcoming.time}
              </p>
              <p className="text-sm">{lookupConsultant(upcoming.consultantId)?.name}</p>
              <StatusBadge status={upcoming.status} />
              <Link
                to="/student/appointments"
                className="mt-2 inline-block text-sm font-semibold text-royal hover:underline"
              >
                View all appointments
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming appointments. Book via your consultant.
            </p>
          )}
        </Panel>
        <Panel title="Application snapshot">
          {appsQ.isLoading ? (
            <LoadingRows rows={2} />
          ) : apps.length ? (
            <ul className="space-y-3">
              {apps.slice(0, 3).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 first:border-0 first:pt-0"
                >
                  <div>
                    <p className="font-semibold text-navy">{a.university}</p>
                    <p className="text-xs text-muted-foreground">{a.program}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
