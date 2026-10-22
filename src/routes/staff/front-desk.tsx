import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  UserPlus,
  Users,
  Clock3,
  BadgeDollarSign,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  deriveFrontDeskNextAction,
  resolveFrontDeskNotificationHref,
} from "@/lib/front-desk-workspace";
import {
  describeFeeClaimDisplay,
  feeStatusAllowsAdmissionHandover,
  feeVerificationStatusesForTab,
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

const TABS: { id: FeeVerificationQueueTab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "awaiting_finance", label: "Awaiting Finance" },
  { id: "needs_correction", label: "Needs Correction" },
  { id: "completed", label: "Completed" },
];

type RegSortKey = "createdAt" | "updatedAt" | "fullName";

function FrontDeskDashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dashQ = useData(["front-desk", "dashboard"], getFrontDeskDashboard);
  const [tab, setTab] = useState<FeeVerificationQueueTab>("open");
  const [returnForId, setReturnForId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [regSearch, setRegSearch] = useState("");
  const [regAssign, setRegAssign] = useState("all");
  const [regFee, setRegFee] = useState("all");
  const [regSort, setRegSort] = useState<RegSortKey>("createdAt");
  const [regPage, setRegPage] = useState(0);
  const regPageSize = 8;

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

  const forwardM = useMutation({
    mutationFn: (requestId: string) => forwardFeeVerificationRequest({ requestId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Forwarded to Accounts / Finance.");
      await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["front-desk", "dashboard"] });
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
      await queryClient.invalidateQueries({ queryKey: ["front-desk", "dashboard"] });
    },
    onError: (err) => setActionMsg(portalErrorMessage(err, "Could not return request.")),
  });

  const reconcileM = useMutation({
    mutationFn: (studentId: string) => reconcileFeeVerificationFromFee({ studentId }),
    onSuccess: async (res) => {
      setActionMsg(res?.message ?? "Request synced from fee status.");
      await queryClient.invalidateQueries({ queryKey: [...FEE_QUEUE_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["front-desk", "dashboard"] });
    },
    onError: (err) =>
      setActionMsg(portalErrorMessage(err, "Could not sync request from fee status.")),
  });

  const allRows = useMemo(() => feeReqQ.data?.rows ?? [], [feeReqQ.data?.rows]);
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

  const unreadCount = (notifQ.data ?? []).filter((n) => !n.read).length;

  const attentionItems = useMemo(() => {
    const intakeRows = dashQ.data?.intakeRows ?? dashQ.data?.recentRegistrations ?? [];
    return buildFrontDeskAttentionItems({
      intakeRows,
      feeRequests: allRows,
      limit: 10,
    });
  }, [dashQ.data, allRows]);

  const registrationRows = useMemo(() => {
    const source = dashQ.data?.intakeRows ?? dashQ.data?.recentRegistrations ?? [];
    const q = regSearch.trim().toLowerCase();
    let list = source.filter((r) => {
      if (regAssign === "pending" && r.assignmentStatus !== "pending") return false;
      if (regAssign === "assigned" && r.assignmentStatus !== "assigned") return false;
      if (regFee !== "all" && (r.signupFeeStatus || "unpaid") !== regFee) return false;
      if (!q) return true;
      return [r.caseId, r.fullName, r.email, r.counsellorName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    list = [...list].sort((a, b) => {
      if (regSort === "fullName") return a.fullName.localeCompare(b.fullName);
      return String(b[regSort] || "").localeCompare(String(a[regSort] || ""));
    });
    return list;
  }, [dashQ.data, regSearch, regAssign, regFee, regSort]);

  const regPageCount = Math.max(1, Math.ceil(registrationRows.length / regPageSize));
  const regPageRows = registrationRows.slice(
    regPage * regPageSize,
    regPage * regPageSize + regPageSize,
  );

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

  const lastSync = feeReqQ.data?.fetchedAt
    ? new Date(feeReqQ.data.fetchedAt).toLocaleTimeString()
    : null;
  const actionRequired =
    typeof data.actionRequired === "number" ? data.actionRequired : attentionItems.length;
  const applicationsInProgress =
    typeof data.applicationsInProgress === "number" ? data.applicationsInProgress : 0;

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

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        title="Front Desk & Student Affairs"
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
            <Button asChild size="sm">
              <Link to="/staff/register">
                <UserPlus className="mr-2 h-4 w-4" />
                Register
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/staff/intake">My Registrations</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Registrations"
          value={String(data.myRegistrations)}
          icon={<Users />}
        />
        <StatCard
          label="Awaiting Counsellor"
          value={String(data.awaitingAssignment)}
          icon={<Clock3 />}
        />
        <StatCard
          label="Fee Verification"
          value={String(data.feesAwaitingFinance)}
          hint="Signup fees unpaid or claimed"
          icon={<BadgeDollarSign />}
        />
        <StatCard
          label="Applications In Progress"
          value={String(applicationsInProgress)}
          hint="Journey at/after application submitted"
          icon={<ClipboardList />}
        />
        <StatCard
          label="Action Required"
          value={String(actionRequired)}
          hint="Unassigned or fee queue needing FD"
          icon={<AlertCircle />}
        />
      </div>

      <Panel
        title="Needs Your Attention"
        action={
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
        }
      >
        {attentionItems.length === 0 ? (
          <EmptyState
            title="Nothing needs attention"
            body="New fee-verification requests and unassigned registrations will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {attentionItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy">
                    {item.fullName}{" "}
                    <span className="font-normal text-muted-foreground">· {item.caseId}</span>
                  </p>
                  <p className="text-sm text-navy/90">{item.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.detail}</p>
                </div>
                <Button
                  asChild
                  size="sm"
                  variant="navy"
                  className="shrink-0 self-start sm:self-center"
                >
                  <Link to="/staff/intake/$studentId" params={{ studentId: item.studentId }}>
                    Open record
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Recent Registrations"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/staff/intake">View all</Link>
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="fd-dash-search">Search</Label>
            <Input
              id="fd-dash-search"
              value={regSearch}
              onChange={(e) => {
                setRegSearch(e.target.value);
                setRegPage(0);
              }}
              placeholder="Name, case, email…"
            />
          </div>
          <div>
            <Label htmlFor="fd-dash-assign">Counsellor</Label>
            <select
              id="fd-dash-assign"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={regAssign}
              onChange={(e) => {
                setRegAssign(e.target.value);
                setRegPage(0);
              }}
            >
              <option value="all">All</option>
              <option value="pending">Awaiting assignment</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>
          <div>
            <Label htmlFor="fd-dash-fee">Signup fee</Label>
            <select
              id="fd-dash-fee"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={regFee}
              onChange={(e) => {
                setRegFee(e.target.value);
                setRegPage(0);
              }}
            >
              <option value="all">All</option>
              <option value="unpaid">Not claimed</option>
              <option value="claimed">Claimed</option>
              <option value="verified">Verified</option>
              <option value="waived">Waived</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <Label htmlFor="fd-dash-sort">Sort</Label>
            <select
              id="fd-dash-sort"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={regSort}
              onChange={(e) => setRegSort(e.target.value as RegSortKey)}
            >
              <option value="createdAt">Registration date</option>
              <option value="updatedAt">Last updated</option>
              <option value="fullName">Student name</option>
            </select>
          </div>
        </div>

        {registrationRows.length === 0 ? (
          <EmptyState
            title="No matching registrations"
            body="Adjust filters or register a new student."
            action={
              <Button asChild size="sm">
                <Link to="/staff/register">Register New Student</Link>
              </Button>
            }
          />
        ) : (
          <>
            <TableWrap>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Student</th>
                    <th className="hidden px-3 py-2 md:table-cell">Counsellor</th>
                    <th className="hidden px-3 py-2 lg:table-cell">Registered</th>
                    <th className="px-3 py-2">Fee</th>
                    <th className="hidden px-3 py-2 xl:table-cell">Updated</th>
                    <th className="px-3 py-2">Next</th>
                    <th className="px-3 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {regPageRows.map((row) => {
                    const openReq =
                      allRows.find(
                        (r) =>
                          r.studentId === row.id &&
                          (r.status === "open" || r.status === "in_progress"),
                      ) ?? null;
                    const next = deriveFrontDeskNextAction({
                      assignmentStatus: row.assignmentStatus,
                      signupFeeStatus: row.signupFeeStatus,
                      openFeeRequest: openReq,
                    });
                    return (
                      <tr key={row.id} className="border-b border-border/60 align-top">
                        <td className="px-3 py-2.5 font-medium text-navy">{row.caseId}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{row.fullName}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                          <div className="mt-1 text-xs text-muted-foreground md:hidden">
                            {row.assignmentStatus === "pending"
                              ? "Awaiting counsellor"
                              : row.counsellorName || "Assigned"}
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 md:table-cell">
                          {row.assignmentStatus === "pending" ? (
                            <StatusBadge status="Pending" />
                          ) : (
                            row.counsellorName || "Assigned"
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground lg:table-cell">
                          {fmtDate(row.createdAt)}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {describePersistedSignupFeeStatus(row.signupFeeStatus).label}
                        </td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground xl:table-cell">
                          {fmtDate(row.updatedAt)}
                        </td>
                        <td className="max-w-[12rem] px-3 py-2.5 text-xs text-muted-foreground">
                          {next.label}
                        </td>
                        <td className="px-3 py-2.5">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/staff/intake/$studentId" params={{ studentId: row.id }}>
                              View record
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {registrationRows.length} record{registrationRows.length === 1 ? "" : "s"} · Page{" "}
                {regPage + 1} of {regPageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={regPage <= 0}
                  onClick={() => setRegPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={regPage + 1 >= regPageCount}
                  onClick={() => setRegPage((p) => Math.min(regPageCount - 1, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>

      <div id="fd-fee-verification-panel">
        <Panel
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
            <p className="mb-3 text-xs text-amber-800">
              Live updates {liveStatus === "offline" ? "offline" : "reconnecting"} — use Refresh or
              wait for reconnect.
            </p>
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
                    <th className="hidden px-3 py-2 md:table-cell">Counsellor</th>
                    <th className="hidden px-3 py-2 lg:table-cell">Summary</th>
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
                          <div className="mt-1 text-xs text-muted-foreground md:hidden">
                            {row.counsellorName || "—"}
                          </div>
                        </td>
                        <td className="hidden px-3 py-2 md:table-cell">
                          {row.counsellorName || "—"}
                        </td>
                        <td className="hidden max-w-[14rem] px-3 py-2 text-xs text-muted-foreground lg:table-cell">
                          {row.summary}
                          {row.coordinatorNote ? (
                            <div className="mt-1 text-[11px] text-amber-800">
                              Note: {row.coordinatorNote}
                            </div>
                          ) : null}
                          <div className="mt-1 capitalize">
                            Fee: {claim.feeStatusLabel} · {claim.claimLabel}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} />
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Updated {fmtDate(row.updatedAt.slice(0, 10))}
                          </div>
                          {forwarded && row.status !== "resolved" ? (
                            <div className="mt-1 text-[11px] font-medium text-navy">
                              Forwarded to Accounts
                            </div>
                          ) : null}
                          {stuck ? (
                            <div className="mt-1 text-[11px] font-medium text-amber-900">
                              Out of sync — fee decided
                            </div>
                          ) : null}
                          {resolvedWithoutFee ? (
                            <div className="mt-1 text-[11px] font-medium text-danger">
                              Closed but fee gate not satisfied
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
                                to="/staff/intake/$studentId"
                                params={{ studentId: row.studentId }}
                              >
                                View record
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
                                Send to Accounts
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
              </table>
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

function filteredCountFallback(rows: { status: string }[], status: string): number {
  return rows.filter((r) => r.status === status).length;
}

function LiveBadge({
  status,
  lastSync,
}: {
  status: "live" | "reconnecting" | "offline" | "connecting";
  lastSync: string | null;
}) {
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting" || status === "connecting"
        ? "Reconnecting"
        : lastSync
          ? `Last updated ${lastSync}`
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
      title={lastSync ? `Queue synced ${lastSync}` : undefined}
    >
      {label}
    </span>
  );
}
