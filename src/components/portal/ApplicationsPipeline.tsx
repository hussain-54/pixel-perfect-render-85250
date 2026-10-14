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
import { cn } from "@/lib/utils";

type ViewMode = "table" | "board";

export function ApplicationsPipeline() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("table");
  const [stageFilter, setStageFilter] = useState<ApplicationPipelineStage | "all">("all");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
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
    mutationFn: (input: { handoverId: string; action: "accept" | "return" }) =>
      updateAdmissionHandover(input),
    onSuccess: async () => {
      setStageError(null);
      await invalidate();
    },
    onError: (err) => setStageError(portalErrorMessage(err, "Handover update failed.")),
  });

  const stageM = useMutation({
    mutationFn: ({ id, to }: { id: string; to: ApplicationStageTarget }) =>
      changeApplicationStage(id, to),
    onSuccess: async () => {
      setStageError(null);
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

  if (pipelineQ.isLoading) return <LoadingRows rows={8} />;
  if (pipelineQ.isError) {
    const msg = portalErrorMessage(pipelineQ.error);
    if (String(pipelineQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  const data = pipelineQ.data;
  if (!data) return <EmptyState title="No applications data" />;

  const onDropStage = (toStage: ApplicationPipelineStage) => {
    if (!dragId) return;
    const id = dragId;
    const row = data.rows.find((r) => r.id === id) ?? null;
    setDragId(null);
    if (row && row.stage === toStage) return;
    stageM.mutate({ id, to: toStage });
  };

  return (
    <div>
      <PageHeader
        title="University Applications"
        subtitle="Track lifecycle from document verification to offer issuance."
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
        <Panel title="Admission handover queue" className="mb-4">
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
                      search={{ tab: "assessment" }}
                      className="hover:underline"
                    >
                      {h.studentName ?? h.studentCaseId ?? h.studentId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="max-w-md text-sm text-muted-foreground">{h.summary}</td>
                  <td>{fmtDate(h.handedOverAt)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="navy"
                        disabled={handoverM.isPending}
                        onClick={() => handoverM.mutate({ handoverId: h.id, action: "accept" })}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={handoverM.isPending}
                        onClick={() => handoverM.mutate({ handoverId: h.id, action: "return" })}
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

      <div className="mb-4">
        <Input
          placeholder="Search app ID, student, university..."
          aria-label="Search applications"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>

      {stageError ? (
        <div className="mb-4">
          <ErrorState body={stageError} />
        </div>
      ) : null}

      {view === "table" ? (
        !data.rows.length ? (
          <EmptyState
            title="No applications in this view"
            body="Adjust filters or create a new application for an assigned student."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>App ID</th>
                <th>Student</th>
                <th>University and program</th>
                <th>Intake</th>
                <th>Stage</th>
                <th>Deadline / alert</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium text-navy">{row.id}</td>
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
                    <p className="text-xs text-muted-foreground">{row.program}</p>
                  </td>
                  <td>{row.intake}</td>
                  <td>
                    <StatusBadge status={row.stage} />
                  </td>
                  <td>
                    <DeadlineCell row={row} />
                  </td>
                  <td>
                    <Button size="sm" variant="outline" onClick={() => setDetailId(row.id)}>
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
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
                  ? data.rows.filter((r) => r.stage === col.key)
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
                Student
              </span>
              <select
                className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              >
                <option value="">Select student...</option>
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.caseId})
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["university", "University"],
                ["program", "Program"],
                ["country", "Country"],
                ["intake", "Intake"],
                ["deadline", "Deadline (YYYY-MM-DD)"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                placeholder={label}
                aria-label={label}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ))}
            {createM.isError ? <ErrorState body={portalErrorMessage(createM.error)} /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
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
              {createM.isPending ? "Creating..." : "Create application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailId)} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application details</DialogTitle>
          </DialogHeader>
          {detailQ.isLoading ? (
            <LoadingRows rows={4} />
          ) : detailQ.isError ? (
            <ErrorState body={portalErrorMessage(detailQ.error)} />
          ) : detailQ.data ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="App ID" value={detailQ.data.application.id} />
                <Detail label="Stage" value={detailQ.data.application.stage} />
                <Detail label="Student" value={detailQ.data.application.studentName} />
                <Detail label="Case" value={detailQ.data.application.studentCaseId} />
                <Detail label="University" value={detailQ.data.application.university} />
                <Detail label="Program" value={detailQ.data.application.program} />
                <Detail label="Intake" value={detailQ.data.application.intake} />
                <Detail
                  label="Deadline"
                  value={
                    detailQ.data.application.deadline === "-"
                      ? "—"
                      : fmtDate(detailQ.data.application.deadline)
                  }
                />
              </dl>
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
                        onClick={() => stageM.mutate({ id: detailQ.data!.application.id, to: key })}
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
                        onClick={() =>
                          stageM.mutate({
                            id: detailQ.data!.application.id,
                            to: outcome,
                          })
                        }
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
