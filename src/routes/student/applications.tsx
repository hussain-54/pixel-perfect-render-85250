import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  ErrorState,
  LoadingRows,
  EmptyState,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/useData";
import { getCurrentStudent, getApplications } from "@/services";

export const Route = createFileRoute("/student/applications")({
  component: StudentApplications,
});

function StudentApplications() {
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const sid = studentQ.data?.id ?? "";
  const appsQ = useData(["student", sid, "apps"], () =>
    sid ? getApplications(sid) : Promise.resolve([]),
  );

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
          subtitle="Track each university submission and decision."
        />
        <ErrorState body={body} />
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => {
            void studentQ.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const apps = appsQ.data ?? [];

  return (
    <div>
      <PageHeader title="Applications" subtitle="Track each university submission and decision." />
      {appsQ.isLoading ? (
        <LoadingRows />
      ) : appsQ.isError ? (
        <div>
          <ErrorState body={portalErrorMessage(appsQ.error, "Could not load your applications.")} />
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => {
              void appsQ.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : !apps.length ? (
        <EmptyState
          title="No applications yet"
          body="When your counsellor submits a university application, it will appear here."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>University</th>
              <th>Program</th>
              <th>Intake</th>
              <th>Deadline</th>
              <th>Applied</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td className="font-medium text-navy">
                  {a.university}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {a.country}
                  </span>
                </td>
                <td>{a.program}</td>
                <td>{a.intake}</td>
                <td>{fmtDate(a.deadline)}</td>
                <td>{fmtDate(a.appliedOn)}</td>
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
