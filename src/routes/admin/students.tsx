import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows } from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { useData } from "@/lib/useData";
import { getStudents, lookupConsultant, stageLabel } from "@/services";

export const Route = createFileRoute("/admin/students")({
  component: AdminStudents,
});

function AdminStudents() {
  const studentsQ = useData(["students"], getStudents);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Full student roster. Related workspace tools stay inside this module."
      />
      <AdminModuleSubnav
        items={[
          { to: "/admin/students", label: "Roster" },
          { to: "/admin/leads", label: "Leads" },
          { to: "/admin/consultants", label: "Consultants" },
        ]}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Need the firm leaderboard?{" "}
        <Link
          to="/admin/leaderboard"
          className="font-medium text-bright underline-offset-2 hover:underline"
        >
          Open leaderboard
        </Link>
        .
      </p>
      {studentsQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Case</th>
              <th>Name</th>
              <th>Destination</th>
              <th>Program</th>
              <th>Consultant</th>
              <th>Stage</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {(studentsQ.data ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.caseId}</td>
                <td className="font-medium text-navy">{s.name}</td>
                <td>{s.destination}</td>
                <td>{s.program}</td>
                <td>{lookupConsultant(s.consultantId)?.name ?? "—"}</td>
                <td>{stageLabel(s.stage)}</td>
                <td>{fmtDate(s.lastActivity)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
