import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PageHeader,
  Panel,
  TableWrap,
  fmtDate,
  ErrorState,
  LoadingRows,
  EmptyState,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/useData";
import {
  studentApplicationNextAction,
  studentApplicationStageExplain,
} from "@/lib/student-portal-workspace";
import { getCurrentStudent, getApplications, getDocuments } from "@/services";

export const Route = createFileRoute("/student/applications")({
  component: StudentApplications,
});

function StudentApplications() {
  const [q, setQ] = useState("");
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const sid = studentQ.data?.id ?? "";
  const appsQ = useData(["student", sid, "apps"], () =>
    sid ? getApplications(sid) : Promise.resolve([]),
  );
  const docsQ = useData(["student", sid, "docs"], () =>
    sid ? getDocuments(sid) : Promise.resolve([]),
  );

  const filtered = useMemo(() => {
    const apps = appsQ.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return apps;
    return apps.filter(
      (a) =>
        a.university.toLowerCase().includes(needle) ||
        a.program.toLowerCase().includes(needle) ||
        a.country.toLowerCase().includes(needle) ||
        a.intake.toLowerCase().includes(needle) ||
        a.status.toLowerCase().includes(needle),
    );
  }, [appsQ.data, q]);

  const docsByApp = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of docsQ.data ?? []) {
      if (!d.linkedApplicationId) continue;
      const needs =
        d.status === "Needs Correction" ||
        d.status === "Rejected" ||
        d.awaitingUpload ||
        d.status === "Pending Review";
      if (!needs) continue;
      map.set(d.linkedApplicationId, (map.get(d.linkedApplicationId) ?? 0) + 1);
    }
    return map;
  }, [docsQ.data]);

  if (studentQ.isLoading) return <LoadingRows rows={5} />;

  if (studentQ.isError || !studentQ.data) {
    const body = studentQ.isError
      ? portalErrorMessage(
          studentQ.error,
          "Could not load your student profile. If you are staff or admin, sign out and sign in again.",
        )
      : "No student profile is linked to this account yet. Ask Front Desk to register you, or sign out if you use a staff/admin account.";
    return (
      <div>
        <PageHeader
          title="Applications"
          subtitle="Track university files opened for your case. Internal review is not the same as university submission."
        />
        <ErrorState body={body} onRetry={() => void studentQ.refetch()} />
      </div>
    );
  }

  const apps = appsQ.data ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Applications"
        subtitle="Track university files opened for your case. Internal review is not the same as university submission."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/student/documents">Documents</Link>
          </Button>
        }
      />

      <Panel title="How to read application status">
        <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>
            <span className="font-medium text-navy">Docs Pending / Under Review</span> — internal
            Admission work; not yet submitted to the university.
          </li>
          <li>
            <span className="font-medium text-navy">Submitted</span> — confirmed university
            submission on file.
          </li>
          <li>
            <span className="font-medium text-navy">Offer Received</span> — decision/offer recorded
            by staff for your visibility.
          </li>
          <li>
            <span className="font-medium text-navy">Documents</span> — completeness is separate from
            application stage; open Documents to upload or correct files.
          </li>
        </ul>
      </Panel>

      {apps.length > 0 ? (
        <div className="max-w-md">
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
            Search
          </label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="University, program, intake, or status…"
            aria-label="Search applications"
          />
        </div>
      ) : null}

      {appsQ.isLoading ? (
        <LoadingRows />
      ) : appsQ.isError ? (
        <ErrorState
          body={portalErrorMessage(appsQ.error, "Could not load your applications.")}
          onRetry={() => void appsQ.refetch()}
        />
      ) : !apps.length ? (
        <EmptyState
          title="No applications yet"
          body="When your counsellor and Admission Team open a university application, it will appear here."
        />
      ) : !filtered.length ? (
        <EmptyState title="No matches" body="Try a different search term." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>University / program</th>
              <th>Intake</th>
              <th>Deadline</th>
              <th>Stage</th>
              <th className="hidden lg:table-cell">What this means</th>
              <th>Next for you</th>
              <th className="hidden md:table-cell">Docs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const linkedDocs = docsByApp.get(a.id) ?? 0;
              return (
                <tr key={a.id}>
                  <td className="font-medium text-navy">
                    {a.university}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {a.program}
                      {a.country ? ` · ${a.country}` : ""}
                    </span>
                  </td>
                  <td>{a.intake || "—"}</td>
                  <td>{a.deadline && a.deadline !== "-" ? fmtDate(a.deadline) : "—"}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="hidden max-w-[14rem] text-xs text-muted-foreground lg:table-cell">
                    {studentApplicationStageExplain(a.status)}
                  </td>
                  <td className="max-w-[12rem] text-xs text-muted-foreground">
                    {studentApplicationNextAction(a.status)}
                  </td>
                  <td className="hidden text-xs md:table-cell">
                    {linkedDocs > 0 ? (
                      <Link
                        to="/student/documents"
                        className="font-semibold text-royal hover:underline"
                      >
                        {linkedDocs} open
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
