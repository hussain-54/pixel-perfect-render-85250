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
  ErrorState,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { LEAD_STATUSES } from "@/lib/lead-mappers";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";
import { getLeads, updateLeadStatus } from "@/services";

export const Route = createFileRoute("/staff/leads")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "digital_marketing"),
  component: StaffLeads,
});

function StaffLeads() {
  // Desk scoping is enforced server-side via the trusted session consultant id.
  const queryClient = useQueryClient();
  const leadsQ = useData(["leads"], getLeads);
  const rows = leadsQ.data ?? [];
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const statusM = useMutation({
    mutationFn: updateLeadStatus,
    onSuccess: async () => {
      setMsg("Lead status updated.");
      setErr(null);
      setBusyId(null);
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => {
      setMsg(null);
      setBusyId(null);
      setErr(portalErrorMessage(e, "Could not update lead status."));
    },
  });

  if (leadsQ.isLoading) {
    return (
      <PageLoadState title="Leads" subtitle="Prospects assigned to your desk.">
        <LoadingRows rows={6} />
      </PageLoadState>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader compact title="Leads" subtitle="Prospects assigned to your desk." />
      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      ) : null}
      {leadsQ.isError ? (
        <ErrorState body={portalErrorMessage(leadsQ.error)} />
      ) : !rows.length ? (
        <EmptyState title="No leads assigned" body="Try the admin leads view for all enquiries." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>Program</th>
              <th>Source</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="font-medium text-navy">{l.name}</td>
                <td>{l.country}</td>
                <td>{l.program}</td>
                <td>{l.source}</td>
                <td>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={l.status} />
                    <select
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={statusM.isPending && busyId === l.id}
                      value={l.status}
                      aria-label={`Status for ${l.name}`}
                      onChange={(e) => {
                        setBusyId(l.id);
                        setErr(null);
                        statusM.mutate({ leadId: l.id, status: e.target.value });
                      }}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
                <td>{fmtDate(l.created)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
