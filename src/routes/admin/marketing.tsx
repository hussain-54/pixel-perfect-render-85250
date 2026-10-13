import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveMarketingCampaign,
  attributeInquiryToCampaign,
  getMarketingOverview,
  listAttributionHistory,
  upsertMarketingCampaign,
} from "@/services";
import { formatMetricValue, type MarketingCampaignStatus } from "@/lib/marketing-rules";

export const Route = createFileRoute("/admin/marketing")({
  component: AdminMarketing,
});

function AdminMarketing() {
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const overviewQ = useQuery({
    queryKey: ["admin", "marketing-overview", includeArchived],
    queryFn: () => getMarketingOverview({ includeArchived }),
    staleTime: 15_000,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [historyInquiryId, setHistoryInquiryId] = useState("");
  const historyQ = useQuery({
    queryKey: ["admin", "marketing-attribution-history", historyInquiryId],
    queryFn: () => listAttributionHistory(historyInquiryId),
    enabled: Boolean(historyInquiryId),
    staleTime: 10_000,
  });
  const [form, setForm] = useState({
    id: "",
    name: "",
    channel: "",
    status: "draft" as MarketingCampaignStatus,
    startsOn: "",
    endsOn: "",
    budgetNote: "",
  });
  const [attr, setAttr] = useState({
    consultationRequestId: "",
    campaignId: "",
    attributionSource: "",
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "marketing-overview"] });

  const saveM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof upsertMarketingCampaign>[0] = {
        name: form.name,
        channel: form.channel,
        status: form.status,
      };
      if (form.id.trim()) payload.id = form.id.trim();
      if (form.startsOn.trim()) payload.startsOn = form.startsOn.trim();
      if (form.endsOn.trim()) payload.endsOn = form.endsOn.trim();
      if (form.budgetNote.trim()) payload.budgetNote = form.budgetNote.trim();
      return upsertMarketingCampaign(payload);
    },
    onSuccess: async () => {
      setMsg("Campaign saved.");
      setForm({
        id: "",
        name: "",
        channel: "",
        status: "draft",
        startsOn: "",
        endsOn: "",
        budgetNote: "",
      });
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Campaign save failed.")),
  });

  const archiveM = useMutation({
    mutationFn: (input: { campaignId: string; archive: boolean }) =>
      archiveMarketingCampaign(input),
    onSuccess: async (_res, vars) => {
      setMsg(vars.archive ? "Campaign archived." : "Campaign restored from archive.");
      await invalidate();
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Archive failed.")),
  });

  const attrM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof attributeInquiryToCampaign>[0] = {
        consultationRequestId: attr.consultationRequestId.trim(),
        campaignId: attr.campaignId.trim() || null,
      };
      if (attr.attributionSource.trim()) {
        payload.attributionSource = attr.attributionSource.trim();
      }
      return attributeInquiryToCampaign(payload);
    },
    onSuccess: async (res) => {
      setMsg(res.nextStep);
      setHistoryInquiryId(attr.consultationRequestId.trim());
      await invalidate();
      await queryClient.invalidateQueries({
        queryKey: ["admin", "marketing-attribution-history"],
      });
    },
    onError: (e) => setMsg(portalErrorMessage(e, "Attribution failed.")),
  });

  if (overviewQ.isLoading) return <LoadingRows rows={6} />;
  if (overviewQ.isError) {
    const text = portalErrorMessage(overviewQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const data = overviewQ.data;
  if (!data) return <ErrorState body="Marketing overview unavailable." />;

  const totalInquiries = data.campaigns.reduce((n, c) => n + c.inquiries, 0);
  const registeredKnown = data.campaigns.every((c) => c.registeredStudents !== null);
  const registeredTotal = registeredKnown
    ? data.campaigns.reduce((n, c) => n + (c.registeredStudents ?? 0), 0)
    : null;

  return (
    <div>
      <PageHeader
        title="Digital Marketing"
        subtitle="Campaigns and inquiry attribution — reuses consultation requests (no second CRM)."
      />
      {msg ? <p className="mb-3 text-sm text-navy">{msg}</p> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Campaigns" value={data.campaigns.length} />
        <StatCard label="Attributed inquiries" value={totalInquiries} />
        <StatCard
          label="Registered students (email match)"
          value={formatMetricValue(registeredTotal)}
        />
        <StatCard label="Recent inquiries" value={data.recentInquiries.length} />
      </div>
      {!registeredKnown ? (
        <p className="mb-4 text-xs text-muted-foreground">
          Registered-student totals show n/a when student email match data is unavailable under RLS
          — that is not the same as zero conversions.
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title={data.canMutate ? "Create / update campaign" : "Campaign form (view only)"}>
          <div className="grid gap-2 text-sm">
            <Input
              placeholder="Campaign name *"
              value={form.name}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              placeholder="Channel (e.g. Meta Ads, Google, WhatsApp, organic, direct)"
              value={form.channel}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={form.status}
              disabled={!data.canMutate}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as MarketingCampaignStatus }))
              }
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="completed">completed</option>
            </select>
            <Input
              type="date"
              value={form.startsOn}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
            />
            <Input
              type="date"
              value={form.endsOn}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
            />
            <Input
              placeholder="Budget note (optional — not spend/ROI)"
              value={form.budgetNote}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, budgetNote: e.target.value }))}
            />
            <Input
              placeholder="Existing campaign ID to update (optional)"
              value={form.id}
              disabled={!data.canMutate}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            />
            {data.canMutate ? (
              <Button
                size="sm"
                variant="navy"
                disabled={!form.name.trim() || saveM.isPending}
                onClick={() => {
                  setMsg(null);
                  saveM.mutate();
                }}
              >
                Save campaign
              </Button>
            ) : null}
            {data.isSuperAdmin ? (
              <p className="text-xs text-muted-foreground">
                Super Admin may reopen completed → active. Admin cannot invent that privilege.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Attribute inquiry to campaign">
          <div className="grid gap-2 text-sm">
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={attr.consultationRequestId}
              onChange={(e) => {
                setAttr((f) => ({ ...f, consultationRequestId: e.target.value }));
                setHistoryInquiryId(e.target.value);
              }}
            >
              <option value="">Select consultation request</option>
              {data.recentInquiries.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.referenceCode} — {i.fullName}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-background px-2"
              value={attr.campaignId}
              onChange={(e) => setAttr((f) => ({ ...f, campaignId: e.target.value }))}
            >
              <option value="">No campaign / organic / direct</option>
              {data.campaigns
                .filter((c) => !c.archivedAt)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
            </select>
            <Input
              placeholder="Attribution source (e.g. organic, direct, referral)"
              value={attr.attributionSource}
              onChange={(e) => setAttr((f) => ({ ...f, attributionSource: e.target.value }))}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!attr.consultationRequestId || attrM.isPending}
              onClick={() => {
                setMsg(null);
                attrM.mutate();
              }}
            >
              Save attribution
            </Button>
            <p className="text-xs text-muted-foreground">
              Original source is preserved. History is written before changes. Convert via{" "}
              <Link to="/admin/leads" className="font-semibold text-royal hover:underline">
                Leads
              </Link>{" "}
              with the same email — no duplicate CRM.
            </p>
          </div>
        </Panel>
      </div>

      <Panel title="Campaigns" className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
        {!data.campaigns.length ? (
          <EmptyState
            title="No campaigns"
            body="Apply marketing migrations and create a campaign. Metrics are not fabricated."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Inquiries</th>
                <th>New</th>
                <th>Followed up</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id} className={c.archivedAt ? "opacity-60" : undefined}>
                  <td className="font-medium text-navy">
                    {c.name}
                    {c.archivedAt ? (
                      <span className="ml-2 text-xs text-muted-foreground">archived</span>
                    ) : null}
                  </td>
                  <td>{c.channel || "—"}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>{c.inquiries}</td>
                  <td>{c.newInquiries}</td>
                  <td>{c.assignedInquiries}</td>
                  <td title={c.registeredStudentsUnavailable ?? undefined}>
                    {formatMetricValue(c.registeredStudents)}
                  </td>
                  <td className="space-x-1">
                    {data.canMutate ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setForm({
                              id: c.id,
                              name: c.name,
                              channel: c.channel,
                              status: c.status as MarketingCampaignStatus,
                              startsOn: c.startsOn ?? "",
                              endsOn: c.endsOn ?? "",
                              budgetNote: c.budgetNote ?? "",
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={archiveM.isPending}
                          onClick={() => {
                            setMsg(null);
                            archiveM.mutate({
                              campaignId: c.id,
                              archive: !c.archivedAt,
                            });
                          }}
                        >
                          {c.archivedAt ? "Unarchive" : "Archive"}
                        </Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Recent consultation inquiries" className="mb-6">
        {!data.recentInquiries.length ? (
          <EmptyState
            title="No inquiries"
            body="Public consultation requests appear here when present."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Name</th>
                <th>Status</th>
                <th>Campaign</th>
                <th>Source</th>
                <th>Original source</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInquiries.map((i) => {
                const camp = data.campaigns.find((c) => c.id === i.campaignId);
                return (
                  <tr key={i.id}>
                    <td>
                      <button
                        type="button"
                        className="text-royal underline-offset-2 hover:underline"
                        onClick={() => setHistoryInquiryId(i.id)}
                      >
                        {i.referenceCode}
                      </button>
                    </td>
                    <td className="font-medium text-navy">{i.fullName}</td>
                    <td>
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="text-xs">{camp?.name ?? "—"}</td>
                    <td className="text-xs">{i.attributionSource ?? "—"}</td>
                    <td className="text-xs">{i.originalAttributionSource ?? "—"}</td>
                    <td>{fmtDate(i.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Attribution history">
        {!historyInquiryId ? (
          <EmptyState
            title="Select an inquiry"
            body="Click a reference code above to load attribution change history."
          />
        ) : historyQ.isLoading ? (
          <LoadingRows rows={3} />
        ) : historyQ.isError ? (
          <ErrorState body={portalErrorMessage(historyQ.error)} />
        ) : !historyQ.data?.history.length ? (
          <EmptyState title="No history yet" body="Changes appear after re-attribution." />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>When</th>
                <th>Previous campaign</th>
                <th>New campaign</th>
                <th>Previous source</th>
                <th>New source</th>
              </tr>
            </thead>
            <tbody>
              {historyQ.data.history.map((h) => (
                <tr key={h.id}>
                  <td>{fmtDate(h.createdAt)}</td>
                  <td className="text-xs font-mono">{h.previousCampaignId ?? "—"}</td>
                  <td className="text-xs font-mono">{h.newCampaignId ?? "—"}</td>
                  <td className="text-xs">{h.previousAttributionSource ?? "—"}</td>
                  <td className="text-xs">{h.newAttributionSource ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
