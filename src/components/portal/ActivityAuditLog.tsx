import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBase64File } from "@/lib/export-formats";
import type { BusinessRole } from "@/lib/business-permissions";
import { isAdmissionBusinessRole } from "@/lib/staff-business-access";
import { cn } from "@/lib/utils";
import { exportActivityLog, getActivityLog } from "@/services";
import { Route } from "@/routes/staff/route";
import {
  ACTIVITY_ACTION_TYPES,
  type ActivityActionFilter,
  type ActivityFilters,
  type ActivityTone,
} from "@/types/activity-ops";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy";

const toneClass: Record<ActivityTone, string> = {
  success: "border-success/40 bg-success-soft/40",
  danger: "border-danger/40 bg-danger-soft/40",
  info: "border-royal/30 bg-info-soft/40",
  warning: "border-warning/40 bg-warning-soft/40",
  neutral: "border-border bg-white",
};

const PAGE = 25;

export function ActivityAuditLog() {
  const { auth } = Route.useRouteContext() as {
    auth?: { businessRole?: BusinessRole | null } | null;
  };
  const isAdmission = isAdmissionBusinessRole(auth?.businessRole);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionType, setActionType] = useState<ActivityActionFilter>("all");
  const [studentId, setStudentId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filters = useMemo((): ActivityFilters => {
    const next: ActivityFilters = { actionType, offset: 0, limit };
    if (dateFrom) next.dateFrom = dateFrom;
    if (dateTo) next.dateTo = dateTo;
    if (studentId) next.studentId = studentId;
    if (applicationId) next.applicationId = applicationId;
    const trimmed = q.trim();
    if (trimmed) next.q = trimmed;
    return next;
  }, [dateFrom, dateTo, actionType, studentId, applicationId, q, limit]);

  const listQ = useQuery({
    queryKey: ["officer", "activity-log", filters],
    queryFn: () => getActivityLog(filters),
    staleTime: 10_000,
  });

  const exportM = useMutation({
    mutationFn: () => {
      const { offset: _o, limit: _l, ...rest } = filters;
      return exportActivityLog(rest);
    },
    onSuccess: (payload) => {
      downloadBase64File(payload.filename, payload.mimeType, payload.contentBase64);
    },
  });

  const resetPaging = () => setLimit(PAGE);
  const activityTitle = isAdmission ? "Admission Activity" : "Activity";
  const activitySubtitle = isAdmission
    ? "Append-only timeline for your Admission files — handovers, docs, offers, visa, and fees."
    : "Append-only timeline of actions across assigned student files.";

  if (listQ.isLoading && limit === PAGE) {
    return (
      <PageLoadState title={activityTitle} subtitle={activitySubtitle}>
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (listQ.isError) {
    const msg = portalErrorMessage(listQ.error);
    if (msg.toLowerCase().includes("permission") || String(listQ.error).includes("403")) {
      return (
        <PageLoadState title={activityTitle}>
          <PermissionDenied body={msg} />
        </PageLoadState>
      );
    }
    return (
      <PageLoadState title={activityTitle}>
        <ErrorState body={msg} />
      </PageLoadState>
    );
  }

  const data = listQ.data;
  if (!data) {
    return (
      <PageLoadState title={activityTitle}>
        <EmptyState title="No activity" />
      </PageLoadState>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        compact
        title={activityTitle}
        subtitle={activitySubtitle}
        actions={
          <Button
            size="sm"
            variant="navy"
            disabled={exportM.isPending}
            onClick={() => exportM.mutate()}
          >
            Export Activity Log
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Date from
          <Input
            type="date"
            className="mt-1"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              resetPaging();
            }}
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Date to
          <Input
            type="date"
            className="mt-1"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              resetPaging();
            }}
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Action type
          <select
            className={cn(selectClass, "mt-1")}
            value={actionType}
            onChange={(e) => {
              setActionType(e.target.value as ActivityActionFilter);
              resetPaging();
            }}
          >
            {ACTIVITY_ACTION_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Student
          <select
            className={cn(selectClass, "mt-1")}
            value={studentId}
            onChange={(e) => {
              setStudentId(e.target.value);
              setApplicationId("");
              resetPaging();
            }}
          >
            <option value="">All assigned</option>
            {data.filterOptions.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.caseId}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Application
          <select
            className={cn(selectClass, "mt-1")}
            value={applicationId}
            onChange={(e) => {
              setApplicationId(e.target.value);
              resetPaging();
            }}
          >
            <option value="">All applications</option>
            {data.filterOptions.applications
              .filter((a) => !studentId || a.studentId === studentId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <Input
        className="mb-4 max-w-xl"
        placeholder="Search activity..."
        aria-label="Search activity"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          resetPaging();
        }}
      />

      {exportM.isError ? (
        <div className="mb-4">
          <ErrorState body={portalErrorMessage(exportM.error, "Export failed.")} />
        </div>
      ) : null}

      <p className="mb-3 text-xs text-muted-foreground">
        Showing {data.groups.reduce((n, g) => n + g.items.length, 0)} of {data.total} events
        {data.immutable ? " · Append-only audit trail" : ""}
      </p>

      {!data.groups.length ? (
        <EmptyState title="No matching activity" body="Adjust filters or clear the search." />
      ) : (
        <div className="space-y-8">
          {data.groups.map((group) => (
            <section key={group.dayKey}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </h2>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.id} className={cn("rounded-md border p-4", toneClass[item.tone])}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-navy">{item.action}</p>
                      <time className="text-xs font-medium text-muted-foreground">
                        {new Date(item.createdAt).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Actor: {item.actorName} · Outcome: {item.outcome}
                    </p>
                    {item.detail ? (
                      <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {[
                          item.documentId ? `Document ID: ${item.documentId}` : null,
                          item.applicationId ? `Application ID: ${item.applicationId}` : null,
                          !item.documentId && !item.applicationId
                            ? `${item.entityType} ID: ${item.entityId}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {data.hasMore ? (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            disabled={listQ.isFetching}
            onClick={() => setLimit((l) => l + PAGE)}
          >
            Load More Activity History...
          </Button>
        </div>
      ) : null}
    </div>
  );
}
