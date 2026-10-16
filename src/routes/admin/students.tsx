import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  LoadingRows,
  EmptyState,
  ErrorState,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { AdminModuleSubnav } from "@/components/portal/AdminModuleSubnav";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/useData";
import {
  adminStudentsRosterFilters,
  adminStudentsRosterQueryKey,
  resolveAdminRosterViewState,
} from "@/lib/admin-students-roster";
import { getStudentsDirectory } from "@/services";

export const Route = createFileRoute("/admin/students")({
  component: AdminStudents,
});

function AdminStudents() {
  const [page, setPage] = useState(1);
  const filters = adminStudentsRosterFilters(page);
  const studentsQ = useData(adminStudentsRosterQueryKey(filters), () =>
    getStudentsDirectory(filters),
  );

  const view = resolveAdminRosterViewState({
    isLoading: studentsQ.isLoading,
    isError: studentsQ.isError,
    errorMessage: portalErrorMessage(studentsQ.error),
    data: studentsQ.data,
  });

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

      {view.kind === "loading" ? <LoadingRows /> : null}

      {view.kind === "permission" ? <PermissionDenied body={view.message} /> : null}

      {view.kind === "error" ? <ErrorState body={view.message} /> : null}

      {view.kind === "empty" ? (
        <EmptyState title="No students" body="No active students match this roster yet." />
      ) : null}

      {view.kind === "rows" ? (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th>Case</th>
                <th>Name</th>
                <th>Destination</th>
                <th>Intake</th>
                <th>Consultant</th>
                <th>Stage</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {view.result.rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.caseId}</td>
                  <td className="font-medium text-navy">{s.name}</td>
                  <td>{s.destination}</td>
                  <td>{s.intake}</td>
                  <td>{s.consultantName || "—"}</td>
                  <td>{s.stageLabel}</td>
                  <td>{fmtDate(s.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {view.result.total > view.result.pageSize ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <p>
                Showing {(view.result.page - 1) * view.result.pageSize + 1}–
                {Math.min(view.result.page * view.result.pageSize, view.result.total)} of{" "}
                {view.result.total}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={view.result.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={view.result.page * view.result.pageSize >= view.result.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
