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
  CheckCircle2,
  Link2,
} from "lucide-react";
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
  frontDeskActionRequiredStudentIds,
  frontDeskNextActionCta,
  resolveFrontDeskNotificationHref,
} from "@/lib/front-desk-workspace";
import {
  intakePortalStatusFromRow,
  studentPortalAccountStatusLabel,
} from "@/lib/student-portal-account";
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

type RegSortKey = "createdAt" | "updatedAt" | "fullName";
type KpiFilter =
  "all" | "awaiting" | "assigned" | "unpaid" | "claimed" | "verified" | "portal" | "action";

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
  const [regPortal, setRegPortal] = useState("all");
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>("all");
  const [regSort, setRegSort] = useState<RegSortKey>("updatedAt");
  const [regPage, setRegPage] = useState(0);
  const regPageSize = 10;

  function applyKpiFilter(next: KpiFilter) {
    setKpiFilter(next);
    setRegPage(0);
    setRegSearch("");
    if (next === "all") {
      setRegAssign("all");
      setRegFee("all");
      setRegPortal("all");
      return;
    }
    if (next === "awaiting") {
      setRegAssign("pending");
      setRegFee("all");
      setRegPortal("all");
      return;
    }
    if (next === "assigned") {
      setRegAssign("assigned");
      setRegFee("all");
      setRegPortal("all");
      return;
    }
    if (next === "unpaid") {
      setRegAssign("all");
      setRegFee("unpaid");
      setRegPortal("all");
      return;
    }
    if (next === "claimed") {
      setRegAssign("all");
      setRegFee("claimed");
      setRegPortal("all");
      return;
    }
    if (next === "verified") {
      setRegAssign("all");
      setRegFee("verified");
      setRegPortal("all");
      return;
    }
    if (next === "portal") {
      setRegAssign("all");
      setRegFee("all");
      setRegPortal("pending");
      return;
    }
    if (next === "action") {
      setRegAssign("all");
      setRegFee("all");
      setRegPortal("all");
      document
        .getElementById("fd-records-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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

  const actionStudentIds = useMemo(
    () =>
      frontDeskActionRequiredStudentIds({
        intakeRows: intakeSource,
        feeRequests: allRows,
      }),
    [intakeSource, allRows],
  );

  const attentionItems = useMemo(
    () =>
      buildFrontDeskAttentionItems({
        intakeRows: intakeSource,
        feeRequests: allRows,
        limit: 8,
      }),
    [intakeSource, allRows],
  );

  const registrationRows = useMemo(() => {
    const q = regSearch.trim().toLowerCase();
    let list = intakeSource.filter((r) => {
      if (kpiFilter === "action" && !actionStudentIds.has(r.id)) return false;
      if (regAssign === "pending" && r.assignmentStatus !== "pending") return false;
      if (regAssign === "assigned" && r.assignmentStatus !== "assigned") return false;
      if (regFee !== "all" && (r.signupFeeStatus || "unpaid") !== regFee) return false;
      if (regPortal === "pending") {
        const fee = (r.signupFeeStatus || "").toLowerCase();
        if (fee !== "verified" && fee !== "waived") return false;
        if (r.portalActivatedAt) return false;
      }
      if (regPortal === "active" && !r.portalActivatedAt) return false;
      if (!q) return true;
      return [r.caseId, r.fullName, r.email, r.counsellorName, r.destination, r.program]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    list = [...list].sort((a, b) => {
      if (regSort === "fullName") return a.fullName.localeCompare(b.fullName);
      return String(b[regSort] || "").localeCompare(String(a[regSort] || ""));
    });
    return list;
  }, [intakeSource, regSearch, regAssign, regFee, regPortal, regSort, kpiFilter, actionStudentIds]);

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
  const actionRequired =
    typeof data.actionRequired === "number" ? data.actionRequired : actionStudentIds.size;

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
    <div className="mx-auto w-full max-w-7xl space-y-3 md:space-y-4">
      <PageHeader
        compact
        title={fdTitle}
        subtitle={`${data.greetingName} · Intake, assignment & fee coordination`}
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
              <Bell className="mr-1.5 h-4 w-4" aria-hidden />
              Alerts
              {unreadCount > 0 ? (
                <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-navy px-1.5 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Button>
            <Button asChild size="sm" variant="navy">
              <Link to="/staff/register">
                <UserPlus className="mr-1.5 h-4 w-4" />
                Register Student
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <StatCard
          label="Total registrations"
          value={String(data.myRegistrations)}
          icon={<Users />}
          selected={kpiFilter === "all"}
          onClick={() => applyKpiFilter("all")}
          title="All registrations you manage"
        />
        <StatCard
          label="Awaiting counsellor"
          value={String(data.awaitingAssignment)}
          icon={<Clock3 />}
          selected={kpiFilter === "awaiting"}
          onClick={() => applyKpiFilter("awaiting")}
        />
        <StatCard
          label="Assigned"
          value={String(data.assignedStudents)}
          icon={<ClipboardList />}
          selected={kpiFilter === "assigned"}
          onClick={() => applyKpiFilter("assigned")}
        />
        <StatCard
          label="Voucher pending"
          value={String(data.unpaidVouchers ?? 0)}
          hint="Issued, not claimed"
          icon={<BadgeDollarSign />}
          selected={kpiFilter === "unpaid"}
          onClick={() => applyKpiFilter("unpaid")}
        />
        <StatCard
          label="Proofs ↔ Finance"
          value={String(data.proofsAwaitingFinance ?? 0)}
          hint="Claimed — not verified"
          icon={<BadgeDollarSign />}
          selected={kpiFilter === "claimed"}
          onClick={() => applyKpiFilter("claimed")}
        />
        <StatCard
          label="Finance verified"
          value={String(data.verifiedFees ?? 0)}
          icon={<CheckCircle2 />}
          selected={kpiFilter === "verified"}
          onClick={() => applyKpiFilter("verified")}
        />
        <StatCard
          label="Portal link pending"
          value={String(data.portalLinkPending ?? 0)}
          hint="Fee authorized"
          icon={<Link2 />}
          selected={kpiFilter === "portal"}
          onClick={() => applyKpiFilter("portal")}
        />
        <StatCard
          label="Action required"
          value={String(actionRequired)}
          hint="Unassigned, rejected, open/stuck, or needs correction"
          icon={<AlertCircle />}
          selected={kpiFilter === "action"}
          onClick={() => applyKpiFilter("action")}
        />
      </div>

      <div id="fd-records-panel">
        <Panel
          compact
          title="Student records & action queue"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {attentionItems.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant={kpiFilter === "action" ? "navy" : "outline"}
                  onClick={() => applyKpiFilter("action")}
                >
                  Needs attention · {attentionItems.length}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">No attention items</span>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to="/staff/intake">Full list</Link>
              </Button>
            </div>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="fd-dash-search">Search</Label>
              <Input
                id="fd-dash-search"
                value={regSearch}
                onChange={(e) => {
                  setRegSearch(e.target.value);
                  setKpiFilter("all");
                  setRegPage(0);
                }}
                placeholder="Name, case, destination…"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="fd-dash-assign">Counsellor</Label>
              <select
                id="fd-dash-assign"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={regAssign}
                onChange={(e) => {
                  setRegAssign(e.target.value);
                  setKpiFilter("all");
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
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={regFee}
                onChange={(e) => {
                  setRegFee(e.target.value);
                  setKpiFilter("all");
                  setRegPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="unpaid">Voucher unpaid</option>
                <option value="claimed">Proof submitted</option>
                <option value="verified">Verified</option>
                <option value="waived">Waived</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fd-dash-portal">Portal</Label>
              <select
                id="fd-dash-portal"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={regPortal}
                onChange={(e) => {
                  setRegPortal(e.target.value);
                  setKpiFilter("all");
                  setRegPage(0);
                }}
              >
                <option value="all">All</option>
                <option value="pending">Link pending</option>
                <option value="active">Activated</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fd-dash-sort">Sort</Label>
              <select
                id="fd-dash-sort"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={regSort}
                onChange={(e) => setRegSort(e.target.value as RegSortKey)}
              >
                <option value="updatedAt">Last updated</option>
                <option value="createdAt">Registration date</option>
                <option value="fullName">Student name</option>
              </select>
            </div>
          </div>

          {kpiFilter !== "all" || regAssign !== "all" || regFee !== "all" || regPortal !== "all" ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Filter active
                {kpiFilter === "action" ? " · Action required" : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => applyKpiFilter("all")}
              >
                Clear filters
              </Button>
            </div>
          ) : null}

          {registrationRows.length === 0 ? (
            <EmptyState
              title="No matching student records"
              body={
                kpiFilter === "action"
                  ? "Nothing currently needs Front Desk action. Clear the Action required filter to see all registrations."
                  : "Adjust filters or register a new student."
              }
              action={
                <div className="flex flex-wrap gap-2">
                  {kpiFilter !== "all" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => applyKpiFilter("all")}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                  <Button asChild size="sm">
                    <Link to="/staff/register">Register Student</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              <TableWrap compact>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th className="hidden md:table-cell">Destination / course</th>
                    <th className="hidden lg:table-cell">Counsellor</th>
                    <th>Fee</th>
                    <th className="hidden xl:table-cell">Portal</th>
                    <th className="hidden lg:table-cell">Updated</th>
                    <th>Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {regPageRows.map((row) => {
                    const openReq =
                      allRows.find(
                        (r) =>
                          r.studentId === row.id &&
                          (r.status === "open" ||
                            r.status === "in_progress" ||
                            feeVerificationRowMatchesTab(r, "needs_correction")),
                      ) ?? null;
                    const next = deriveFrontDeskNextAction({
                      assignmentStatus: row.assignmentStatus,
                      signupFeeStatus: row.signupFeeStatus,
                      openFeeRequest: openReq,
                    });
                    const portalLabel = studentPortalAccountStatusLabel(
                      intakePortalStatusFromRow({
                        profileId: row.profileId,
                        portalActivatedAt: row.portalActivatedAt,
                      }),
                    );
                    const dest = [row.destination, row.program].filter(Boolean).join(" · ") || "—";
                    const needsAction = actionStudentIds.has(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={cn(needsAction && kpiFilter === "action" && "bg-amber-50/60")}
                      >
                        <td>
                          <div className="font-medium text-navy">{row.fullName}</div>
                          <div className="text-xs text-muted-foreground">{row.caseId}</div>
                          {needsAction ? (
                            <span className="mt-0.5 inline-block text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Attention
                            </span>
                          ) : null}
                        </td>
                        <td className="hidden max-w-[10rem] truncate text-xs text-muted-foreground md:table-cell">
                          {dest}
                        </td>
                        <td className="hidden lg:table-cell">
                          {row.assignmentStatus === "pending" ? (
                            <StatusBadge status="Pending" />
                          ) : (
                            <span className="text-sm">
                              {row.counsellorName || "Counsellor assigned"}
                            </span>
                          )}
                        </td>
                        <td className="text-xs">
                          {describePersistedSignupFeeStatus(row.signupFeeStatus).label}
                        </td>
                        <td className="hidden text-xs text-muted-foreground xl:table-cell">
                          {portalLabel}
                        </td>
                        <td className="hidden text-xs text-muted-foreground lg:table-cell">
                          {fmtDate(row.updatedAt)}
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                            <span className="max-w-[12rem] text-xs text-muted-foreground">
                              {next.label}
                            </span>
                            <Button
                              asChild
                              size="sm"
                              variant="navy"
                              className="shrink-0 self-start"
                            >
                              <Link
                                to="/staff/intake/$studentId"
                                params={{ studentId: row.id }}
                                {...(next.code === "assign_counsellor"
                                  ? { search: { focus: "assign" as const } }
                                  : {})}
                              >
                                {frontDeskNextActionCta(next.code)}
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
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
      </div>

      <div id="fd-fee-verification-panel">
        <Panel
          compact
          title="Signup fee coordination"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={feeReqQ.isFetching}
              onClick={() => void feeReqQ.refetch()}
            >
              {feeReqQ.isFetching ? "Refreshing…" : "Refresh"}
            </Button>
          }
        >
          <p className="mb-3 text-xs text-muted-foreground">
            Counsellor coordination requests only — not proof of payment. Finance verifies or waives
            on the fee ledger.
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
                  body={`${allRows.length} request${allRows.length === 1 ? "" : "s"} exist in other statuses. Switch tabs or open Front Desk tasks.`}
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
                  {awaitingCount > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTab("awaiting_finance")}
                    >
                      Awaiting Finance ({awaitingCount})
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
                                    ? "Follow up with counsellor"
                                    : "Send to Accounts when ready"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/staff/intake/$studentId"
                              params={{ studentId: row.studentId }}
                            >
                              Open record
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
