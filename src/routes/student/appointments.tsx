import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  ErrorState,
  LoadingRows,
  EmptyState,
  portalErrorMessage,
  Panel,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useData } from "@/lib/useData";
import {
  ALLOWED_DURATIONS_MINUTES,
  DEFAULT_DURATION_MINUTES,
} from "@/lib/appointment-booking-rules";
import {
  getCurrentStudent,
  getAppointments,
  lookupConsultant,
  requestAppointment,
} from "@/services";

export const Route = createFileRoute("/student/appointments")({
  component: StudentAppointments,
});

function StudentAppointments() {
  const queryClient = useQueryClient();
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const sid = studentQ.data?.id ?? "";
  const apptsQ = useData(["student", sid, "appts"], () =>
    sid ? getAppointments(sid) : Promise.resolve([]),
  );

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION_MINUTES);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const bookM = useMutation({
    mutationFn: async () =>
      requestAppointment({
        date,
        time,
        durationMinutes,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: async () => {
      setMessage("Appointment requested. Your consultant will confirm the slot.");
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["student", sid, "appts"] });
    },
    onError: (err) => {
      setMessage(portalErrorMessage(err, "Could not request the appointment."));
    },
  });

  if (studentQ.isLoading) return <LoadingRows rows={5} />;
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const rows = [...(apptsQ.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        title="Appointments"
        subtitle="Request a consultation slot. Times are stored in UTC; your consultant confirms."
      />

      <Panel title="Request appointment" className="mb-6">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            bookM.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="appt-date"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Date (UTC)
              </Label>
              <Input
                id="appt-date"
                type="date"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                required
                disabled={bookM.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="appt-time"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Time (UTC)
              </Label>
              <Input
                id="appt-time"
                type="time"
                value={time}
                onChange={(ev) => setTime(ev.target.value)}
                required
                disabled={bookM.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="appt-duration"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Duration
              </Label>
              <select
                id="appt-duration"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={durationMinutes}
                onChange={(ev) => setDurationMinutes(Number(ev.target.value))}
                disabled={bookM.isPending}
              >
                {ALLOWED_DURATIONS_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="appt-notes"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Notes (optional)
            </Label>
            <Textarea
              id="appt-notes"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              rows={3}
              maxLength={500}
              disabled={bookM.isPending}
              placeholder="What would you like to discuss?"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={bookM.isPending || !date || !time}>
              {bookM.isPending ? "Requesting…" : "Request appointment"}
            </Button>
            {message ? (
              <p
                className={
                  bookM.isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
                role="status"
              >
                {message}
              </p>
            ) : null}
          </div>
        </form>
      </Panel>

      {apptsQ.isLoading ? (
        <LoadingRows />
      ) : !rows.length ? (
        <EmptyState
          title="No appointments"
          body="Request a slot above. Confirmed consultations will appear here."
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Consultant</th>
              <th>Destination</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  {fmtDate(a.date)} · {a.time}
                </td>
                <td className="font-medium text-navy">{a.type}</td>
                <td>{a.consultantName ?? lookupConsultant(a.consultantId)?.name ?? "—"}</td>
                <td>{a.destination}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
