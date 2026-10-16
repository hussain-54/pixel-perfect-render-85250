import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { UserPlus, Users, Clock3, UserCheck } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getFrontDeskDashboard } from "@/services";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import { workspaceTitleForSession } from "@/lib/workspace-branding";

export const Route = createFileRoute("/staff/front-desk")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { businessRole?: string | null; role?: string } }).auth;
    if (auth?.role === "consultant" && !isFrontDeskBusinessRole(auth.businessRole as never)) {
      throw redirect({ to: "/staff/dashboard" });
    }
  },
  component: FrontDeskDashboardPage,
});

function FrontDeskDashboardPage() {
  const dashQ = useData(["front-desk", "dashboard"], getFrontDeskDashboard);

  if (dashQ.isLoading) return <LoadingRows rows={6} />;
  if (dashQ.isError) {
    const msg = portalErrorMessage(dashQ.error);
    if (/403|permission|not authorized|front desk/i.test(msg)) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  const data = dashQ.data;
  if (!data) {
    return <EmptyState title="No intake data" body="No registrations are available yet." />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${workspaceTitleForSession({ portal: "staff", businessRole: "front_desk_student_affairs" })} — ${data.greetingName}`}
        subtitle="Register students, record intake fees, and assign counsellors."
        actions={
          <Button asChild>
            <Link to="/staff/register">
              <UserPlus className="mr-2 h-4 w-4" />
              Register New Student
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="My registrations" value={String(data.myRegistrations)} icon={<Users />} />
        <StatCard
          label="Awaiting counsellor"
          value={String(data.awaitingAssignment)}
          icon={<Clock3 />}
        />
        <StatCard
          label="Recently assigned"
          value={String(data.recentAssigned.length)}
          icon={<UserCheck />}
        />
      </div>

      <Panel
        title="Recent registrations"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/staff/intake">View all</Link>
          </Button>
        }
      >
        {data.recentRegistrations.length === 0 ? (
          <EmptyState
            title="No registrations yet"
            body="Use Register New Student to create the first intake record."
          />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Counsellor</th>
                  <th className="px-3 py-2">Fee</th>
                  <th className="px-3 py-2">Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRegistrations.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium text-navy">{row.caseId}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.fullName}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      {row.assignmentStatus === "pending" ? (
                        <StatusBadge status="Pending" />
                      ) : (
                        row.counsellorName || "Assigned"
                      )}
                    </td>
                    <td className="px-3 py-2 capitalize">
                      {row.signupFeeStatus?.replaceAll("_", " ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
