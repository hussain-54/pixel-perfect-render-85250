import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, UserPlus, Users, Clock3, BadgeDollarSign, AlertCircle } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  LiveBadge,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import {
  forwardFeeVerificationRequest,
  getFrontDeskDashboard,
  getNotifications,
  listFeeVerificationRequests,
  markNotificationRead,
  reconcileFeeVerificationFromFee,
  returnFeeVerificationRequest,
} from "@/services";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import {
  buildFrontDeskAttentionItems,
  frontDeskIntakeFocusSearch,
  resolveFrontDeskNotificationHref,
} from "@/lib/front-desk-workspace";
import {
  describeFeeClaimDisplay,
  feeStatusAllowsAdmissionHandover,
  feeVerificationRowMatchesTab,
  requestCompletedWithoutFeeAuthorization,
  requestStuckAfterFeeDecision,
  type FeeVerificationQueueTab,
} from "@/lib/fee-verification-workflow";
import { describePersistedSignupFeeStatus } from "@/lib/registration-form-a4";
import { shouldOfferMarkAsRead } from "@/lib/notification-rules";
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

const FEE_TABS: {
  id: FeeVerificationQueueTab;
  label: string;
  scope: "fd" | "finance" | "history";
}[] = [
  { id: "open", label: "Open (Front Desk)", scope: "fd" },
  { id: "awaiting_finance", label: "Awaiting Finance", scope: "finance" },
  { id: "needs_correction", label: "Needs correction", scope: "fd" },
  { id: "completed", label: "Completed", scope: "history" },
  { id: "cancelled", label: "Cancelled (history)", scope: "history" },
];

type KpiFilter = "all" | "awaiting" | "fee_verify" | "fee_corrections";

function attentionActionLabel(
  kind: "unassigned" | "fee_open" | "fee_stuck" | "fee_correction" | "fee_rejected",
): string {
  if (kind === "unassigned") return "Assign";
  if (kind === "fee_correction") return "Fix";
  if (kind === "fee_stuck") return "Sync";
  return "Open";
}

function FrontDeskDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dashQ = useData(["front-desk", "dashboard"], getFrontDeskDashboard);
  const [tab, setTab] = useState<FeeVerificationQueueTab>("open");
  const [returnForId, setReturnForId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("all");

  function applyKpiFilter(next: KpiFilter) {
    setKpiFilter(next);
    if (next === "fee_corrections") {
      setTab("needs_correction");
      document
        .getElementById("fd-dashboard-board")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (next === "fee_verify") {
      setTab("awaiting_finance");
    }
    document
      .getElementById("fd-dashboard-board")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectFeeTab(next: FeeVerificationQueueTab) {
    setTab(next);
    setActionMsg(null);
    document
      .getElementById("fd-fee-verification-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const feeReqQ = useQuery({
    queryKey: [...FEE_QUEUE_KEY, "with-history"],
    queryFn: () => listFeeVerificationRequests({ includeResolved: true }),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const notifQ = useQuery({
    queryKey: ["notifications", "staff"],
    queryFn: () => getNotifications("staff"),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const liveStatus = useFeeVerificationQueueRealtime(true);

  const markM = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", "staff"] });
    },
  });

  const invalidateFrontDesk = async () => {
    await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
    await queryClient.invalidateQueries({ queryKey: ["front-desk"] });
  };

  const forwardM = useMutation({
    mutationFn: (requestId: string) => forwardFeeVerificationRequest({ requestId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Forwarded to Accounts / Finance.");
      await invalidateFrontDesk();
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
      await invalidateFrontDesk();
    },
    onError: (err) => setActionMsg(portalErrorMessage(err, "Could not return request.")),
  });

  const reconcileM = useMutation({
    mutationFn: (studentId: string) => reconcileFeeVerificationFromFee({ studentId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Request synced from fee status.");
      await invalidateFrontDesk();
    },
    onError: (err) =>
      setActionMsg(portalErrorMessage(err, "Could not sync request from fee status.")),
  });

  const allRows = useMemo(() => feeReqQ.data?.rows ?? [], [feeReqQ.data?.rows]);
  const filteredRows = useMemo(
    () => allRows.filter((r) => feeVerificationRowMatchesTab(r, tab)),
    [allRows, tab],
  );

  const openCount = allRows.filter((r) => r.status === "open").length;
  const awaitingCount = allRows.filter((r) => r.status === "in_progress").length;
  const needsCorrectionCount = allRows.filter((r) =>
    feeVerificationRowMatchesTab(r, "needs_correction"),
  ).length;
  const cancelledHistoryCount = allRows.filter((r) =>
    feeVerificationRowMatchesTab(r, "cancelled"),
  ).length;
  const completedCount = allRows.filter((r) => r.status === "resolved").length;
  const stuckCount = allRows.filter((r) =>
    requestStuckAfterFeeDecision({
      requestStatus: r.status,
      signupFeeStatus: r.signupFeeStatus,
    }),
  ).length;

  const unreadCount = (notifQ.data ?? []).filter((n) => !n.read).length;

  const intakeSource = useMemo(
    () => dashQ.data?.intakeRows ?? dashQ.data?.recentRegistrations ?? [],
    [dashQ.data],
  );

  const correctionStudentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of allRows) {
      if (feeVerificationRowMatchesTab(r, "needs_correction")) ids.add(r.studentId);
    }
    return ids;
  }, [allRows]);

  const attentionItems = useMemo(() => {
    const items = buildFrontDeskAttentionItems({
      intakeRows: intakeSource,
      feeRequests: allRows,
      limit: 10,
    });
    if (kpiFilter === "awaiting") return items.filter((i) => i.kind === "unassigned");
    if (kpiFilter === "fee_verify") {
      return items.filter((i) => i.kind === "fee_open" || i.kind === "fee_stuck");
    }
    if (kpiFilter === "fee_corrections") {
      return items.filter((i) => i.kind === "fee_correction" || i.kind === "fee_rejected");
    }
    return items;
  }, [intakeSource, allRows, kpiFilter]);

  const recentRegistrations = useMemo(() => {
    let list = [...intakeSource].sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
    if (kpiFilter === "awaiting") {
      list = list.filter((r) => r.assignmentStatus === "pending");
    } else if (kpiFilter === "fee_verify") {
      list = list.filter((r) => (r.signupFeeStatus || "").toLowerCase() === "claimed");
    } else if (kpiFilter === "fee_corrections") {
      list = list.filter(
        (r) =>
          correctionStudentIds.has(r.id) || (r.signupFeeStatus || "").toLowerCase() === "rejected",
      );
    }
    return list.slice(0, 8);
  }, [intakeSource, kpiFilter, correctionStudentIds]);

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
              <Link to="/staff/register">Register Student</Link>
            </Button>
          }
        />
      </PageLoadState>
    );
  }

  const lastSyncMs = [
    feeReqQ.data?.fetchedAt ? Date.parse(feeReqQ.data.fetchedAt) : Number.NaN,
    dashQ.dataUpdatedAt || Number.NaN,
  ].filter((n) => Number.isFinite(n));
  const lastSync = lastSyncMs.length
    ? new Date(Math.max(...lastSyncMs)).toLocaleTimeString()
    : null;

  const feeToVerifyCount = data.proofsAwaitingFinance ?? 0;

  async function openNotification(n: {
    id: string;
    read: boolean;
    linkPath?: string | null;
    studentId?: string | null;
  }) {
    const href = resolveFrontDeskNotificationHref({
      linkPath: n.linkPath,
      studentId: n.studentId,
    });
    if (shouldOfferMarkAsRead(n) && !n.read) {
      try {
        await markM.mutateAsync(n.id);
      } catch {
        // Navigation still proceeds; mark-read is best-effort.
      }
    }
    setNotifOpen(false);
    void router.navigate({ to: href });
  }

  const activeFeeTabLabel = FEE_TABS.find((t) => t.id === tab)?.label ?? tab;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 md:space-y-5">
      <PageHeader
        title={fdTitle}
        subtitle={`Student intake & tracking · Signed in as ${data.greetingName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge status={liveStatus} lastSync={lastSync} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="relative"
              aria-label={
                unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
              }
              onClick={() => setNotifOpen(true)}
            >
              <Bell className="mr-2 h-4 w-4" aria-hidden />
              Alerts
              {unreadCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-navy px-1.5 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Button>
            <Button asChild size="sm" variant="navy">
              <Link to="/staff/register">
                <UserPlus className="mr-2 h-4 w-4" />
                Register Student
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/intake">My Registrations</Link>
            </Button>
          </div>
        }
      />

      {/* Part A — four compact KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Registrations"
          value={String(data.myRegistrations)}
          icon={<Users />}
          selected={kpiFilter === "all"}
          onClick={() => applyKpiFilter("all")}
          title="All registrations you manage"
        />
        <StatCard
          label="Need Counsellor"
          value={String(data.awaitingAssignment)}
          icon={<Clock3 />}
          selected={kpiFilter === "awaiting"}
          onClick={() => applyKpiFilter("awaiting")}
          title="Registrations awaiting counsellor assignment"
        />
        <StatCard
          label="Fee to Verify"
          value={String(feeToVerifyCount)}
          hint="Proofs awaiting Finance"
          icon={<BadgeDollarSign />}
          selected={kpiFilter === "fee_verify"}
          onClick={() => applyKpiFilter("fee_verify")}
          title="Signup fee claimed — awaiting Accounts verification"
        />
        <StatCard
          label="Fee Corrections"
          value={String(needsCorrectionCount)}
          hint="Needs counsellor follow-up"
          icon={<AlertCircle />}
          selected={kpiFilter === "fee_corrections"}
          onClick={() => applyKpiFilter("fee_corrections")}
          title="Cancelled coordination with no fee ledger — needs correction"
        />
      </div>

      {kpiFilter !== "all" ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Showing filtered view
            {kpiFilter === "awaiting"
              ? " · Need Counsellor"
              : kpiFilter === "fee_verify"
                ? " · Fee to Verify"
                : " · Fee Corrections"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => applyKpiFilter("all")}
          >
            Show all records
          </Button>
        </div>
      ) : null}

      {/* Part B — unified Needs Attention + Recent Registrations */}
      <section
        id="fd-dashboard-board"
        className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
      >
        <div className="grid lg:grid-cols-3">
          <div className="lg:col-span-2 lg:border-r lg:border-border">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="font-sans text-sm font-semibold text-navy">Needs Your Attention</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setTab("open");
                  document
                    .getElementById("fd-fee-verification-panel")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Fee queue
              </Button>
            </header>
            <div className="px-4 py-3">
              {attentionItems.length === 0 ? (
                <EmptyState
                  title="Nothing needs attention"
                  body="Unassigned registrations and actionable fee coordination appear here."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {attentionItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy">{item.title}</p>
                        <p className="text-sm text-navy/90">
                          {item.fullName}{" "}
                          <span className="font-normal text-muted-foreground">· {item.caseId}</span>
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
                      </div>
                      {item.kind === "fee_stuck" ? (
                        <div className="flex shrink-0 flex-wrap gap-1.5 self-start sm:self-center">
                          <Button
                            size="sm"
                            variant="navy"
                            disabled={reconcileM.isPending}
                            onClick={() => {
                              setActionMsg(null);
                              reconcileM.mutate(item.studentId);
                            }}
                          >
                            {reconcileM.isPending ? "Syncing…" : "Sync"}
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/staff/intake/$studentId"
                              params={{ studentId: item.studentId }}
                              search={frontDeskIntakeFocusSearch({
                                kind: item.kind,
                                requestId: item.requestId ?? null,
                              })}
                            >
                              Open
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          asChild
                          size="sm"
                          variant="navy"
                          className="shrink-0 self-start sm:self-center"
                        >
                          <Link
                            to="/staff/intake/$studentId"
                            params={{ studentId: item.studentId }}
                            search={frontDeskIntakeFocusSearch({
                              kind: item.kind,
                              requestId: item.requestId ?? null,
                            })}
                          >
                            {attentionActionLabel(item.kind)}
                          </Link>
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-t border-border lg:border-t-0">
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="font-sans text-sm font-semibold text-navy">Recent Registrations</h2>
              <Button asChild size="sm" variant="outline">
                <Link to="/staff/intake">View all</Link>
              </Button>
            </header>
            <div className="px-4 py-3">
              {recentRegistrations.length === 0 ? (
                <EmptyState
                  title="No recent registrations"
                  body={
                    kpiFilter === "all"
                      ? "New registrations will appear here."
                      : "No records match this KPI filter."
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {recentRegistrations.map((row) => {
                    const feeLabel = describePersistedSignupFeeStatus(row.signupFeeStatus).label;
                    return (
                      <li key={row.id}>
                        <Link
                          to="/staff/intake/$studentId"
                          params={{ studentId: row.id }}
                          className="flex items-start justify-between gap-2 py-3 transition-colors first:pt-0 last:pb-0 hover:bg-navy/[0.02]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-navy">{row.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(row.createdAt)}
                              {row.assignmentStatus === "pending"
                                ? " · Unassigned"
                                : row.counsellorName
                                  ? ` · ${row.counsellorName}`
                                  : " · Assigned"}
                            </p>
                          </div>
                          <StatusBadge status={feeLabel} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Part C — original lower fee coordination workflow (preserved + refined) */}
      <div id="fd-fee-verification-panel">
        <Panel
          compact
          title="Counsellor Fee-Verification Requests"
          action={
            <div className="flex flex-wrap items-center gap-2">
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
          <p className="mb-3 text-xs text-muted-foreground">
            Counsellor coordination requests only — not proof of payment. Finance verifies or waives
            on the fee ledger. Counselling consent is recorded by the assigned counsellor on the
            student profile, not on this Front Desk dashboard.
          </p>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ["open", "Open", openCount, "fd"],
                ["awaiting_finance", "Awaiting Finance", awaitingCount, "finance"],
                ["needs_correction", "Needs correction", needsCorrectionCount, "fd"],
                ["completed", "Completed", completedCount, "history"],
                ["cancelled", "Cancelled", cancelledHistoryCount, "history"],
              ] as const
            ).map(([id, label, count, scope]) => (
              <button
                key={id}
                type="button"
                onClick={() => selectFeeTab(id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-colors",
                  tab === id
                    ? "border-navy bg-navy text-white"
                    : "border-border bg-white hover:border-navy/40",
                )}
              >
                <span
                  className={cn(
                    "block text-[10px] font-semibold uppercase tracking-wide",
                    tab === id ? "text-white/80" : "text-muted-foreground",
                  )}
                >
                  {label}
                  {scope === "finance" ? " · Finance" : scope === "fd" ? " · FD" : " · History"}
                </span>
                <span className="mt-0.5 block text-xl font-semibold">
                  {feeReqQ.isError ? "—" : count}
                </span>
              </button>
            ))}
          </div>

          {stuckCount > 0 ? (
            <p className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {stuckCount} request{stuckCount === 1 ? "" : "s"} out of sync — use Sync from fee (fee
              already decided by Accounts).
            </p>
          ) : null}

          {liveStatus === "offline" || liveStatus === "reconnecting" ? (
            <p className="mb-3 text-xs text-amber-800">
              Live updates {liveStatus === "offline" ? "offline" : "reconnecting"} — use Refresh or
              wait for reconnect.
            </p>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-1 border-b border-border pb-2">
            {FEE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "rounded px-2.5 py-1.5 text-xs font-semibold",
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
            <p className="text-sm text-muted-foreground">Loading fee coordination requests…</p>
          ) : feeReqQ.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-danger">
                Unable to load requests. The queue may be out of date. Retry.
              </p>
              <p className="text-xs text-muted-foreground">
                {portalErrorMessage(
                  feeReqQ.error,
                  "Apply fee-verification migrations on Supabase if the schema is missing.",
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
                  title={`No requests in “${activeFeeTabLabel}”`}
                  body={`${allRows.length} request${allRows.length === 1 ? "" : "s"} exist in other statuses. Switch tabs to continue.`}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setTab("open")}>
                    Show Open
                  </Button>
                  {needsCorrectionCount > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTab("needs_correction")}
                    >
                      Needs correction ({needsCorrectionCount})
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No fee coordination requests"
                body="When a counsellor requests signup-fee verification, it appears under Open. Accounts verifies or waives fees — Front Desk coordinates only."
              />
            )
          ) : (
            <TableWrap compact>
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="hidden md:table-cell">Note</th>
                  <th>Status</th>
                  <th>Next / actions</th>
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
                  const isHistory = tab === "cancelled" || tab === "completed";
                  return (
                    <tr key={row.id} className="align-top">
                      <td>
                        <div className="font-medium text-navy">{row.fullName}</div>
                        <div className="text-xs text-muted-foreground">{row.caseId}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.counsellorName || "—"} · {fmtDate(row.createdAt.slice(0, 10))}
                        </div>
                      </td>
                      <td className="hidden max-w-[14rem] text-xs text-muted-foreground md:table-cell">
                        {row.summary || "—"}
                        {row.coordinatorNote ? (
                          <div className="mt-1 text-[11px] text-amber-800">
                            Note: {row.coordinatorNote}
                          </div>
                        ) : null}
                        <div className="mt-1">
                          Fee ledger: {claim.hasFeeRecord ? claim.feeStatusLabel : "No fee row"} ·{" "}
                          {claim.claimLabel}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                        {forwarded && row.status !== "resolved" && row.status !== "cancelled" ? (
                          <div className="mt-1 text-[11px] font-medium text-navy">
                            With Accounts / Finance
                          </div>
                        ) : null}
                        {stuck ? (
                          <div className="mt-1 text-[11px] font-medium text-amber-900">
                            Out of sync — fee decided
                          </div>
                        ) : null}
                        {tab === "cancelled" ? (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Historical — not an active task
                          </div>
                        ) : null}
                        {resolvedWithoutFee ? (
                          <div className="mt-1 text-[11px] font-medium text-danger">
                            Closed but fee gate not satisfied
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <p className="mb-2 text-xs text-muted-foreground">
                          {isHistory
                            ? tab === "cancelled"
                              ? "History only — use fee ledger status on the student record"
                              : feeOk
                                ? "Completed · fee authorized"
                                : "Completed · check fee gate"
                            : feeOk
                              ? "Fee authorized"
                              : stuck
                                ? "Sync from fee"
                                : forwarded
                                  ? "Awaiting Finance verification"
                                  : tab === "needs_correction"
                                    ? "Open Fix — issue voucher / proof, then counsellor re-requests"
                                    : "Send to Accounts when ready"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/staff/intake/$studentId"
                              params={{ studentId: row.studentId }}
                              search={{
                                focus: "fee" as const,
                                requestId: row.id,
                              }}
                            >
                              {tab === "needs_correction" ? "Fix" : "Open record"}
                            </Link>
                          </Button>
                          {!isHistory && stuck ? (
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
                          {!isHistory &&
                          !stuck &&
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
                              Send to Accounts
                            </Button>
                          ) : null}
                          {!isHistory &&
                          !stuck &&
                          (row.status === "open" || row.status === "in_progress") ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReturnForId(row.id);
                                setReturnReason("");
                                setActionMsg(null);
                              }}
                            >
                              Return
                            </Button>
                          ) : null}
                        </div>
                        {returnForId === row.id ? (
                          <div className="mt-2 space-y-2 rounded border border-border p-2">
                            <Textarea
                              placeholder="Required reason for counsellor (min 5 characters)"
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              aria-label="Return reason"
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
            </TableWrap>
          )}
        </Panel>
      </div>

      <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {notifQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading notifications…</p>
            ) : notifQ.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-danger">Could not load notifications.</p>
                <Button size="sm" variant="outline" onClick={() => void notifQ.refetch()}>
                  Retry
                </Button>
              </div>
            ) : !(notifQ.data ?? []).length ? (
              <EmptyState
                title="No notifications"
                body="Fee-verification and intake alerts for your account appear here."
              />
            ) : (
              <ul className="space-y-2">
                {(notifQ.data ?? []).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring",
                        !n.read && "border-navy/25 bg-navy/[0.03]",
                      )}
                      onClick={() => void openNotification(n)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-navy">{n.title}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
                      </div>
                      {n.body ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{n.body}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {n.read ? "Read" : "Unread"}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
