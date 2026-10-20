import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users, Clock3, UserCheck, BadgeDollarSign } from "lucide-react";
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
import { getFrontDeskDashboard, listFeeVerificationRequests } from "@/services";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import { workspaceTitleForSession } from "@/lib/workspace-branding";
import { feeStatusAllowsAdmissionHandover } from "@/lib/fee-verification-workflow";
import {
  FEE_QUEUE_KEY,
  useFeeVerificationQueueRealtime,
} from "@/lib/use-fee-verification-queue-realtime";

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
  const feeReqQ = useQuery({
    queryKey: [...FEE_QUEUE_KEY],
    queryFn: listFeeVerificationRequests,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  useFeeVerificationQueueRealtime(true);

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

  const feeRows = feeReqQ.data?.rows ?? [];
  const queueCount = feeRows.length;

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

      <div className="grid gap-4 sm:grid-cols-4">
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
        <StatCard
          label="Fee verification queue"
          value={feeReqQ.isLoading && !feeReqQ.data ? "…" : String(queueCount)}
          icon={<BadgeDollarSign />}
        />
      </div>

      <Panel
        title="Counsellor fee-verification requests"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={feeReqQ.isFetching}
              onClick={() => void feeReqQ.refetch()}
            >
              {feeReqQ.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/staff/finance">Accounts / Finance</Link>
            </Button>
          </div>
        }
      >
        {feeReqQ.isLoading && !feeReqQ.data ? (
          <p className="text-sm text-muted-foreground">Loading fee-verification requests…</p>
        ) : feeReqQ.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {portalErrorMessage(
                feeReqQ.error,
                "Fee verification queue unavailable. Apply migrations 20261020150000 and 20261020160000 if needed.",
              )}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => void feeReqQ.refetch()}>
              Retry
            </Button>
          </div>
        ) : feeRows.length === 0 ? (
          <EmptyState
            title="No open fee-verification requests"
            body="When a counsellor returns a case for signup-fee verification, it appears here for Front Desk coordination. Accounts verifies or waives fees. Queue count matches this list."
          />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Counsellor</th>
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Fee claim</th>
                  <th className="px-3 py-2">Fee status</th>
                  <th className="px-3 py-2">Request status</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Next action</th>
                </tr>
              </thead>
              <tbody>
                {feeRows.map((row) => {
                  const feeOk = feeStatusAllowsAdmissionHandover(row.signupFeeStatus);
                  const claimBits = [
                    row.feeAmount != null
                      ? `${row.feeCurrency || ""} ${row.feeAmount}`.trim()
                      : null,
                    row.feePaymentMethod,
                    row.feeReferenceReceipt ? `Ref: ${row.feeReferenceReceipt}` : null,
                  ].filter(Boolean);
                  return (
                    <tr key={row.id} className="border-b border-border/60 align-top">
                      <td className="px-3 py-2">
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: row.studentId }}
                          search={{ tab: "assessment" }}
                          className="font-medium text-navy underline-offset-2 hover:underline"
                        >
                          {row.fullName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{row.caseId}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Requested {fmtDate(row.createdAt.slice(0, 10))}
                        </div>
                      </td>
                      <td className="px-3 py-2">{row.counsellorName || "—"}</td>
                      <td className="max-w-[14rem] px-3 py-2 text-xs text-muted-foreground">
                        {row.summary}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2 text-xs text-muted-foreground">
                        {claimBits.length ? claimBits.join(" · ") : "No claim recorded"}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {(row.signupFeeStatus || "—").replaceAll("_", " ")}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {fmtDate(row.updatedAt.slice(0, 10))}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {feeOk
                          ? "Fee authorized — ready for Admission handover (counsellor)"
                          : "Coordinate claim/receipt; Accounts must verify or waive"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>

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
