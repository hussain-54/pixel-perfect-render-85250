import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users, Clock3, UserCheck, BadgeDollarSign } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  Panel,
  PermissionDenied,
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import {
  forwardFeeVerificationRequest,
  getFrontDeskDashboard,
  listFeeVerificationRequests,
  reconcileFeeVerificationFromFee,
  returnFeeVerificationRequest,
} from "@/services";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import {
  describeFeeClaimDisplay,
  feeStatusAllowsAdmissionHandover,
  feeVerificationStatusesForTab,
  requestCompletedWithoutFeeAuthorization,
  requestStuckAfterFeeDecision,
  type FeeVerificationQueueTab,
} from "@/lib/fee-verification-workflow";
import { describePersistedSignupFeeStatus } from "@/lib/registration-form-a4";
import {
  FEE_QUEUE_KEY,
  useFeeVerificationQueueRealtime,
} from "@/lib/use-fee-verification-queue-realtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/front-desk")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { businessRole?: string | null; role?: string } }).auth;
    if (auth?.role === "consultant" && !isFrontDeskBusinessRole(auth.businessRole as never)) {
      throw redirect({ to: "/staff/dashboard" });
    }
  },
  component: FrontDeskDashboardPage,
});

const TABS: { id: FeeVerificationQueueTab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "awaiting_finance", label: "Awaiting Finance" },
  { id: "needs_correction", label: "Needs Correction" },
  { id: "completed", label: "Completed" },
];

function FrontDeskDashboardPage() {
  const queryClient = useQueryClient();
  const dashQ = useData(["front-desk", "dashboard"], getFrontDeskDashboard);
  const [tab, setTab] = useState<FeeVerificationQueueTab>("open");
  const [returnForId, setReturnForId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Always load history so tab counts stay accurate; tabs filter client-side.
  const feeReqQ = useQuery({
    queryKey: [...FEE_QUEUE_KEY, "with-history"],
    queryFn: () => listFeeVerificationRequests({ includeResolved: true }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const liveStatus = useFeeVerificationQueueRealtime(true);

  const forwardM = useMutation({
    mutationFn: (requestId: string) => forwardFeeVerificationRequest({ requestId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Forwarded to Accounts / Finance.");
      await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
    },
    onError: (err) => setActionMsg(portalErrorMessage(err, "Could not forward request.")),
  });

  const returnM = useMutation({
    mutationFn: () =>
      returnFeeVerificationRequest({
        requestId: returnForId!,
        reason: returnReason,
      }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Returned to counsellor.");
      setReturnForId(null);
      setReturnReason("");
      await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
    },
    onError: (err) => setActionMsg(portalErrorMessage(err, "Could not return request.")),
  });

  const reconcileM = useMutation({
    mutationFn: (studentId: string) => reconcileFeeVerificationFromFee({ studentId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Request synced from fee status.");
      await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
    },
    onError: (err) =>
      setActionMsg(portalErrorMessage(err, "Could not sync request from fee status.")),
  });

  const allRows = feeReqQ.data?.rows ?? [];
  const filteredRows = useMemo(() => {
    const allowed = new Set(feeVerificationStatusesForTab(tab));
    return allRows.filter((r) => allowed.has(r.status));
  }, [allRows, tab]);

  const openCount = feeReqQ.data?.openCount ?? filteredCountFallback(allRows, "open");
  const awaitingCount =
    feeReqQ.data?.awaitingFinanceCount ?? filteredCountFallback(allRows, "in_progress");
  const correctionCount =
    feeReqQ.data?.needsCorrectionCount ?? filteredCountFallback(allRows, "cancelled");
  const completedCount = feeReqQ.data?.completedCount ?? filteredCountFallback(allRows, "resolved");
  const stuckCount = allRows.filter((r) =>
    requestStuckAfterFeeDecision({
      requestStatus: r.status,
      signupFeeStatus: r.signupFeeStatus,
    }),
  ).length;

  const fdTitle = "Front Desk & Student Affairs";

  if (dashQ.isLoading) {
    return (
      <PageLoadState title={fdTitle}>
        <LoadingRows rows={6} />
      </PageLoadState>
    );
  }
  if (dashQ.isError) {
    const msg = portalErrorMessage(dashQ.error);
    if (/403|permission|not authorized|front desk/i.test(msg)) {
      return (
        <PageLoadState title={fdTitle}>
          <PermissionDenied body={msg} />
        </PageLoadState>
      );
    }
    return (
      <PageLoadState title={fdTitle}>
        <ErrorState body={msg} onRetry={() => void dashQ.refetch()} />
      </PageLoadState>
    );
  }

  const data = dashQ.data;
  if (!data) {
    return (
      <PageLoadState title={fdTitle}>
        <EmptyState
          title="No intake data"
          body="No registrations are available yet."
          action={
            <Button asChild size="sm">
              <Link to="/staff/register">Register New Student</Link>
            </Button>
          }
        />
      </PageLoadState>
    );
  }

  const queueStatValue = feeReqQ.isError
    ? "!"
    : feeReqQ.isLoading && !feeReqQ.data
      ? "…"
      : String(openCount + awaitingCount);

  const lastSync = feeReqQ.data?.fetchedAt
    ? new Date(feeReqQ.data.fetchedAt).toLocaleTimeString()
    : null;

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        title="Front Desk & Student Affairs"
        subtitle={data.greetingName}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/staff/register">
                <UserPlus className="mr-2 h-4 w-4" />
                Register New Student
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/intake">My Registrations</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setTab("awaiting_finance");
                document
                  .getElementById("fd-fee-verification-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Fee queue
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total registrations"
          value={String(data.myRegistrations)}
          icon={<Users />}
        />
        <StatCard
          label="Awaiting counsellor"
          value={String(data.awaitingAssignment)}
          icon={<Clock3 />}
        />
        <StatCard
          label="Assigned students"
          value={String(data.assignedStudents)}
          icon={<UserCheck />}
        />
        <StatCard
          label="Fees awaiting Finance"
          value={String(data.feesAwaitingFinance)}
          icon={<BadgeDollarSign />}
        />
        <StatCard
          label="Requests needing action"
          value={queueStatValue}
          icon={<BadgeDollarSign />}
        />
      </div>

      <div id="fd-fee-verification-panel">
        <Panel
          title="Counsellor Fee-Verification Requests"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <LiveBadge status={liveStatus} />
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
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Open: <strong className="text-navy">{feeReqQ.isError ? "—" : openCount}</strong>
            </span>
            <span>
              Awaiting Finance:{" "}
              <strong className="text-navy">{feeReqQ.isError ? "—" : awaitingCount}</strong>
            </span>
            <span>
              Needs correction:{" "}
              <strong className="text-navy">{feeReqQ.isError ? "—" : correctionCount}</strong>
            </span>
            <span>
              Completed:{" "}
              <strong className="text-navy">{feeReqQ.isError ? "—" : completedCount}</strong>
            </span>
            {lastSync ? <span>Synced {lastSync}</span> : null}
          </div>

          {stuckCount > 0 ? (
            <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {stuckCount} request{stuckCount === 1 ? "" : "s"} out of sync — use Sync from fee (fee
              already decided).
            </p>
          ) : null}

          {liveStatus === "offline" || liveStatus === "reconnecting" ? (
            <p className="mb-3 text-xs text-amber-800">Live updates offline — use Refresh.</p>
          ) : null}

          <div className="mb-4 flex flex-wrap gap-1 border-b border-border pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
                  tab === t.id ? "bg-navy text-white" : "text-muted-foreground hover:bg-accent",
                )}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {actionMsg ? <p className="mb-3 text-xs text-navy">{actionMsg}</p> : null}

          {feeReqQ.isLoading && !feeReqQ.data ? (
            <p className="text-sm text-muted-foreground">Loading fee-verification requests…</p>
          ) : feeReqQ.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-danger">
                Unable to load requests. The queue may be out of date. Retry.
              </p>
              <p className="text-xs text-muted-foreground">
                {portalErrorMessage(
                  feeReqQ.error,
                  "Apply migrations 20261020150000–20261020170000 on Supabase if the schema is missing.",
                )}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void feeReqQ.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : filteredRows.length === 0 ? (
            allRows.length > 0 ? (
              <div className="space-y-3">
                <EmptyState
                  title="No requests in this filter"
                  body="Requests exist in other statuses. Clear the filter or switch tabs."
                />
                <Button type="button" size="sm" variant="outline" onClick={() => setTab("open")}>
                  Show Open
                </Button>
              </div>
            ) : (
              <EmptyState
                title="No open fee-verification requests"
                body="When a counsellor successfully returns a case for signup-fee verification, it appears here. Accounts verifies or waives fees — Front Desk coordinates only."
              />
            )
          ) : (
            <TableWrap>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Counsellor</th>
                    <th className="px-3 py-2">Summary</th>
                    <th className="px-3 py-2">Fee</th>
                    <th className="px-3 py-2">Statuses</th>
                    <th className="px-3 py-2">Next / actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const feeOk = feeStatusAllowsAdmissionHandover(row.signupFeeStatus);
                    const forwarded = Boolean(row.forwardedAt) || row.status === "in_progress";
                    const stuck = requestStuckAfterFeeDecision({
                      requestStatus: row.status,
                      signupFeeStatus: row.signupFeeStatus,
                    });
                    const resolvedWithoutFee = requestCompletedWithoutFeeAuthorization({
                      requestStatus: row.status,
                      signupFeeStatus: row.signupFeeStatus,
                    });
                    const claim = describeFeeClaimDisplay({
                      signupFeeStatus: row.signupFeeStatus,
                      feeAmount: row.feeAmount,
                      feeCurrency: row.feeCurrency,
                      feePaymentMethod: row.feePaymentMethod,
                      feeReferenceReceipt: row.feeReferenceReceipt,
                    });
                    return (
                      <tr key={row.id} className="border-b border-border/60 align-top">
                        <td className="px-3 py-2">
                          <div className="font-medium text-navy">{row.fullName}</div>
                          <div className="text-xs text-muted-foreground">{row.caseId}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Submitted {fmtDate(row.createdAt.slice(0, 10))}
                          </div>
                        </td>
                        <td className="px-3 py-2">{row.counsellorName || "—"}</td>
                        <td className="max-w-[14rem] px-3 py-2 text-xs text-muted-foreground">
                          {row.summary}
                          {row.coordinatorNote ? (
                            <div className="mt-1 text-[11px] text-amber-800">
                              Note: {row.coordinatorNote}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <div className="capitalize font-medium text-navy">
                            Fee: {claim.feeStatusLabel}
                          </div>
                          <div className="text-muted-foreground">{claim.claimLabel}</div>
                          {row.feeVerifiedAt ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Decision {fmtDate(row.feeVerifiedAt.slice(0, 10))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Request
                          </div>
                          <StatusBadge status={row.status} />
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Updated {fmtDate(row.updatedAt.slice(0, 10))}
                          </div>
                          {row.resolvedAt ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Resolved {fmtDate(row.resolvedAt.slice(0, 10))}
                            </div>
                          ) : null}
                          {forwarded && row.status !== "resolved" ? (
                            <div className="mt-1 text-[11px] font-medium text-navy">
                              Forwarded to Accounts
                              {row.forwardedAt ? ` · ${fmtDate(row.forwardedAt.slice(0, 10))}` : ""}
                            </div>
                          ) : null}
                          {!forwarded && row.status === "open" ? (
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              Not yet forwarded
                            </div>
                          ) : null}
                          {stuck ? (
                            <div className="mt-1 text-[11px] font-medium text-amber-900">
                              Out of sync — fee decided, request still open
                            </div>
                          ) : null}
                          {resolvedWithoutFee ? (
                            <div className="mt-1 text-[11px] font-medium text-danger">
                              Request closed but fee gate not satisfied
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <p className="mb-2 text-xs text-muted-foreground">
                            {feeOk
                              ? "Fee authorized"
                              : resolvedWithoutFee
                                ? "Fee gate not satisfied"
                                : stuck
                                  ? "Out of sync — Sync from fee"
                                  : forwarded
                                    ? "Awaiting Finance verification"
                                    : "Send to Accounts when ready"}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <Button asChild size="sm" variant="outline">
                              <Link
                                to="/staff/students/$studentId"
                                params={{ studentId: row.studentId }}
                                search={{ tab: "assessment" }}
                              >
                                View Case
                              </Link>
                            </Button>
                            {stuck ? (
                              <Button
                                size="sm"
                                variant="navy"
                                disabled={reconcileM.isPending}
                                onClick={() => {
                                  setActionMsg(null);
                                  reconcileM.mutate(row.studentId);
                                }}
                              >
                                Sync from fee
                              </Button>
                            ) : null}
                            {!stuck &&
                            (row.status === "open" ||
                              (row.status === "in_progress" && !row.forwardedAt)) ? (
                              <Button
                                size="sm"
                                variant="navy"
                                disabled={forwardM.isPending}
                                onClick={() => {
                                  setActionMsg(null);
                                  forwardM.mutate(row.id);
                                }}
                              >
                                Send to Accounts / Finance
                              </Button>
                            ) : null}
                            {!stuck && (row.status === "open" || row.status === "in_progress") ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReturnForId(row.id);
                                  setReturnReason("");
                                  setActionMsg(null);
                                }}
                              >
                                Return to Counsellor
                              </Button>
                            ) : null}
                          </div>
                          {returnForId === row.id ? (
                            <div className="mt-2 space-y-2 rounded border border-border p-2">
                              <Textarea
                                placeholder="Required reason for counsellor (min 5 characters)"
                                value={returnReason}
                                onChange={(e) => setReturnReason(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={returnM.isPending || returnReason.trim().length < 5}
                                  onClick={() => returnM.mutate()}
                                >
                                  Confirm return
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setReturnForId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
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
                    <td className="px-3 py-2 text-xs">
                      {describePersistedSignupFeeStatus(row.signupFeeStatus).label}
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

function filteredCountFallback(rows: { status: string }[], status: string): number {
  return rows.filter((r) => r.status === status).length;
}

function LiveBadge({ status }: { status: "live" | "reconnecting" | "offline" | "connecting" }) {
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting" || status === "connecting"
        ? "Reconnecting"
        : "Offline";
  return (
    <span
      className={cn(
        "rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        status === "live"
          ? "bg-emerald-50 text-emerald-800"
          : status === "offline"
            ? "bg-slate-100 text-slate-600"
            : "bg-amber-50 text-amber-800",
      )}
    >
      {label}
    </span>
  );
}
