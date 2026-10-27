import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, FileWarning, GraduationCap } from "lucide-react";
import { JourneyTracker } from "@/components/JourneyTracker";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionRequiredBanner, filterActionRequired } from "@/components/portal/ActionRequiredDocs";
import {
  PageHeader,
  PageLoadState,
  Panel,
  StatCard,
  TableWrap,
  fmtDate,
  EmptyState,
  ErrorState,
  LoadingRows,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/useData";
import {
  studentFacingFeeHint,
  studentFacingFeeLabel,
  studentProfileCompletion,
} from "@/lib/student-portal-account";
import {
  buildStudentNextActions,
  isStudentActionableDocStatus,
  studentApplicationNextAction,
  studentApplicationStageExplain,
} from "@/lib/student-portal-workspace";
import { cn } from "@/lib/utils";
import {
  getCurrentStudent,
  getAppointments,
  getDocuments,
  getApplications,
  getStudentJourneyTimeline,
  getSignupFeeStatus,
  getNotifications,
  lookupConsultant,
} from "@/services";

export const Route = createFileRoute("/student/dashboard")({
  component: StudentDashboard,
});

function StudentDashboard() {
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const studentId = studentQ.data?.id;

  const sid = studentId ?? "";
  const apptsQ = useData(["student", sid, "appts"], () =>
    sid ? getAppointments(sid) : Promise.resolve([]),
  );
  const docsQ = useData(["student", sid, "docs"], () =>
    sid ? getDocuments(sid) : Promise.resolve([]),
  );
  const appsQ = useData(["student", sid, "apps"], () =>
    sid ? getApplications(sid) : Promise.resolve([]),
  );
  const timelineQ = useData(["student", sid, "timeline"], () =>
    sid ? getStudentJourneyTimeline() : Promise.resolve(null),
  );
  const feeQ = useData(["student", sid, "signup-fee"], () =>
    sid ? getSignupFeeStatus(sid) : Promise.resolve(null),
  );
  const notifQ = useQuery({
    queryKey: ["notifications", "student"],
    queryFn: () => getNotifications("student"),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  if (studentQ.isLoading) {
    return (
      <PageLoadState title="Student dashboard">
        <LoadingRows rows={6} />
      </PageLoadState>
    );
  }
  if (studentQ.isError) {
    return (
      <PageLoadState title="Student dashboard">
        <ErrorState
          body="Could not load your student profile."
          onRetry={() => void studentQ.refetch()}
        />
      </PageLoadState>
    );
  }
  if (!studentQ.data) {
    return (
      <PageLoadState title="Student dashboard">
        <EmptyState
          title="Profile not found"
          body="No student profile is linked to this account. Ask Front Desk to register you, or claim your record if you already have one."
        />
      </PageLoadState>
    );
  }

  const student = studentQ.data;
  const profile = studentProfileCompletion(student);
  const feeLabel = studentFacingFeeLabel(feeQ.data?.fee?.status);
  const consultantName =
    student.consultantName ?? lookupConsultant(student.consultantId)?.name ?? null;
  const consultantRole = lookupConsultant(student.consultantId)?.role;
  const docs = docsQ.data ?? [];
  const actionDocs = filterActionRequired(docs);
  const actionableDocCount = docs.filter((d) =>
    isStudentActionableDocStatus(d.status, d.awaitingUpload),
  ).length;
  const upcoming = (apptsQ.data ?? [])
    .filter((a) => a.status === "Confirmed" || a.status === "Requested")
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const apps = appsQ.data ?? [];
  const timeline = timelineQ.data;
  const appsDocsPending = apps.filter((a) => a.status === "Docs Pending").length;
  const unread = (notifQ.data ?? []).filter((n) => !n.read).length;
  const recentNotifs = (notifQ.data ?? []).slice(0, 4);

  const nextActions = buildStudentNextActions({
    profilePercent: profile.percent,
    feeStatus: feeQ.data?.fee?.status,
    portalActivated: Boolean(feeQ.data?.fee?.portalActivatedAt),
    docsNeedingAction: Math.max(actionDocs.length, actionableDocCount),
    appsDocsPending,
    hasCounsellor: Boolean(student.consultantId),
    hasUpcomingAppointment: Boolean(upcoming),
    pendingTimelineCount: timeline?.pendingActions?.length ?? 0,
  });

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        compact
        title={`Hello, ${student.name.split(" ")[0]}`}
        subtitle={`${student.caseId}${student.destination ? ` · ${student.destination}` : ""}${student.program ? ` · ${student.program}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/student/notifications">
                Alerts{unread > 0 ? ` (${unread > 99 ? "99+" : unread})` : ""}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/student/documents">Documents</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Profile"
          value={`${profile.percent}%`}
          hint={`${profile.done} of ${profile.total} details filled`}
        />
        <StatCard
          label="Signup fee"
          value={feeQ.isLoading ? "…" : feeQ.isError ? "Unavailable" : feeLabel}
          hint={studentFacingFeeHint(
            feeQ.data?.fee?.status,
            Boolean(feeQ.data?.fee?.portalActivatedAt),
          )}
        />
        <StatCard
          label="Counsellor"
          value={consultantName?.split(" ")[0] ?? "Not assigned"}
          {...(consultantRole ? { hint: consultantRole } : { hint: "Assigned by Front Desk" })}
        />
        <StatCard
          label="Applications"
          value={apps.length}
          hint="Universities in your pipeline"
          icon={<GraduationCap />}
        />
      </div>

      {/* Banner owns urgent doc correction list — omit duplicate “docs” row from next actions. */}
      <ActionRequiredBanner docs={docs} uploadLink="/student/documents" />

      <Panel
        compact
        title="What you need to do next"
        action={
          <Link
            to="/student/documents"
            className="text-xs font-semibold text-royal hover:underline"
          >
            Documents »
          </Link>
        }
      >
        {(() => {
          const hasDocBanner = filterActionRequired(docs).length > 0;
          const items = hasDocBanner ? nextActions.filter((a) => a.id !== "docs") : nextActions;
          if (items.length === 0) {
            return (
              <EmptyState
                title="You're up to date"
                body="When staff request documents or updates, they will appear here."
              />
            );
          }
          return (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="navy"
                    className="shrink-0 self-start sm:self-center"
                  >
                    <Link to={item.href}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          );
        })()}
      </Panel>

      <div>
        <JourneyTracker
          stage={student.stage}
          {...(timeline?.items ? { timelineItems: timeline.items } : {})}
          {...(timeline?.pendingActions ? { pendingActions: timeline.pendingActions } : {})}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          compact
          title="Application snapshot"
          action={
            <Link
              to="/student/applications"
              className="text-xs font-semibold text-royal hover:underline"
            >
              All applications »
            </Link>
          }
        >
          {appsQ.isLoading ? (
            <LoadingRows rows={2} />
          ) : appsQ.isError ? (
            <ErrorState body="Could not load applications." onRetry={() => void appsQ.refetch()} />
          ) : apps.length ? (
            <TableWrap compact>
              <thead>
                <tr>
                  <th>University</th>
                  <th>Status</th>
                  <th className="hidden md:table-cell">Next</th>
                </tr>
              </thead>
              <tbody>
                {apps.slice(0, 4).map((a) => (
                  <tr key={a.id}>
                    <td>
                      <p className="font-medium text-navy">{a.university}</p>
                      <p className="text-xs text-muted-foreground">{a.program}</p>
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                      <p className="mt-1 max-w-[10rem] text-[11px] text-muted-foreground md:hidden">
                        {studentApplicationStageExplain(a.status)}
                      </p>
                    </td>
                    <td className="hidden max-w-[12rem] text-xs text-muted-foreground md:table-cell">
                      {studentApplicationNextAction(a.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No applications yet"
              body="Applications appear after your counsellor and Admission Team open a university file for you."
            />
          )}
        </Panel>

        <Panel
          compact
          title="Next appointment"
          action={
            <Link
              to="/student/appointments"
              className="text-xs font-semibold text-royal hover:underline"
            >
              Appointments »
            </Link>
          }
        >
          {apptsQ.isLoading ? (
            <LoadingRows rows={2} />
          ) : upcoming ? (
            <div className="space-y-2">
              <p className="font-semibold text-navy">{upcoming.type}</p>
              <p className="text-sm text-muted-foreground">
                {fmtDate(upcoming.date)} at {upcoming.time}
              </p>
              <p className="text-sm">
                {upcoming.consultantName ?? lookupConsultant(upcoming.consultantId)?.name ?? "—"}
              </p>
              <StatusBadge status={upcoming.status} />
            </div>
          ) : (
            <EmptyState
              title="No upcoming appointments"
              body="You can request a counselling slot from Appointments when a counsellor is assigned."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="Documents needing attention"
          action={
            <Link
              to="/student/documents"
              className="text-xs font-semibold text-royal hover:underline"
            >
              All documents »
            </Link>
          }
        >
          {docsQ.isLoading ? (
            <LoadingRows rows={2} />
          ) : actionDocs.length === 0 ? (
            <EmptyState
              title="No document actions"
              body="Rejected or correction requests will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {actionDocs.slice(0, 5).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">{d.name || d.category}</p>
                    <p className="text-xs text-muted-foreground">{d.status}</p>
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Recent notifications"
          action={
            <Link
              to="/student/notifications"
              className="text-xs font-semibold text-royal hover:underline"
            >
              Inbox »
            </Link>
          }
        >
          {notifQ.isLoading ? (
            <LoadingRows rows={2} />
          ) : notifQ.isError ? (
            <ErrorState
              body="Could not load notifications."
              onRetry={() => void notifQ.refetch()}
            />
          ) : recentNotifs.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              body="Fee, document, and application updates for your account appear here."
            />
          ) : (
            <ul className="space-y-3">
              {recentNotifs.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "border-t border-border/70 pt-3 first:border-0 first:pt-0",
                    !n.read && "pl-2 border-l-2 border-l-royal",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-navy">{n.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
                  </div>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Action required"
          value={Math.max(actionDocs.length, actionableDocCount)}
          hint="Documents to fix or re-upload"
          icon={<FileWarning />}
        />
        <StatCard
          label="Documents on file"
          value={docs.length}
          hint="Requirement rows linked to your case"
          icon={<FileWarning />}
        />
        <StatCard
          label="Unread alerts"
          value={unread}
          hint="Open the notifications inbox"
          icon={<Calendar />}
        />
      </div>
    </div>
  );
}
