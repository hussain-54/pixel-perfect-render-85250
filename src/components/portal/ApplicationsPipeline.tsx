import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  changeApplicationStage,
  createPipelineApplication,
  getApplicationDetail,
  getApplicationsPipeline,
  listAdmissionHandovers,
  updateAdmissionHandover,
} from "@/services";
import {
  ALLOWED_STAGE_TRANSITIONS,
  APPLICATION_PIPELINE_STAGES,
  applicationTerminalActions,
  isPipelineStage,
  type ApplicationPipelineStage,
  type ApplicationPipelineRow,
  type ApplicationStageTarget,
} from "@/types/applications-pipeline";
import { deriveAdmissionNextAction, formatApplicationRef } from "@/lib/admission-workspace";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "board";
type OwnerFilter = "all" | "has_owner" | "unassigned";
type DocsFilter = "all" | "docs_pending";
type ActionFilter = "all" | "action_required";

export function ApplicationsPipeline() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("table");
  const [stageFilter, setStageFilter] = useState<ApplicationPipelineStage | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [docsFilter, setDocsFilter] = useState<DocsFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [returnHandoverId, setReturnHandoverId] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [confirmStage, setConfirmStage] = useState<{
    id: string;
    to: ApplicationStageTarget;
    label: string;
  } | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    university: "",
    program: "",
    country: "",
    intake: "",
    deadline: "",
  });

  const filters = useMemo(() => {
    const next: { q?: string; stage: ApplicationPipelineStage | "all" } = {
      stage: stageFilter,
    };
    const trimmed = q.trim();
    if (trimmed) next.q = trimmed;
    return next;
  }, [q, stageFilter]);

  const pipelineQ = useQuery({
    queryKey: ["officer", "applications-pipeline", filters],
    queryFn: () => getApplicationsPipeline(filters),
    staleTime: 20_000,
  });

  const handoversQ = useQuery({
    queryKey: ["officer", "admission-handovers", "submitted"],
    queryFn: () => listAdmissionHandovers({ status: "submitted" }),
    staleTime: 20_000,
  });

  const detailQ = useQuery({
    queryKey: ["officer", "application-detail", detailId],
    queryFn: () => getApplicationDetail(detailId!),
    enabled: Boolean(detailId),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["officer", "applications-pipeline"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "admission-handovers"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "student-profile"] });
    await queryClient.invalidateQueries({ queryKey: ["applications"] });
    if (detailId) {
      await queryClient.invalidateQueries({
        queryKey: ["officer", "application-detail", detailId],
      });
    }
  };

  const handoverM = useMutation({
    mutationFn: (input: { handoverId: string; action: "accept" | "return"; note?: string }) =>
      updateAdmissionHandover(input),
    onSuccess: async () => {
      setStageError(null);
      setReturnHandoverId(null);
      setReturnNote("");
      await invalidate();
    },
    onError: (err) => setStageError(portalErrorMessage(err, "Handover update failed.")),
  });

  const stageM = useMutation({
    mutationFn: ({ id, to }: { id: string; to: ApplicationStageTarget }) =>
      changeApplicationStage(id, to),
    onSuccess: async () => {
      setStageError(null);
      setConfirmStage(null);
      await invalidate();
    },
    onError: (err) => setStageError(portalErrorMessage(err, "Stage change failed.")),
  });

  const createM = useMutation({
    mutationFn: () =>
      createPipelineApplication({
        ...form,
        idempotencyKey: `create-${form.studentId}-${form.university}-${form.program}-${form.intake}`,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm({
        studentId: "",
        university: "",
        program: "",
        country: "",
        intake: "",
        deadline: "",
      });
      await invalidate();
    },
  });

  const handoverByStudent = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of handoversQ.data?.handovers ?? []) {
      map.set(h.studentId, h.status);
    }
    return map;
  }, [handoversQ.data]);

  if (pipelineQ.isLoading) return <LoadingRows rows={8} />;
  if (pipelineQ.isError) {
    const msg = portalErrorMessage(pipelineQ.error);
    if (String(pipelineQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} onRetry={() => void pipelineQ.refetch()} />;
  }

  const data = pipelineQ.data;
  if (!data) return <EmptyState title="No applications data" />;

  const displayRows = data.rows.filter((row) => {
    if (docsFilter === "docs_pending" && row.stage !== "Docs Pending") return false;
    if (ownerFilter === "unassigned" && row.officerId) return false;
    if (ownerFilter === "has_owner" && !row.officerId) return false;
    if (actionFilter === "action_required") {
      const next = deriveAdmissionNextAction({
        stage: row.stage,
        handoverStatus: handoverByStudent.get(row.studentId) ?? null,
        docsNeedingAttention: row.stage === "Docs Pending",
        deadlineWarning: row.deadlineWarning,
      });
      if (next.priority > 4) return false;
    }
    return true;
  });

  const requestStageChange = (id: string, to: ApplicationStageTarget) => {
    const consequential =
      to === "Submitted" || to === "Offer Received" || to === "Rejected" || to === "Withdrawn";
    if (consequential) {
      setConfirmStage({ id, to, label: to });
      return;
    }
    stageM.mutate({ id, to });
  };

  const onDropStage = (toStage: ApplicationPipelineStage) => {
    if (!dragId) return;
    const id = dragId;
    const row = data.rows.find((r) => r.id === id) ?? null;
    setDragId(null);
    if (row && row.stage === toStage) return;
    requestStageChange(id, toStage);
  };

  return (
    <div>
      <PageHeader
        title="Admissions Application Queue"
        subtitle="Search, filter, and advance university applications. Handover status stays separate from application stage."
        actions={
          <>
            <div className="flex rounded-md border border-border p-0.5">
              <Button
                size="sm"
                variant={view === "table" ? "navy" : "ghost"}
                onClick={() => setView("table")}
              >
                Table view
              </Button>
              <Button
                size="sm"
                variant={view === "board" ? "navy" : "ghost"}
                onClick={() => setView("board")}
              >
                Board view
              </Button>
            </div>
            {data.canCreate ? (
              <Button size="sm" variant="navy" onClick={() => setCreateOpen(true)}>
                + New application
              </Button>
            ) : null}
          </>
        }
      />

      {(handoversQ.data?.handovers?.length ?? 0) > 0 ? (
        <Panel title="Counsellor handovers awaiting review" className="mb-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Handover status is not an application stage. Accept to take ownership, or return with a
            note for the counsellor.
          </p>
          <TableWrap>
            <thead>
              <tr>
                <th>Student</th>
                <th>Summary</th>
                <th>Handed over</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {handoversQ.data!.handovers.map((h) => (
                <tr key={h.id}>
                  <td className="font-medium text-navy">
                    <Link
                      to="/staff/students/$studentId"
                      params={{ studentId: h.studentId }}
                      search={{ tab: "applications" }}
                      className="hover:underline"
                    >
                      {h.studentName ?? h.studentCaseId ?? h.studentId.slice(0, 8)}
                    </Link>
                    {h.studentCaseId ? (
                      <p className="text-xs text-muted-foreground">{h.studentCaseId}</p>
                    ) : null}
                  </td>
                  <td className="max-w-md text-sm text-muted-foreground">{h.summary}</td>
                  <td>{fmtDate(h.handedOverAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="navy"
                        disabled={handoverM.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Accept this handover and take admissions ownership for this student?",
                            )
                          ) {
                            handoverM.mutate({ handoverId: h.id, action: "accept" });
                          }
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={handoverM.isPending}
                        onClick={() => {
                          setReturnHandoverId(h.id);
                          setReturnNote("");
                        }}
                      >
                        Return
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <StageChip
          label={`All (${data.counts.all})`}
          active={stageFilter === "all"}
          onClick={() => setStageFilter("all")}
        />
        {APPLICATION_PIPELINE_STAGES.map((s) => (
          <StageChip
            key={s.key}
            label={`${s.label} (${data.counts[s.key]})`}
            active={stageFilter === s.key}
            onClick={() => setStageFilter(s.key)}
          />
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[16rem] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
            Search
          </label>
          <Input
            placeholder="Student, case, app ID, university, or program…"
            aria-label="Search applications"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <FilterSelect
          label="Owner"
          value={ownerFilter}
          onChange={(v) => setOwnerFilter(v as OwnerFilter)}
          options={[
            { value: "all", label: "All owners" },
            { value: "has_owner", label: "Has owner" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
        <FilterSelect
          label="Documents"
          value={docsFilter}
          onChange={(v) => setDocsFilter(v as DocsFilter)}
          options={[
            { value: "all", label: "Any document state" },
            { value: "docs_pending", label: "Docs Pending stage" },
          ]}
        />
        <FilterSelect
          label="Action"
          value={actionFilter}
          onChange={(v) => setActionFilter(v as ActionFilter)}
          options={[
            { value: "all", label: "Any priority" },
            { value: "action_required", label: "Action required" },
          ]}
        />
      </div>

      {stageError ? (
        <div className="mb-4">
          <ErrorState body={stageError} />
        </div>
      ) : null}

      {view === "table" ? (
        !displayRows.length ? (
          <EmptyState
            title="No applications in this view"
            body="Adjust filters or create a new application for an authorized student."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Student</th>
                <th>University / program</th>
                <th className="hidden lg:table-cell">Owner</th>
                <th>Stage</th>
                <th>Next action</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => {
                const next = deriveAdmissionNextAction({
                  stage: row.stage,
                  handoverStatus: handoverByStudent.get(row.studentId) ?? null,
                  docsNeedingAttention: row.stage === "Docs Pending",
                  deadlineWarning: row.deadlineWarning,
                });
                return (
                  <tr key={row.id}>
                    <td className="font-medium text-navy">
                      {formatApplicationRef({ id: row.id })}
                    </td>
                    <td>
                      <Link
                        to="/staff/students/$studentId"
                        params={{ studentId: row.studentId }}
                        search={{ tab: "applications" }}
                        className="font-medium text-navy hover:text-royal hover:underline"
                      >
                        {row.studentName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.studentCaseId}</p>
                    </td>
                    <td>
                      <p className="font-medium text-navy">{row.university}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.program}
                        {row.intake ? ` · ${row.intake}` : ""}
                      </p>
                    </td>
                    <td className="hidden text-xs text-muted-foreground lg:table-cell">
                      {row.officerId ? formatApplicationRef({ id: row.officerId }) : "Unassigned"}
                    </td>
                    <td>
                      <StatusBadge status={row.stage} />
                    </td>
                    <td className="max-w-[14rem] text-xs text-muted-foreground">{next.label}</td>
                    <td>
                      <DeadlineCell row={row} />
                    </td>
                    <td>
                      <Button size="sm" variant="navy" onClick={() => setDetailId(row.id)}>
                        Open
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {APPLICATION_PIPELINE_STAGES.map((col) => (
            <BoardColumn
              key={col.key}
              title={col.label}
              count={data.counts[col.key]}
              rows={
                stageFilter === "all" || stageFilter === col.key
                  ? displayRows.filter((r) => r.stage === col.key)
                  : []
              }
              onDragStart={(id) => setDragId(id)}
              onDrop={() => onDropStage(col.key)}
              onOpen={setDetailId}
              disabled={stageM.isPending}
            />
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Student <span className="text-danger">*</span>
              </span>
              <select
                className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              >
                <option value="">Select student…</option>
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.caseId})
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["university", "University", true],
                ["program", "Program", true],
                ["country", "Country", true],
                ["intake", "Intake", true],
                ["deadline", "Deadline (YYYY-MM-DD)", false],
              ] as const
            ).map(([key, label, required]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  {label}
                  {required ? <span className="text-danger"> *</span> : " (optional)"}
                </span>
                <Input
                  aria-label={label}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
            {createM.isError ? <ErrorState body={portalErrorMessage(createM.error)} /> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createM.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={
                createM.isPending ||
                !form.studentId ||
                !form.university.trim() ||
                !form.program.trim() ||
                !form.country.trim() ||
                !form.intake.trim()
              }
              onClick={() => createM.mutate()}
            >
              {createM.isPending ? "Creating…" : "Create application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(returnHandoverId)}
        onOpenChange={(o) => {
          if (!o) {
            setReturnHandoverId(null);
            setReturnNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return handover to counsellor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Explain what is missing or incorrect. The counsellor will be notified.
          </p>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Return note <span className="text-danger">*</span>
            </span>
            <Textarea
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              rows={4}
              placeholder="e.g. Passport scan is expired; please request a new upload."
              aria-label="Return note"
            />
          </label>
          {returnNote.trim().length > 0 && returnNote.trim().length < 5 ? (
            <p className="text-xs text-danger">Note must be at least 5 characters.</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReturnHandoverId(null);
                setReturnNote("");
              }}
              disabled={handoverM.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={handoverM.isPending || returnNote.trim().length < 5 || !returnHandoverId}
              onClick={() => {
                if (!returnHandoverId) return;
                handoverM.mutate({
                  handoverId: returnHandoverId,
                  action: "return",
                  note: returnNote.trim(),
                });
              }}
            >
              {handoverM.isPending ? "Returning…" : "Confirm return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmStage)}
        onOpenChange={(o) => {
          if (!o) setConfirmStage(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm stage change</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Move this application to <strong>{confirmStage?.label}</strong>? This update is recorded
            in stage history.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmStage(null)}
              disabled={stageM.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={stageM.isPending || !confirmStage}
              onClick={() => {
                if (!confirmStage) return;
                stageM.mutate({ id: confirmStage.id, to: confirmStage.to });
              }}
            >
              {stageM.isPending ? "Updating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailId)} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application workspace</DialogTitle>
          </DialogHeader>
          {detailQ.isLoading ? (
            <LoadingRows rows={4} />
          ) : detailQ.isError ? (
            <ErrorState
              body={portalErrorMessage(detailQ.error)}
              onRetry={() => void detailQ.refetch()}
            />
          ) : detailQ.data ? (
            <div className="space-y-4">
              {(() => {
                const app = detailQ.data!.application;
                const next = deriveAdmissionNextAction({
                  stage: app.stage,
                  handoverStatus: handoverByStudent.get(app.studentId) ?? null,
                  docsNeedingAttention: app.stage === "Docs Pending",
                  deadlineWarning: app.deadlineWarning,
                });
                return (
                  <>
                    <div className="rounded-md border border-border bg-surface/60 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Next required action
                      </p>
                      <p className="text-sm font-medium text-navy">{next.label}</p>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <Detail label="App reference" value={formatApplicationRef({ id: app.id })} />
                      <Detail label="Stage" value={app.stage} />
                      <Detail label="Student" value={app.studentName} />
                      <Detail label="Case" value={app.studentCaseId} />
                      <Detail label="University" value={app.university} />
                      <Detail label="Program" value={app.program} />
                      <Detail label="Intake" value={app.intake} />
                      <Detail
                        label="Owner"
                        value={
                          app.officerId ? formatApplicationRef({ id: app.officerId }) : "Unassigned"
                        }
                      />
                      <Detail
                        label="Deadline"
                        value={app.deadline === "-" || !app.deadline ? "—" : fmtDate(app.deadline)}
                      />
                      <Detail
                        label="Applied"
                        value={app.appliedOn ? fmtDate(app.appliedOn) : "—"}
                      />
                    </dl>
                  </>
                );
              })()}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/staff/students/$studentId"
                    params={{ studentId: detailQ.data.application.studentId }}
                    search={{ tab: "applications" }}
                  >
                    Open student profile
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link
                    to="/staff/students/$studentId"
                    params={{ studentId: detailQ.data.application.studentId }}
                    search={{ tab: "documents" }}
                  >
                    Documents
                  </Link>
                </Button>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Move to stage
                </p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const current = detailQ.data!.application.stage;
                    const allowed = isPipelineStage(current)
                      ? ALLOWED_STAGE_TRANSITIONS[current]
                      : [];
                    return allowed.map((key) => (
                      <Button
                        key={key}
                        size="sm"
                        variant="outline"
                        disabled={stageM.isPending}
                        onClick={() => requestStageChange(detailQ.data!.application.id, key)}
                      >
                        {key}
                      </Button>
                    ));
                  })()}
                  {!isPipelineStage(detailQ.data!.application.stage) ? (
                    <p className="text-sm text-muted-foreground">Outside submission pipeline.</p>
                  ) : null}
                </div>
              </div>
              {isPipelineStage(detailQ.data.application.stage) ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Close application
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {applicationTerminalActions(detailQ.data.application.stage).map((outcome) => (
                      <Button
                        key={outcome}
                        size="sm"
                        variant="outline"
                        disabled={stageM.isPending}
                        onClick={() => requestStageChange(detailQ.data!.application.id, outcome)}
                      >
                        Mark {outcome.toLowerCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <Panel title="Stage history">
                {!detailQ.data.history.length ? (
                  <p className="text-sm text-muted-foreground">No history recorded yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {detailQ.data.history.map((h) => (
                      <li
                        key={h.id}
                        className="border-t border-border/70 pt-2 first:border-0 first:pt-0"
                      >
                        <p className="text-sm font-medium text-navy">
                          {h.fromStage ?? "—"} → {h.toStage}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {h.changedByName} · {fmtDate(h.changedAt.slice(0, 10))}{" "}
                          {new Date(h.changedAt).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {h.note ? ` · ${h.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <select
        className="h-10 min-w-[10rem] rounded-md border border-input bg-white px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StageChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "border-royal bg-accent text-royal"
          : "border-border bg-white text-navy hover:border-royal/40",
      )}
    >
      {label}
    </button>
  );
}

function DeadlineCell({ row }: { row: ApplicationPipelineRow }) {
  if (!row.deadline || row.deadline === "-") return <span>—</span>;
  return (
    <div>
      <p className="text-sm text-navy">{fmtDate(row.deadline)}</p>
      {row.daysLeft !== null ? (
        <p
          className={cn(
            "text-xs",
            row.deadlineWarning ? "font-bold text-danger" : "text-muted-foreground",
          )}
        >
          {row.deadlineWarning ? "⚠ " : ""}
          {row.daysLeft < 0
            ? `${Math.abs(row.daysLeft)} days overdue`
            : row.daysLeft === 0
              ? "Due today"
              : `${row.daysLeft} days left`}
        </p>
      ) : null}
    </div>
  );
}

function BoardColumn({
  title,
  count,
  rows,
  onDragStart,
  onDrop,
  onOpen,
  disabled,
}: {
  title: string;
  count: number;
  rows: ApplicationPipelineRow[];
  onDragStart: (id: string) => void;
  onDrop: () => void;
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <section
      className="min-h-[16rem] rounded-md border border-border bg-white p-2"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled) onDrop();
      }}
    >
      <header className="mb-2 border-b border-border px-1 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="text-sm font-semibold text-navy">{count}</p>
      </header>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            draggable={!disabled}
            onDragStart={() => onDragStart(row.id)}
            className="cursor-grab rounded border border-border/80 bg-surface px-2 py-2 active:cursor-grabbing"
          >
            <button type="button" className="w-full text-left" onClick={() => onOpen(row.id)}>
              <p className="text-sm font-semibold text-navy">
                {row.studentName} ·{" "}
                {row.university.replace("University of ", "").replace("Univ. of ", "")}
              </p>
              <p className="text-xs text-muted-foreground">{row.intake}</p>
              {row.deadlineWarning ? (
                <p className="mt-1 text-xs font-bold text-danger">⚠ {row.daysLeft} days left</p>
              ) : null}
            </button>
          </li>
        ))}
        {!rows.length ? (
          <li className="px-1 py-6 text-center text-xs text-muted-foreground">Drop here</li>
        ) : null}
      </ul>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium text-navy">{value}</dd>
    </div>
  );
}
