import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  PageLoadState,
  Panel,
  TableWrap,
  fmtDate,
  LoadingRows,
  EmptyState,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/useData";
import {
  staffAppointmentStatusActions,
  type AppointmentStatusDbValue,
} from "@/lib/appointment-status-rules";
import { getAppointments, lookupStudent, updateAppointmentStatus } from "@/services";
import type { Appointment, AppointmentStatus } from "@/types";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/appointments")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "counselling"),
  component: StaffAppointments,
});

const ACTION_LABEL: Record<AppointmentStatusDbValue, string> = {
  requested: "Request",
  confirmed: "Confirm",
  rescheduled: "Reschedule",
  completed: "Complete",
  cancelled: "Cancel",
  no_show: "No show",
};

type StatusFilter = "all" | AppointmentStatus | "today";

const STATUS_KPIS: { key: StatusFilter; label: string; match?: AppointmentStatus }[] = [
  { key: "today", label: "Today" },
  { key: "Requested", label: "Pending", match: "Requested" },
  { key: "Confirmed", label: "Confirmed", match: "Confirmed" },
  { key: "Rescheduled", label: "Rescheduled", match: "Rescheduled" },
  { key: "Completed", label: "Completed", match: "Completed" },
  { key: "Cancelled", label: "Cancelled", match: "Cancelled" },
  { key: "No Show", label: "No-shows", match: "No Show" },
];

function pktTodayYmd() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function StaffAppointments() {
  const queryClient = useQueryClient();
  useCounsellorWorkbenchRealtime(true);
  const apptsQ = useData(["appointments"], getAppointments);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const statusM = useMutation({
    mutationFn: async (input: { appointmentId: string; status: AppointmentStatusDbValue }) =>
      updateAppointmentStatus(input),
    onSuccess: async () => {
      setMessage("Appointment updated.");
      setActiveId(null);
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
      await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    },
    onError: (err) => {
      setMessage(portalErrorMessage(err, "Could not update appointment status."));
      setActiveId(null);
    },
  });

  const allRows = useMemo(
    () => [...(apptsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [apptsQ.data],
  );

  const todayYmd = pktTodayYmd();
  const counts = useMemo(() => {
    const next: Record<StatusFilter, number> = {
      all: allRows.length,
      today: 0,
      Requested: 0,
      Confirmed: 0,
      Rescheduled: 0,
      Completed: 0,
      Cancelled: 0,
      "No Show": 0,
    };
    for (const a of allRows) {
      if (a.date === todayYmd) next.today += 1;
      next[a.status] += 1;
    }
    return next;
  }, [allRows, todayYmd]);

  const rows = useMemo(() => {
    if (filter === "all") return allRows;
    if (filter === "today") return allRows.filter((a) => a.date === todayYmd);
    return allRows.filter((a) => a.status === filter);
  }, [allRows, filter, todayYmd]);

  const todayRows = useMemo(
    () => allRows.filter((a) => a.date === todayYmd).slice(0, 8),
    [allRows, todayYmd],
  );

  if (apptsQ.isLoading) {
    return (
      <PageLoadState
        title="Appointments"
        subtitle="Confirm, reschedule, or close consultation requests."
      >
        <LoadingRows rows={6} />
      </PageLoadState>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        compact
        title="Appointments"
        subtitle="Confirm, reschedule, or close consultation requests for your students. Times shown in Pakistan local date."
        actions={
          filter !== "all" ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setFilter("all")}>
              Clear filter
            </Button>
          ) : null
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {STATUS_KPIS.map((item) => {
          const value = counts[item.key] ?? 0;
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(active ? "all" : item.key)}
              className={cn(
                "rounded-xl border bg-white px-3 py-3 text-left transition-colors",
                active
                  ? "border-royal ring-2 ring-royal/30"
                  : "border-border hover:border-royal/40",
              )}
            >
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <b className="mt-1 block text-2xl font-semibold text-navy">{value}</b>
            </button>
          );
        })}
      </div>

      {message ? (
        <p
          className={statusM.isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          role="status"
        >
          {message}
        </p>
      ) : null}

      {filter === "all" && todayRows.length > 0 ? (
        <Panel
          compact
          title="Today's appointments"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => setFilter("today")}>
              View all today
            </Button>
          }
        >
          <ul className="divide-y divide-border">
            {todayRows.map((a) => (
              <li
                key={`today-${a.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">
                    {a.studentName ?? lookupStudent(a.studentId)?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.time} · {a.type} · {a.status}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {!rows.length ? (
        <EmptyState
          title={filter === "all" ? "No appointments" : "No matching appointments"}
          body={
            filter === "all"
              ? "Student requests will appear here."
              : "Clear the filter to see the full desk list."
          }
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Type</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <AppointmentRow
                key={a.id}
                appointment={a}
                busy={statusM.isPending && activeId === a.id}
                disabled={statusM.isPending}
                onAction={(status) => {
                  setMessage(null);
                  setActiveId(a.id);
                  statusM.mutate({ appointmentId: a.id, status });
                }}
              />
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}

function AppointmentRow({
  appointment: a,
  busy,
  disabled,
  onAction,
}: {
  appointment: Appointment;
  busy: boolean;
  disabled: boolean;
  onAction: (status: AppointmentStatusDbValue) => void;
}) {
  const actions = staffAppointmentStatusActions(a.status);
  return (
    <tr>
      <td>
        {fmtDate(a.date)} · {a.time}
      </td>
      <td className="font-medium text-navy">
        {a.studentName ?? lookupStudent(a.studentId)?.name ?? "—"}
      </td>
      <td>{a.type}</td>
      <td>
        <StatusBadge status={a.status} />
      </td>
      <td className="max-w-xs text-sm text-muted-foreground">{a.notes ?? "—"}</td>
      <td>
        {actions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={status === "cancelled" || status === "no_show" ? "outline" : "default"}
                disabled={disabled}
                onClick={() => onAction(status)}
              >
                {busy && status === "confirmed" ? "…" : ACTION_LABEL[status]}
              </Button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
