import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  PageLoadState,
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
import type { Appointment } from "@/types";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

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

function StaffAppointments() {
  const queryClient = useQueryClient();
  // Desk scoping is enforced server-side via the trusted session consultant id.
  const apptsQ = useData(["appointments"], getAppointments);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const statusM = useMutation({
    mutationFn: async (input: { appointmentId: string; status: AppointmentStatusDbValue }) =>
      updateAppointmentStatus(input),
    onSuccess: async () => {
      setMessage("Appointment updated.");
      setActiveId(null);
      await queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (err) => {
      setMessage(portalErrorMessage(err, "Could not update appointment status."));
      setActiveId(null);
    },
  });

  const rows = [...(apptsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

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
        subtitle="Confirm, reschedule, or close consultation requests for your students."
      />
      {message ? (
        <p
          className={statusM.isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
          role="status"
        >
          {message}
        </p>
      ) : null}
      {!rows.length ? (
        <EmptyState title="No appointments" body="Student requests will appear here." />
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
