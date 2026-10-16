import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
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
import {
  assignLead,
  getLeads,
  listLeadAssigneeOptions,
  lookupConsultant,
  updateLeadStatus,
} from "@/services";

export const Route = createFileRoute("/admin/leads")({
  component: AdminLeads,
});

function AdminLeads() {
  const queryClient = useQueryClient();
  const leadsQ = useData(["leads"], getLeads);
  const assigneesQ = useQuery({
    queryKey: ["leads", "assignees"],
    queryFn: listLeadAssigneeOptions,
    staleTime: 60_000,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const assignM = useMutation({
    mutationFn: assignLead,
    onSuccess: async () => {
      setMsg("Lead assignment saved.");
      setErr(null);
      setBusyId(null);
      await queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => {
      setMsg(null);
      setBusyId(null);
      setErr(portalErrorMessage(e, "Could not assign lead."));
    },
  });

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

  const pending = assignM.isPending || statusM.isPending;

  return (
    <div>
      <PageHeader title="Leads" subtitle="Public consultation enquiries and assigned prospects." />
      {msg ? (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {err}
        </p>
      ) : null}
      {leadsQ.isLoading ? (
        <LoadingRows />
      ) : leadsQ.isError ? (
        <ErrorState body={portalErrorMessage(leadsQ.error)} />
      ) : !leadsQ.data?.length ? (
        <EmptyState title="No leads" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Country</th>
              <th>Program</th>
              <th>Source</th>
              <th>Consultant</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {leadsQ.data.map((l) => (
              <tr key={l.id}>
                <td className="max-w-[7rem] truncate font-mono text-xs">{l.id}</td>
                <td className="font-medium text-navy">{l.name}</td>
                <td>{l.country}</td>
                <td>{l.program}</td>
                <td>{l.source}</td>
                <td>
                  <select
                    className="max-w-[11rem] rounded border border-border bg-background px-2 py-1 text-xs"
                    disabled={pending && busyId === l.id}
                    value={l.consultantId ?? ""}
                    aria-label={`Assign consultant for ${l.name}`}
                    onChange={(e) => {
                      const next = e.target.value;
                      setBusyId(l.id);
                      setErr(null);
                      assignM.mutate({
                        leadId: l.id,
                        consultantId: next === "" ? null : next,
                      });
                    }}
                  >
                    <option value="">Unassigned</option>
                    {(assigneesQ.data ?? []).map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                    {l.consultantId &&
                    !(assigneesQ.data ?? []).some((o) => o.id === l.consultantId) ? (
                      <option value={l.consultantId}>
                        {lookupConsultant(l.consultantId)?.name ??
                          `Assigned (${l.consultantId.slice(0, 8)})`}
                      </option>
                    ) : null}
                  </select>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={l.status} />
                    <select
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={pending && busyId === l.id}
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
