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
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const apps = appsQ.data ?? [];

  return (
    <div>
      <PageHeader title="Applications" subtitle="Track each university submission and decision." />
      {appsQ.isLoading ? (
        <LoadingRows />
      ) : !apps.length ? (
        <EmptyState title="No applications yet" />
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
