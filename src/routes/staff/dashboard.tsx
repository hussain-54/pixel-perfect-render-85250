import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileSearch, FolderKanban, Users } from "lucide-react";
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
import { useData } from "@/lib/useData";
import { getOfficerDashboard, reviewStudentDocument } from "@/services";
import { cn } from "@/lib/utils";
import { isFrontDeskBusinessRole, staffHomeForBusinessRole } from "@/lib/staff-business-access";
import { isSpecialtyOnlyBusinessRole } from "@/lib/specialty-desk-access";
import { workspaceTitleForSession } from "@/lib/workspace-branding";
import type { BusinessRole } from "@/lib/business-permissions";
import type { AppRole } from "@/lib/roles";

export const Route = createFileRoute("/staff/dashboard")({
  beforeLoad: ({ context }) => {
    const auth = (
      context as { auth?: { role?: AppRole; businessRole?: BusinessRole | null } }
    ).auth;
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
  const queryClient = useQueryClient();
  const dashQ = useData(["officer", "dashboard"], getOfficerDashboard);
  const workspaceTitle = workspaceTitleForSession({
    portal: "staff",
    businessRole: auth?.businessRole,
    appRole: auth?.role,
  });
  const [reviewError, setReviewError] = useState<string | null>(null);

  const reviewM = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "Approved" | "Rejected" }) =>
      reviewStudentDocument(id, action),
    onSuccess: async () => {
      setReviewError(null);
      await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
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
    return <ErrorState body={msg} />;
  }

  const data = dashQ.data;
  if (!data) return <EmptyState title="No dashboard data" body="No authorized records available." />;

  return (
    <div>
      <PageHeader
        title={`Good day, ${data.greetingName}`}
        subtitle={workspaceTitle}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assigned students"
          value={data.metrics.assignedStudents}
          icon={<Users />}
        />
        <StatCard
          label="Apps in progress"
          value={data.metrics.appsInProgress}
          icon={<FolderKanban />}
        />
        <StatCard
          label="Docs to review"
          value={data.metrics.docsToReview}
          icon={<FileSearch />}
        />
        <StatCard
          label="Deadlines this week"
          value={data.metrics.deadlinesThisWeek}
          icon={<CalendarClock />}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Today's Tasks"
          action={
            <Link to="/staff/activity" className="text-xs font-semibold text-royal hover:underline">
              All tasks »
            </Link>
          }
        >
          {!data.todaysTasks.length ? (
            <EmptyState title="No open tasks" body="You have no overdue or due tasks right now." />
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
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Assigned Students"
          action={
            <Link to="/staff/students" className="text-xs font-semibold text-royal hover:underline">
              All students »
            </Link>
          }
        >
          {!data.assignedOverview.length ? (
            <EmptyState
              title="No assigned students"
              body="Students appear here once they are assigned to you."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Dest.</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {data.assignedOverview.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        to="/staff/students/$studentId"
                        params={{ studentId: s.id }}
                        search={{ tab: "assessment" }}
                        className="font-medium text-navy hover:text-royal hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td>{s.destination}</td>
                    <td className="text-xs">{s.stageLabel}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Documents Waiting for Review">
          {reviewError ? <div className="mb-3"><ErrorState body={reviewError} /></div> : null}
          {!data.docsWaiting.length ? (
            <EmptyState title="Inbox clear" body="No documents awaiting your review." />
          ) : (
            <ul className="space-y-4">
              {data.docsWaiting.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 border-t border-border/70 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">
                      {d.studentName} · {d.category}
                    </p>
                    <p className="text-xs text-muted-foreground">Uploaded {fmtDate(d.uploaded)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="navy"
                      disabled={reviewM.isPending}
                      onClick={() => reviewM.mutate({ id: d.id, action: "Approved" })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewM.isPending}
                      onClick={() => reviewM.mutate({ id: d.id, action: "Rejected" })}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming Deadlines">
          {!data.upcomingDeadlines.length ? (
            <EmptyState
              title="No deadlines in the next 14 days"
              body="Application and offer deadlines for your students will show here."
            />
          ) : (
            <ul className="space-y-3">
              {data.upcomingDeadlines.map((d) => (
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
                    <p className={cn(d.daysLeft <= 3 ? "font-bold text-danger" : "text-muted-foreground")}>
                      {d.daysLeft === 0 ? "Today" : `${d.daysLeft} days left`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
