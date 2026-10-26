import { useState } from "react";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  ClipboardCheck,
  Clock3,
  FileWarning,
  FolderKanban,
  Hourglass,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";
import {
  PageHeader,
  Panel,
  StatCard,
  TableWrap,
  fmtDate,
  LoadingRows,
  ErrorState,
  EmptyState,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useData } from "@/lib/useData";
import {
  getNotifications,
  getOfficerDashboard,
  markNotificationRead,
  reviewStudentDocument,
} from "@/services";
import { cn } from "@/lib/utils";
import {
  isAdmissionBusinessRole,
  isFrontDeskBusinessRole,
  staffHomeForBusinessRole,
} from "@/lib/staff-business-access";
import { isSpecialtyOnlyBusinessRole } from "@/lib/specialty-desk-access";
import { workspaceTitleForSession } from "@/lib/workspace-branding";
import {
  COUNSELLOR_METRIC_DEFINITIONS,
  COUNSELLOR_METRIC_HINTS,
  attentionKindLabel,
  attentionUrgencyLabel,
  resolveCounsellorNotificationHref,
} from "@/lib/counsellor-workspace";
import {
  ADMISSION_METRIC_DEFINITIONS,
  ADMISSION_METRIC_HINTS,
  resolveAdmissionNotificationHref,
} from "@/lib/admission-workspace";
import type { ProfileTabId } from "@/types/student-profile";
import { shouldOfferMarkAsRead } from "@/lib/notification-rules";
import {
  COUNSELLOR_DASHBOARD_KEY,
  useCounsellorWorkbenchRealtime,
} from "@/lib/use-counsellor-workbench-realtime";
import type { BusinessRole } from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";

export const Route = createFileRoute("/staff/dashboard")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { role?: AppRole; businessRole?: BusinessRole | null } })
      .auth;
    if (isFrontDeskBusinessRole(auth?.businessRole)) {
      throw redirect({ to: "/staff/front-desk" });
    }
    if (isSpecialtyOnlyBusinessRole(auth?.businessRole)) {
      throw redirect({
        href: staffHomeForBusinessRole(auth?.role ?? "consultant", auth?.businessRole),
      });
    }
  },
  component: StaffDashboard,
});

function StaffDashboard() {
  const { auth } = Route.useRouteContext() as {
    auth?: { businessRole?: BusinessRole | null; role?: AppRole };
  };
  const router = useRouter();
  const queryClient = useQueryClient();
  const dashQ = useData([...COUNSELLOR_DASHBOARD_KEY], getOfficerDashboard);
  const liveStatus = useCounsellorWorkbenchRealtime(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const notifQ = useQuery({
    queryKey: ["notifications", "staff"],
    queryFn: () => getNotifications("staff"),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const workspaceTitle = workspaceTitleForSession({
    portal: "staff",
    businessRole: auth?.businessRole,
    appRole: auth?.role,
  });

  const isAdmission =
    isAdmissionBusinessRole(auth?.businessRole) || dashQ.data?.workbenchKind === "admission";

  const markM = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications", "staff"] });
    },
  });

  const reviewM = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "Approved" | "Rejected" }) =>
      reviewStudentDocument(id, action),
    onSuccess: async () => {
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: [...COUNSELLOR_DASHBOARD_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["officer", "documents-queue"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err) => setReviewError(portalErrorMessage(err, "Review failed.")),
  });

  if (dashQ.isLoading) return <LoadingRows rows={8} />;

  if (dashQ.isError) {
    const msg = portalErrorMessage(dashQ.error);
    if (msg.toLowerCase().includes("permission") || String(dashQ.error).includes("403")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} onRetry={() => void dashQ.refetch()} />;
  }

  const data = dashQ.data;
  if (!data)
    return <EmptyState title="No dashboard data" body="No authorized records available." />;

  const unreadCount = (notifQ.data ?? []).filter((n) => !n.read).length;
  const lastSync = data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString() : null;
  const m = data.metrics;
  const am = data.admissionMetrics;

  async function openNotification(n: {
    id: string;
    read: boolean;
    linkPath?: string | null;
    studentId?: string | null;
  }) {
    const href = isAdmission
      ? resolveAdmissionNotificationHref({
          linkPath: n.linkPath,
          studentId: n.studentId,
        })
      : resolveCounsellorNotificationHref({
          linkPath: n.linkPath,
          studentId: n.studentId,
        });
    if (shouldOfferMarkAsRead(n) && !n.read) {
      try {
        await markM.mutateAsync(n.id);
      } catch {
        // Best-effort mark-read.
      }
    }
    setNotifOpen(false);
    void router.navigate({ to: href });
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <PageHeader
        title={isAdmission ? "Admissions Workbench" : "Counsellor Workbench"}
        subtitle={`${workspaceTitle} · Signed in as ${data.greetingName}`}
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
            {isAdmission ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link to="/staff/applications">Applications</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/staff/documents">Documents</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link to="/staff/students">My Students</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/staff/tasks">Tasks</Link>
                </Button>
              </>
            )}
          </div>
        }
      />

      {isAdmission && am ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Assigned to Me"
            value={String(am.assignedToMe)}
            hint={ADMISSION_METRIC_HINTS.assignedToMe}
            title={ADMISSION_METRIC_DEFINITIONS.assignedToMe}
            icon={<Users />}
          />
          <StatCard
            label="Awaiting Initial Review"
            value={String(am.awaitingInitialReview)}
            hint={ADMISSION_METRIC_HINTS.awaitingInitialReview}
            title={ADMISSION_METRIC_DEFINITIONS.awaitingInitialReview}
            icon={<Hourglass />}
          />
          <StatCard
            label="Documents Missing"
            value={String(am.documentsMissing)}
            hint={ADMISSION_METRIC_HINTS.documentsMissing}
            title={ADMISSION_METRIC_DEFINITIONS.documentsMissing}
            icon={<FileWarning />}
          />
          <StatCard
            label="In Progress"
            value={String(am.inProgress)}
            hint={ADMISSION_METRIC_HINTS.inProgress}
            title={ADMISSION_METRIC_DEFINITIONS.inProgress}
            icon={<FolderKanban />}
          />
          <StatCard
            label="Returned for Correction"
            value={String(am.returnedForCorrection)}
            hint={ADMISSION_METRIC_HINTS.returnedForCorrection}
            title={ADMISSION_METRIC_DEFINITIONS.returnedForCorrection}
            icon={<RotateCcw />}
          />
          <StatCard
            label="Submitted to University"
            value={String(am.submittedToUniversity)}
            hint={ADMISSION_METRIC_HINTS.submittedToUniversity}
            title={ADMISSION_METRIC_DEFINITIONS.submittedToUniversity}
            icon={<Send />}
          />
          <StatCard
            label="Offers / Decisions"
            value={String(am.offersDecisionsReceived)}
            hint={ADMISSION_METRIC_HINTS.offersDecisionsReceived}
            title={ADMISSION_METRIC_DEFINITIONS.offersDecisionsReceived}
            icon={<ClipboardCheck />}
          />
          <StatCard
            label="Action Required"
            value={String(am.actionRequired)}
            hint={ADMISSION_METRIC_HINTS.actionRequired}
            title={ADMISSION_METRIC_DEFINITIONS.actionRequired}
            icon={<AlertCircle />}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="My Assigned Students"
            value={String(m.assignedStudents)}
            hint={COUNSELLOR_METRIC_HINTS.assignedStudents}
            title={COUNSELLOR_METRIC_DEFINITIONS.assignedStudents}
            icon={<Users />}
          />
          <StatCard
            label="Counselling Completed"
            value={String(m.counsellingCompleted ?? 0)}
            hint={COUNSELLOR_METRIC_HINTS.counsellingCompleted}
            title={COUNSELLOR_METRIC_DEFINITIONS.counsellingCompleted}
            icon={<ClipboardCheck />}
          />
          <StatCard
            label="Follow-ups Due"
            value={String(m.followUpsDue ?? 0)}
            hint={COUNSELLOR_METRIC_HINTS.followUpsDue}
            title={COUNSELLOR_METRIC_DEFINITIONS.followUpsDue}
            icon={<Clock3 />}
          />
          <StatCard
            label="Applications In Progress"
            value={String(m.appsInProgress)}
            hint={COUNSELLOR_METRIC_HINTS.applicationsInProgress}
            title={COUNSELLOR_METRIC_DEFINITIONS.applicationsInProgress}
            icon={<FolderKanban />}
          />
          <StatCard
            label="Awaiting Response"
            value={String(m.awaitingResponse ?? 0)}
            hint={COUNSELLOR_METRIC_HINTS.awaitingResponse}
            title={COUNSELLOR_METRIC_DEFINITIONS.awaitingResponse}
            icon={<Hourglass />}
          />
          <StatCard
            label="Action Required"
            value={String(m.actionRequired ?? 0)}
            hint={COUNSELLOR_METRIC_HINTS.actionRequired}
            title={COUNSELLOR_METRIC_DEFINITIONS.actionRequired}
            icon={<AlertCircle />}
          />
        </div>
      )}

      <Panel
        title="Needs My Attention"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!isAdmission && (m.actionRequired ?? 0) > (data.needsAttention ?? []).length ? (
              <span className="text-xs text-navy/65">
                Showing {(data.needsAttention ?? []).length} of {m.actionRequired}
              </span>
            ) : null}
            {isAdmission && (am?.actionRequired ?? 0) > (data.needsAttention ?? []).length ? (
              <span className="text-xs text-navy/65">
                Showing {(data.needsAttention ?? []).length} of {am?.actionRequired}
              </span>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link to={isAdmission ? "/staff/applications" : "/staff/students"}>
                {isAdmission ? "Open applications" : "Open directory"}
              </Link>
            </Button>
          </div>
        }
      >
        {(data.needsAttention ?? []).length === 0 ? (
          <EmptyState
            title="Nothing needs attention"
            body={
              isAdmission
                ? "Handovers awaiting review, document gaps, and approaching deadlines will appear here."
                : "Lifecycle steps, returned cases, due tasks, and pending documents will appear here."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {(data.needsAttention ?? []).map((item) => {
              const tab = (item.profileTab ?? "assessment") as ProfileTabId;
              const actionLabel = item.primaryActionLabel ?? "Open record";
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-navy">
                      {item.fullName}{" "}
                      <span className="font-normal text-navy/60">· {item.caseId}</span>
                    </p>
                    <p className="text-sm font-medium text-navy/90">{item.title}</p>
                    <p className="text-sm leading-snug text-navy/65 line-clamp-2">{item.detail}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-xs text-navy/55">
                      <span>{attentionKindLabel(item.kind)}</span>
                      {item.urgencyGroup ? (
                        <span>{attentionUrgencyLabel(item.urgencyGroup)}</span>
                      ) : null}
                      {item.workflowStatus ? <span>Status: {item.workflowStatus}</span> : null}
                      {item.nextResponsibleRole ? (
                        <span>Next: {item.nextResponsibleRole}</span>
                      ) : null}
                      {item.at ? <span>Updated {fmtDate(item.at.slice(0, 10))}</span> : null}
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="navy"
                    className="shrink-0 self-start sm:mt-0.5"
                  >
                    {isAdmission ? (
                      <Link to="/staff/applications">{actionLabel}</Link>
                    ) : (
                      <Link
                        to="/staff/students/$studentId"
                        params={{ studentId: item.studentId }}
                        search={{ tab }}
                      >
                        {actionLabel}
                      </Link>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title={isAdmission ? "Recent Application Activity" : "Recent Student Activity"}
          action={
            <Link
              to={isAdmission ? "/staff/applications" : "/staff/students"}
              className="text-xs font-semibold text-royal hover:underline"
            >
              {isAdmission ? "All applications »" : "All students »"}
            </Link>
          }
        >
          {(data.recentActivity ?? data.assignedOverview).length === 0 ? (
            <EmptyState
              title={isAdmission ? "No applications yet" : "No assigned students"}
              body={
                isAdmission
                  ? "Applications appear after counsellor handover acceptance or when you create a pipeline row."
                  : "Students appear here once Front Desk assigns them to your desk."
              }
            />
          ) : (
            <TableWrap compact>
              <thead>
                <tr>
                  <th>{isAdmission ? "Student / destination" : "Student"}</th>
                  <th className="hidden md:table-cell">{isAdmission ? "App stage" : "Stage"}</th>
                  <th>Next</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {(data.recentActivity ?? data.assignedOverview).map((s) => (
                  <tr key={`${s.id}-${s.destination}`}>
                    <td>
                      <div className="font-medium text-navy">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.caseId ?? s.destination}
                        {s.lastActivity ? ` · ${fmtDate(s.lastActivity.slice(0, 10))}` : ""}
                      </div>
                    </td>
                    <td className="hidden text-xs md:table-cell">{s.stageLabel}</td>
                    <td className="max-w-[12rem] text-xs text-muted-foreground">
                      {s.nextActionLabel ?? "—"}
                    </td>
                    <td>
                      <Button asChild size="sm" variant="outline">
                        {isAdmission ? (
                          <Link to="/staff/applications">Open</Link>
                        ) : (
                          <Link
                            to="/staff/students/$studentId"
                            params={{ studentId: s.id }}
                            search={{ tab: "assessment" }}
                          >
                            View record
                          </Link>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel
          title={isAdmission ? "Upcoming Deadlines" : "Follow-ups Due"}
          action={
            isAdmission ? (
              <Link
                to="/staff/applications"
                className="text-xs font-semibold text-royal hover:underline"
              >
                Applications »
              </Link>
            ) : (
              <Link to="/staff/tasks" className="text-xs font-semibold text-royal hover:underline">
                All tasks »
              </Link>
            )
          }
        >
          {isAdmission ? (
            !data.upcomingDeadlines.length ? (
              <EmptyState
                title="No upcoming deadlines"
                body="Application deadlines within two weeks appear here."
              />
            ) : (
              <ul className="space-y-3">
                {data.upcomingDeadlines.slice(0, 8).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 first:border-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.studentName}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-navy">{fmtDate(d.deadline)}</p>
                      <p
                        className={cn(
                          d.daysLeft <= 3 ? "font-bold text-danger" : "text-muted-foreground",
                        )}
                      >
                        {d.daysLeft === 0 ? "Today" : `${d.daysLeft} days left`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : !data.todaysTasks.length ? (
            <EmptyState
              title="No open tasks"
              body="Overdue and due tasks for your desk appear here."
            />
          ) : (
            <ul className="space-y-3">
              {data.todaysTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start justify-between gap-3 border-t border-border/70 pt-3 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-semibold text-navy",
                        t.priority === "overdue" && "font-bold text-danger",
                      )}
                    >
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.studentName ?? "General"}
                      {" · "}
                      {t.priority === "overdue"
                        ? "Overdue"
                        : t.priority === "due_today"
                          ? "Due today"
                          : fmtDate(t.dueAt.slice(0, 10))}
                    </p>
                  </div>
                  {t.studentId ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link
                        to="/staff/students/$studentId"
                        params={{ studentId: t.studentId }}
                        search={{ tab: "overview" }}
                      >
                        Open
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {(data.docsWaiting.length > 0 || (!isAdmission && data.upcomingDeadlines.length > 0)) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.docsWaiting.length > 0 ? (
            <Panel
              title="Documents to review"
              action={
                <Link
                  to="/staff/documents"
                  className="text-xs font-semibold text-royal hover:underline"
                >
                  Documents »
                </Link>
              }
            >
              {reviewError ? (
                <div className="mb-3">
                  <ErrorState body={reviewError} />
                </div>
              ) : null}
              <ul className="space-y-3">
                {data.docsWaiting.slice(0, 5).map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-2 border-t border-border/70 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">
                        {d.studentName} · {d.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {fmtDate(d.uploaded)} · {d.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: d.studentId }}
                          search={{ tab: "documents" }}
                        >
                          Review
                        </Link>
                      </Button>
                      {!isAdmission ? (
                        <Button
                          size="sm"
                          variant="navy"
                          disabled={reviewM.isPending}
                          onClick={() => reviewM.mutate({ id: d.id, action: "Approved" })}
                        >
                          Approve
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {!isAdmission && data.upcomingDeadlines.length > 0 ? (
            <Panel title="Upcoming deadlines">
              <ul className="space-y-3">
                {data.upcomingDeadlines.slice(0, 5).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 first:border-0 first:pt-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.studentName}</p>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-navy">{fmtDate(d.deadline)}</p>
                      <p
                        className={cn(
                          d.daysLeft <= 3 ? "font-bold text-danger" : "text-muted-foreground",
                        )}
                      >
                        {d.daysLeft === 0 ? "Today" : `${d.daysLeft} days left`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      )}

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
                body={
                  isAdmission
                    ? "Handover, document, and decision alerts for your account appear here."
                    : "Assignment, fee, Admission, and document alerts for your account appear here."
                }
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
                        <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{n.body}</p>
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
      : status === "connecting"
        ? "Connecting"
        : status === "reconnecting"
          ? "Reconnecting"
          : "Offline";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide",
        status === "live"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : status === "offline"
            ? "border-slate-200 bg-slate-100 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-800",
      )}
      title={
        lastSync
          ? `Data synced ${lastSync}. Badge reflects subscription health, not payload trust.`
          : "Reflects Realtime subscription health"
      }
      aria-live="polite"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "live"
            ? "bg-emerald-600"
            : status === "offline"
              ? "bg-slate-400"
              : "bg-amber-500",
        )}
        aria-hidden
      />
      {label}
      {lastSync && status === "live" ? (
        <span className="font-normal normal-case tracking-normal text-emerald-700/80">
          · {lastSync}
        </span>
      ) : null}
      {lastSync && status === "offline" ? (
        <span className="font-normal normal-case tracking-normal text-slate-500">
          · synced {lastSync}
        </span>
      ) : null}
    </span>
  );
}
