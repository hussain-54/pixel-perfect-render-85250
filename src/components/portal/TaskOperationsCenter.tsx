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
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
  getTaskOps,
  runTaskAutomation,
  updateTaskStatus,
  upsertTask,
} from "@/services";
import {
  TASK_FILTER_TABS,
  TASK_PRIORITY_LEVELS,
  type TaskFilterTab,
  type TaskPriorityLevel,
  type UpsertTaskInput,
} from "@/types/tasks-ops";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy";

type FormState = {
  id?: string;
  title: string;
  description: string;
  studentId: string;
  assigneeId: string;
  dueDate: string;
  priorityLevel: TaskPriorityLevel;
  relatedApplicationId: string;
  relatedDocumentId: string;
};

const emptyForm = (assigneeId = ""): FormState => ({
  title: "",
  description: "",
  studentId: "",
  assigneeId,
  dueDate: "",
  priorityLevel: "normal",
  relatedApplicationId: "",
  relatedDocumentId: "",
});

export function TaskOperationsCenter() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TaskFilterTab>("today");
  const [q, setQ] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [actionError, setActionError] = useState<string | null>(null);

  const dayKey = selectedDay
    ? `${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, "0")}-${String(selectedDay.getDate()).padStart(2, "0")}`
    : undefined;

  const filters = useMemo(() => {
    const next: { tab: TaskFilterTab; q?: string; day?: string } = { tab };
    const trimmed = q.trim();
    if (trimmed) next.q = trimmed;
    if (dayKey) next.day = dayKey;
    return next;
  }, [tab, q, dayKey]);

  const listQ = useQuery({
    queryKey: ["officer", "task-ops", filters],
    queryFn: () => getTaskOps(filters),
    staleTime: 15_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["officer", "task-ops"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
  };

  const upsertM = useMutation({
    mutationFn: (payload: UpsertTaskInput) => upsertTask(payload),
    onSuccess: async () => {
      setFormOpen(false);
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err, "Could not save task.")),
  });

  const statusM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "open" | "cancelled" }) =>
      updateTaskStatus({ id, status }),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err)),
  });

  const autoM = useMutation({
    mutationFn: () => runTaskAutomation(),
    onSuccess: async (res) => {
      setActionError(null);
      await invalidate();
      if (res.result.created === 0 && res.result.failed === 0) {
        setActionError(null);
      }
    },
    onError: (err) => setActionError(portalErrorMessage(err, "Automation run failed.")),
  });

  if (listQ.isLoading) return <LoadingRows rows={8} />;
  if (listQ.isError) {
    const msg = portalErrorMessage(listQ.error);
    if (String(listQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  const data = listQ.data;
  if (!data) return <EmptyState title="No tasks" />;

  const defaultAssignee = data.assignees[0]?.id ?? "";
  const markedDates = Object.keys(data.calendarMarks).map((key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  });

  const openCreate = () => {
    setForm(emptyForm(defaultAssignee));
    setFormOpen(true);
  };

  const openEdit = (row: (typeof data.rows)[number]) => {
    setForm({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      studentId: row.studentId ?? "",
      assigneeId: row.assigneeId,
      dueDate: row.dueAt ? row.dueAt.slice(0, 10) : "",
      priorityLevel: row.priorityLevel,
      relatedApplicationId: row.relatedApplicationId ?? "",
      relatedDocumentId: row.relatedDocumentId ?? "",
    });
    setFormOpen(true);
  };

  const submitForm = () => {
    const desc = form.description.trim();
    const payload: UpsertTaskInput = {
      title: form.title.trim(),
      assigneeId: form.assigneeId,
      priorityLevel: form.priorityLevel,
      studentId: form.studentId || null,
      relatedApplicationId: form.relatedApplicationId || null,
      relatedDocumentId: form.relatedDocumentId || null,
      dueAt: form.dueDate || null,
      ...(desc ? { description: desc } : {}),
      ...(form.id ? { id: form.id } : {}),
    };
    upsertM.mutate(payload);
  };

  const appsForStudent = data.applications.filter(
    (a) => !form.studentId || a.studentId === form.studentId,
  );
  const docsForStudent = data.documents.filter(
    (d) => !form.studentId || d.studentId === form.studentId,
  );

  return (
    <div>
      <PageHeader
        title="Task Operations Center"
        subtitle="Manage daily reminders, automated system flags, and critical application deadlines."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={autoM.isPending}
              onClick={() => autoM.mutate()}
            >
              Run automation sweep
            </Button>
            <Button size="sm" variant="navy" onClick={openCreate}>
              Add new task
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TASK_FILTER_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === item.key
                ? "border-royal bg-accent text-royal"
                : "border-border bg-white text-navy hover:border-royal/40",
            )}
          >
            {item.label} ({data.counts[item.key]})
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search title, student, assignee..."
          aria-label="Search tasks"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        {dayKey ? (
          <Button size="sm" variant="ghost" onClick={() => setSelectedDay(undefined)}>
            Clear day filter ({dayKey})
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <div className="mb-4">
          <ErrorState body={actionError} />
        </div>
      ) : null}

      <div className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Automated system tasks
        </p>
        <ul className="mt-2 list-inside list-disc text-muted-foreground">
          <li>Document rejections create a follow-up task (event-driven, idempotent).</li>
          <li>Application deadlines within 7 days generate alert tasks (server sweep).</li>
          <li>Offer acceptance deadlines within 7 days generate reminders (server sweep).</li>
          <li>Passport / IELTS expiry dates within 90 days create alerts when recorded or on sweep.</li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Scheduler: {data.automation.schedulerActive ? "active on server process" : "not running"}
          {data.automation.lastRunAt
            ? ` · Last sweep ${new Date(data.automation.lastRunAt).toLocaleString("en-GB")}`
            : " · No sweep recorded yet"}
          {data.automation.lastResult
            ? ` · Created ${data.automation.lastResult.created}, failed ${data.automation.lastResult.failed}`
            : ""}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.75fr)]">
        <div>
          {!data.rows.length ? (
            <EmptyState title="No tasks in this view" body="Try another filter or add a task." />
          ) : (
            <ul className="space-y-3">
              {data.rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "rounded-md border p-4",
                    row.isOverdue
                      ? "border-danger/50 bg-danger-soft/40"
                      : "border-border bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "text-base font-semibold text-navy",
                            row.isOverdue && "font-bold text-danger",
                          )}
                        >
                          {row.title}
                        </p>
                        {row.source === "system" ? (
                          <span className="rounded bg-info-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-royal">
                            Auto reminder
                          </span>
                        ) : null}
                        {row.isOverdue ? (
                          <span className="rounded bg-danger-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-danger">
                            Overdue
                          </span>
                        ) : null}
                        {row.priorityLevel === "high" && !row.isOverdue ? (
                          <span className="rounded bg-warning-soft px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-warning">
                            High
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {row.studentName
                          ? `Student: ${row.studentName}${row.studentCaseId ? ` · ${row.studentCaseId}` : ""}`
                          : "No student linked"}
                        {row.relatedApplicationLabel
                          ? ` · Linked app: ${row.relatedApplicationLabel}`
                          : ""}
                        {row.relatedDocumentLabel
                          ? ` · Document: ${row.relatedDocumentLabel}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.dueLabel} · Assignee {row.assigneeName} · {row.sourceLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.linkHref ? (
                        row.studentId && row.linkHref.startsWith("/staff/students/") ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              to="/staff/students/$studentId"
                              params={{ studentId: row.studentId }}
                              search={{ tab: "overview" }}
                            >
                              Open record
                            </Link>
                          </Button>
                        ) : row.linkHref === "/staff/documents" ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/staff/documents">Documents</Link>
                          </Button>
                        ) : row.linkHref === "/staff/applications" ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/staff/applications">Applications</Link>
                          </Button>
                        ) : null
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      {row.status !== "completed" ? (
                        <Button
                          size="sm"
                          variant="navy"
                          disabled={statusM.isPending}
                          onClick={() => statusM.mutate({ id: row.id, status: "completed" })}
                        >
                          Complete
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={statusM.isPending}
                          onClick={() => statusM.mutate({ id: row.id, status: "open" })}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Calendar">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={setSelectedDay}
              modifiers={{ hasTasks: markedDates }}
              modifiersClassNames={{
                hasTasks: "bg-accent text-royal font-semibold",
              }}
              className="rounded-md"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Highlighted days have due tasks. Select a day to filter the list.
            </p>
          </Panel>

          <Panel title="Date-grouped (this week)">
            <WeekGroupedList
              marks={data.calendarMarks}
              onPick={(key) => {
                const [y, m, d] = key.split("-").map(Number);
                setSelectedDay(new Date(y!, m! - 1, d!));
                setTab("week");
              }}
            />
          </Panel>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit task" : "Add new task"}</DialogTitle>
          </DialogHeader>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Title
            <Input
              className="mt-1"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Description
            <Textarea
              className="mt-1 min-h-20"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Student
            <select
              className={cn(selectClass, "mt-1")}
              value={form.studentId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  studentId: e.target.value,
                  relatedApplicationId: "",
                  relatedDocumentId: "",
                }))
              }
            >
              <option value="">None</option>
              {data.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.caseId}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linked application
            <select
              className={cn(selectClass, "mt-1")}
              value={form.relatedApplicationId}
              onChange={(e) => setForm((f) => ({ ...f, relatedApplicationId: e.target.value }))}
            >
              <option value="">None</option>
              {appsForStudent.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Linked document
            <select
              className={cn(selectClass, "mt-1")}
              value={form.relatedDocumentId}
              onChange={(e) => setForm((f) => ({ ...f, relatedDocumentId: e.target.value }))}
            >
              <option value="">None</option>
              {docsForStudent.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assignee
            <select
              className={cn(selectClass, "mt-1")}
              value={form.assigneeId}
              onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))}
            >
              {data.assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Due date
              <Input
                type="date"
                className="mt-1"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
              <select
                className={cn(selectClass, "mt-1")}
                value={form.priorityLevel}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priorityLevel: e.target.value as TaskPriorityLevel,
                  }))
                }
              >
                {TASK_PRIORITY_LEVELS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={upsertM.isPending || !form.title.trim() || !form.assigneeId}
              onClick={submitForm}
            >
              Save task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeekGroupedList({
  marks,
  onPick,
}: {
  marks: Record<string, number>;
  onPick: (dayKey: string) => void;
}) {
  const entries = Object.entries(marks)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 14);
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No dated tasks.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map(([key, count]) => (
        <li key={key}>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:border-royal/40"
            onClick={() => onPick(key)}
          >
            <span className="font-medium text-navy">{fmtDate(key)}</span>
            <span className="text-xs text-muted-foreground">{count} task{count === 1 ? "" : "s"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
