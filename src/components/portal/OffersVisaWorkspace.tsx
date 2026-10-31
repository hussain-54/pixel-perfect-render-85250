import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  Panel,
  PermissionDenied,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptOffer,
  advanceCasI20,
  advanceVisaStage,
  createOfferRecord,
  declineOffer,
  exportOffersSummary,
  getOfferDetail,
  getOffersVisa,
  recordDepositPaid,
  setOfferConditionMet,
} from "@/services";
import {
  OFFERS_METRIC_TABS,
  OFFERS_PHASE_TABS,
  VISA_STAGE_LABELS,
  VISA_STAGE_ORDER,
  type OffersMetricTab,
  type OffersPhaseTab,
} from "@/types/offers-visa";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy";

function phaseForMetric(metric: OffersMetricTab): OffersPhaseTab {
  if (metric === "deposits_due") return "deposits";
  if (metric === "cas_confirmation_pending") return "cas_i20";
  if (metric === "visa_in_progress" || metric === "decisions") return "visa";
  return "offers";
}

export function OffersVisaWorkspace(props?: {
  initialMetric?: OffersMetricTab;
  initialPhase?: OffersPhaseTab;
  initialQ?: string;
  initialStudentId?: string;
}) {
  const queryClient = useQueryClient();
  const seedMetric = props?.initialMetric ?? "offers_received";
  const [metric, setMetric] = useState<OffersMetricTab>(seedMetric);
  const [phase, setPhase] = useState<OffersPhaseTab>(
    props?.initialPhase ?? phaseForMetric(seedMetric),
  );
  const [q, setQ] = useState(props?.initialQ ?? props?.initialStudentId ?? "");
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [depositRef, setDepositRef] = useState("");
  const [casRef, setCasRef] = useState("");
  const [form, setForm] = useState({
    applicationId: "",
    offerType: "conditional" as "conditional" | "unconditional",
    responseDeadline: "",
    conditionsText: "",
  });

  const filters = useMemo(() => {
    const next: { metric: OffersMetricTab; phase: OffersPhaseTab; q?: string } = { metric, phase };
    const trimmed = q.trim();
    if (trimmed) next.q = trimmed;
    return next;
  }, [metric, phase, q]);

  const listQ = useQuery({
    queryKey: ["officer", "offers-visa", filters],
    queryFn: () => getOffersVisa(filters),
    staleTime: 20_000,
  });

  const detailQ = useQuery({
    queryKey: ["officer", "offer-detail", selectedOfferId],
    queryFn: () => getOfferDetail(selectedOfferId!),
    enabled: Boolean(selectedOfferId),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["officer", "offers-visa"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "offer-detail"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
  };

  const createM = useMutation({
    mutationFn: () => {
      const payload: Parameters<typeof createOfferRecord>[0] = {
        applicationId: form.applicationId,
        offerType: form.offerType,
        conditions:
          form.offerType === "conditional"
            ? form.conditionsText
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            : [],
        idempotencyKey: `offer-${form.applicationId}-${form.offerType}`,
      };
      if (form.responseDeadline.trim()) payload.responseDeadline = form.responseDeadline.trim();
      return createOfferRecord(payload);
    },
    onSuccess: async (result) => {
      setCreateOpen(false);
      setSelectedOfferId(result.offer.id);
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err, "Could not create offer record.")),
  });

  const conditionM = useMutation({
    mutationFn: ({ id, met }: { id: string; met: boolean }) => setOfferConditionMet(id, met),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const acceptM = useMutation({
    mutationFn: (offerId: string) => acceptOffer(offerId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const declineM = useMutation({
    mutationFn: (offerId: string) => declineOffer(offerId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const depositM = useMutation({
    mutationFn: (depositId: string) => recordDepositPaid(depositId, depositRef.trim()),
    onSuccess: async () => {
      setDepositRef("");
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const casM = useMutation({
    mutationFn: (recordId: string) =>
      advanceCasI20(recordId, casRef.trim() ? { referenceNumber: casRef.trim() } : undefined),
    onSuccess: async () => {
      setCasRef("");
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const visaM = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision?: "approved" | "refused" }) =>
      advanceVisaStage(id, decision ? { decision } : undefined),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const exportM = useMutation({
    mutationFn: () => exportOffersSummary(),
    onSuccess: (payload) => {
      const blob = new Blob([payload.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `offers-visa-summary-${payload.generatedAt.slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => setActionError(portalErrorMessage(err, "Export failed.")),
  });

  if (listQ.isLoading) {
    return (
      <PageLoadState
        title="Offers & visa"
        subtitle="Offer conversions, CAS / I-20, and visa outcomes."
      >
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (listQ.isError) {
    const msg = portalErrorMessage(listQ.error);
    if (String(listQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return (
        <PageLoadState title="Offers & visa">
          <PermissionDenied body={msg} />
        </PageLoadState>
      );
    }
    return (
      <PageLoadState title="Offers & visa">
        <ErrorState body={msg} />
      </PageLoadState>
    );
  }

  const data = listQ.data;
  if (!data) {
    return (
      <PageLoadState title="Offers & visa">
        <EmptyState title="No offers pipeline" />
      </PageLoadState>
    );
  }
  const detail = detailQ.data;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        compact
        title="Offers & visa"
        subtitle="Track offer conversions, fee deposits, CAS / I-20 releases, and visa outcomes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={exportM.isPending}
              onClick={() => exportM.mutate()}
            >
              Export Summary
            </Button>
            <Button size="sm" variant="navy" onClick={() => setCreateOpen(true)}>
              Add Offer Record
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {OFFERS_METRIC_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setMetric(item.key);
              if (item.key === "deposits_due") setPhase("deposits");
              else if (item.key === "cas_confirmation_pending") setPhase("cas_i20");
              else if (item.key === "visa_in_progress" || item.key === "decisions")
                setPhase("visa");
              else if (item.key === "offers_received" || item.key === "conditions_pending")
                setPhase("offers");
            }}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              metric === item.key
                ? "border-royal bg-accent text-royal"
                : "border-border bg-white text-navy hover:border-royal/40",
            )}
          >
            {item.label} ({data.metricCounts[item.key]})
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {OFFERS_PHASE_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setPhase(item.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              phase === item.key
                ? "border-navy bg-navy text-navy-foreground"
                : "border-border bg-white text-navy hover:border-navy/40",
            )}
          >
            {item.label} ({data.phaseCounts[item.key]})
          </button>
        ))}
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search student, university, or status..."
          aria-label="Search offers and visa"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorState body={actionError} />
        </div>
      ) : null}

      <div className="mb-6 rounded-md border border-border bg-muted/30 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Visa pipeline execution stages
        </p>
        <ol className="mt-2 flex flex-wrap gap-2 text-sm text-navy">
          {VISA_STAGE_ORDER.map((stage, index) => (
            <li key={stage} className="flex items-center gap-2">
              <span className="font-semibold">
                {index + 1}. {VISA_STAGE_LABELS[stage]}
              </span>
              {index < VISA_STAGE_ORDER.length - 1 ? (
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-1 text-xs text-muted-foreground">
          Final Decision records Approved / Refused only when explicitly entered — never invented.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <div>
          {phase === "offers" ? (
            !data.offers.length ? (
              <EmptyState
                title="No offers in this view"
                body="Try another metric tab or add an offer record."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>University</th>
                    <th>Offer Type</th>
                    <th>Conditions</th>
                    <th>Accept Deadline</th>
                    <th>Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.offers.map((row) => (
                    <tr key={row.id} className={cn(selectedOfferId === row.id && "bg-accent/60")}>
                      <td>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => setSelectedOfferId(row.id)}
                        >
                          <p className="font-medium text-navy">{row.studentName}</p>
                          <p className="text-xs text-muted-foreground">{row.studentCaseId}</p>
                        </button>
                      </td>
                      <td>{row.university}</td>
                      <td>{row.offerTypeLabel}</td>
                      <td>{row.conditionsLabel}</td>
                      <td>
                        {row.responseDeadline ? (
                          <span className={cn(row.deadlineAlert && "font-semibold text-danger")}>
                            {row.deadlineAlert ? "⚠ " : ""}
                            {fmtDate(row.responseDeadline)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <StatusBadge status={row.currentStatusLabel.split(" · ")[0]!} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.currentStatusLabel}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )
          ) : null}

          {phase === "deposits" ? (
            !data.deposits.length ? (
              <EmptyState title="No deposits tracked" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>University</th>
                    <th>Amount</th>
                    <th>Due date</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deposits.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p className="font-medium text-navy">{row.studentName}</p>
                        <p className="text-xs text-muted-foreground">{row.studentCaseId}</p>
                      </td>
                      <td>{row.university}</td>
                      <td>{row.amountLabel}</td>
                      <td>
                        <span className={cn(row.deadlineAlert && "font-semibold text-danger")}>
                          {row.dueDate ? fmtDate(row.dueDate) : "—"}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={row.statusLabel} />
                      </td>
                      <td className="text-sm text-muted-foreground">{row.reference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )
          ) : null}

          {phase === "cas_i20" ? (
            !data.casI20.length ? (
              <EmptyState
                title="No CAS / I-20 records"
                body="CAS/I-20 tracking applies only for UK (CAS) and USA (I-20) destinations."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>University</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Issued</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.casI20.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p className="font-medium text-navy">{row.studentName}</p>
                        <p className="text-xs text-muted-foreground">{row.country}</p>
                      </td>
                      <td>{row.university}</td>
                      <td>{row.recordType}</td>
                      <td>
                        <StatusBadge status={row.statusLabel} />
                      </td>
                      <td className="font-mono text-xs">{row.referenceNumber ?? "—"}</td>
                      <td>{row.issuedAt ? fmtDate(row.issuedAt) : "—"}</td>
                      <td>
                        {row.nextStatus ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={casM.isPending}
                            onClick={() => {
                              if (row.nextStatus === "issued" && casRef.trim().length < 3) {
                                setActionError(
                                  "Enter a release / reference number below, then advance to Issued.",
                                );
                                return;
                              }
                              casM.mutate(row.id);
                            }}
                          >
                            Advance to {row.nextStatus}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )
          ) : null}

          {phase === "visa" ? (
            !data.visas.length ? (
              <EmptyState title="No visa filings in progress" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>University</th>
                    <th>Stage</th>
                    <th>Decision</th>
                    <th>Filed</th>
                    <th>Biometrics</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.visas.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <p className="font-medium text-navy">{row.studentName}</p>
                        <p className="text-xs text-muted-foreground">{row.country}</p>
                      </td>
                      <td>{row.university}</td>
                      <td>{row.stageLabel}</td>
                      <td>
                        <StatusBadge status={row.decisionLabel} />
                      </td>
                      <td>{row.filedAt ? fmtDate(row.filedAt) : "—"}</td>
                      <td>{row.biometricsAt ? fmtDate(row.biometricsAt) : "—"}</td>
                      <td className="space-y-1">
                        {row.nextStage ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={visaM.isPending}
                            onClick={() => visaM.mutate({ id: row.id })}
                          >
                            Advance to {VISA_STAGE_LABELS[row.nextStage]}
                          </Button>
                        ) : null}
                        {row.stage === "decision" && row.decision === "pending" ? (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="navy"
                              disabled={visaM.isPending}
                              onClick={() => visaM.mutate({ id: row.id, decision: "approved" })}
                            >
                              Record Approved
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={visaM.isPending}
                              onClick={() => visaM.mutate({ id: row.id, decision: "refused" })}
                            >
                              Record Refused
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )
          ) : null}

          {phase === "cas_i20" ? (
            <div className="mt-3 max-w-sm">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                CAS / I-20 release reference (required to issue)
                <Input
                  className="mt-1"
                  value={casRef}
                  onChange={(e) => setCasRef(e.target.value)}
                  placeholder="Release / reference number"
                />
              </label>
            </div>
          ) : null}
        </div>

        <Panel title={detail ? `${detail.offer.studentName} · Offer` : "Offer inspection"}>
          {!selectedOfferId ? (
            <p className="text-sm text-muted-foreground">
              Select an offer to inspect conditions and actions.
            </p>
          ) : detailQ.isLoading ? (
            <LoadingRows rows={4} />
          ) : detailQ.isError ? (
            <ErrorState body={portalErrorMessage(detailQ.error)} />
          ) : detail ? (
            <div className="space-y-4">
              <dl className="space-y-2 text-sm">
                <Meta label="University" value={detail.offer.university} />
                <Meta label="Application" value={detail.offer.applicationId} />
                <Meta label="Offer type" value={detail.offer.offerTypeLabel} />
                <Meta label="Offer status" value={detail.offer.status} />
                <Meta label="Current status" value={detail.offer.currentStatusLabel} />
                <Meta
                  label="Accept deadline"
                  value={
                    detail.offer.responseDeadline ? fmtDate(detail.offer.responseDeadline) : "—"
                  }
                  warn={detail.offer.deadlineAlert}
                />
                <Meta label="Conditions" value={detail.offer.conditionsLabel} />
              </dl>

              <Link
                to="/staff/students/$studentId"
                params={{ studentId: detail.offer.studentId }}
                search={{ tab: "overview" }}
                className="inline-block text-sm font-semibold text-royal hover:underline"
              >
                Open student profile
              </Link>

              {detail.conditions.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Conditions
                  </p>
                  <ul className="space-y-2">
                    {detail.conditions.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start justify-between gap-2 border-t border-border/70 pt-2 first:border-0 first:pt-0"
                      >
                        <div>
                          <p className="text-sm text-navy">{c.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.met
                              ? `Met ${c.metAt ? fmtDate(c.metAt.slice(0, 10)) : ""}`
                              : "Not met"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={conditionM.isPending}
                          onClick={() => conditionM.mutate({ id: c.id, met: !c.met })}
                        >
                          {c.met ? "Mark unmet" : "Mark met"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No conditions on this offer.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="navy"
                  disabled={acceptM.isPending || !detail.offer.canAccept}
                  onClick={() => acceptM.mutate(detail.offer.id)}
                >
                  Accept offer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    declineM.isPending ||
                    detail.offer.status === "accepted" ||
                    detail.offer.status === "declined"
                  }
                  onClick={() => declineM.mutate(detail.offer.id)}
                >
                  Decline
                </Button>
              </div>
              {!detail.offer.canAccept && detail.offer.status !== "accepted" ? (
                <p className="text-xs text-muted-foreground">
                  Acceptance is blocked until every configured condition is marked met.
                </p>
              ) : null}

              {detail.deposit ? (
                <div className="space-y-2 border-t border-border/70 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Deposit (separate from offer status)
                  </p>
                  <p className="text-sm text-navy">
                    {detail.deposit.currency} {detail.deposit.amount.toLocaleString("en-GB")} ·{" "}
                    {detail.deposit.status}
                    {detail.deposit.dueDate ? ` · due ${fmtDate(detail.deposit.dueDate)}` : ""}
                  </p>
                  {detail.deposit.status === "due" || detail.deposit.status === "overdue" ? (
                    <div className="space-y-2">
                      <Input
                        placeholder="Payment reference (required)"
                        value={depositRef}
                        onChange={(e) => setDepositRef(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={depositM.isPending || depositRef.trim().length < 3}
                        onClick={() => depositM.mutate(detail.deposit!.id)}
                      >
                        Mark deposit paid
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Reference: {detail.deposit.reference ?? "—"}
                    </p>
                  )}
                </div>
              ) : null}

              {detail.casI20 ? (
                <div className="border-t border-border/70 pt-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {detail.casI20.recordType} status
                  </p>
                  <p className="mt-1 text-navy">
                    {detail.casI20.status}
                    {detail.casI20.referenceNumber ? ` · ${detail.casI20.referenceNumber}` : ""}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No CAS/I-20 record for this destination or offer.
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Audit history
                </p>
                {!detail.history.length ? (
                  <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {detail.history.map((h) => (
                      <li
                        key={h.id}
                        className="border-t border-border/70 pt-2 first:border-0 first:pt-0"
                      >
                        <p className="text-sm font-medium text-navy">{h.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {h.actorName} · {fmtDate(h.at.slice(0, 10))}
                          {h.note ? ` · ${h.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add offer record</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Links to an existing application in Offer Received. Does not invent university
            decisions.
          </p>
          <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Application
            <select
              className={cn(selectClass, "mt-1")}
              value={form.applicationId}
              onChange={(e) => setForm((f) => ({ ...f, applicationId: e.target.value }))}
            >
              <option value="">Select application</option>
              {data.applicationsEligible.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.studentName} · {app.university} ({app.id})
                </option>
              ))}
            </select>
          </label>
          {!data.applicationsEligible.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No Offer Received applications without an offer record.
            </p>
          ) : null}
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Offer type
            <select
              className={cn(selectClass, "mt-1")}
              value={form.offerType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  offerType: e.target.value as "conditional" | "unconditional",
                }))
              }
            >
              <option value="conditional">Conditional</option>
              <option value="unconditional">Unconditional</option>
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Acceptance deadline
            <Input
              type="date"
              className="mt-1"
              value={form.responseDeadline}
              onChange={(e) => setForm((f) => ({ ...f, responseDeadline: e.target.value }))}
            />
          </label>
          {form.offerType === "conditional" ? (
            <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conditions (one per line)
              <Textarea
                className="mt-1 min-h-24"
                value={form.conditionsText}
                onChange={(e) => setForm((f) => ({ ...f, conditionsText: e.target.value }))}
                placeholder="e.g. Final transcript with official stamp"
              />
            </label>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={createM.isPending || !form.applicationId}
              onClick={() => createM.mutate()}
            >
              Create record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium text-navy", warn && "text-danger")}>{value}</dd>
    </div>
  );
}
