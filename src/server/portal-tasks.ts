/**
 * Task Operations Center — CRUD + automation trigger (permission-scoped).
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import {
  appendTaskAudit,
  automationMeta,
  createPortalTask,
  portalTasks,
  syncOfficerTasksMirror,
} from "@/data/portal-tasks";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  dayKeyInPortalTz,
  daysUntilDateKey,
  isDueToday,
  isPastOrMissingDue,
  todayKey,
  weekRangeKeys,
} from "@/lib/task-time";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import {
  getTaskAutomationSchedulerError,
  isTaskAutomationSchedulerActive,
} from "@/server/task-automation-scheduler";
import { runTaskAutomationSweep } from "@/server/task-automation";
import type { OfficerTaskPriority, Student } from "@/types";
import {
  TASK_PRIORITY_LEVELS,
  TASK_STATUSES,
  type PortalTaskRecord,
  type TaskFilterTab,
  type TaskOpsFilters,
  type TaskOpsPayload,
  type TaskOpsRow,
  type TaskPriorityLevel,
  type UpdateTaskStatusInput,
  type UpsertTaskInput,
} from "@/types/tasks-ops";

function toError(error: unknown): never {
  if (error instanceof AuthError) throw new Error(`${error.status}:${error.message}`);
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function consultantScopeId(session: TrustedSession): string | null {
  if (session.role === "consultant") return session.consultantId ?? null;
  return null;
}

function visibleStudents(session: TrustedSession): Student[] {
  if (rolesAtLeastAdmin(session.role)) return db.students.filter((s) => !s.archived);
  if (session.role === "consultant") {
    const cid = consultantScopeId(session);
    if (!cid) return [];
    return db.students.filter((s) => s.consultantId === cid && !s.archived);
  }
  return [];
}

function actorMeta(session: TrustedSession) {
  const cid = consultantScopeId(session);
  const consultant = cid ? db.consultants.find((c) => c.id === cid) : undefined;
  const admin = rolesAtLeastAdmin(session.role);
  return {
    id: consultant?.id ?? session.userId ?? null,
    name: consultant?.name ?? (admin ? "Admin" : session.email),
  };
}

function deriveUrgency(task: PortalTaskRecord): OfficerTaskPriority {
  if (task.status === "completed" || task.status === "cancelled") return "normal";
  if (!task.dueAt) return task.priorityLevel === "high" ? "upcoming" : "normal";
  if (isPastOrMissingDue(task.dueAt)) return "overdue";
  if (isDueToday(task.dueAt)) return "due_today";
  return task.priorityLevel === "high" ? "upcoming" : "normal";
}

function dueLabel(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const key = dayKeyInPortalTz(dueAt);
  if (!key) return "Invalid date";
  const left = daysUntilDateKey(key);
  if (left === null) return key;
  if (left < 0) return `Overdue · ${key}`;
  if (left === 0) return `Due today · ${key}`;
  if (left === 1) return `Due tomorrow · ${key}`;
  return `Due ${key}`;
}

function linkHref(task: PortalTaskRecord): string | null {
  if (task.relatedDocumentId) return "/staff/documents";
  if (task.relatedApplicationId) return "/staff/applications";
  if (task.studentId) return `/staff/students/${task.studentId}`;
  return null;
}

function toRow(task: PortalTaskRecord, students: Student[]): TaskOpsRow {
  const st = task.studentId ? students.find((s) => s.id === task.studentId) : undefined;
  const assignee = db.consultants.find((c) => c.id === task.assigneeId);
  const app = task.relatedApplicationId
    ? db.applications.find((a) => a.id === task.relatedApplicationId)
    : undefined;
  const doc = task.relatedDocumentId
    ? db.documents.find((d) => d.id === task.relatedDocumentId)
    : undefined;
  const urgency = deriveUrgency(task);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    studentId: task.studentId,
    studentName: st?.name ?? null,
    studentCaseId: st?.caseId ?? null,
    assigneeId: task.assigneeId,
    assigneeName: assignee?.name ?? task.assigneeId,
    dueAt: task.dueAt,
    dueLabel: dueLabel(task.dueAt),
    priorityLevel: task.priorityLevel,
    urgency,
    status: task.status,
    source: task.source,
    sourceLabel: task.source === "system" ? "System generated" : "Manual",
    reminderRef: task.reminderRef,
    relatedApplicationId: task.relatedApplicationId,
    relatedApplicationLabel: app ? `${app.id} · ${app.university}` : null,
    relatedDocumentId: task.relatedDocumentId,
    relatedDocumentLabel: doc ? `${doc.category} · ${doc.name}` : null,
    linkHref: linkHref(task),
    isOverdue: urgency === "overdue" && task.status !== "completed" && task.status !== "cancelled",
    completedAt: task.completedAt,
  };
}

function visibleTasks(session: TrustedSession): PortalTaskRecord[] {
  const students = visibleStudents(session);
  const studentIds = new Set(students.map((s) => s.id));
  const cid = consultantScopeId(session);
  return portalTasks.filter((t) => {
    if (rolesAtLeastAdmin(session.role)) {
      return (
        !t.studentId ||
        studentIds.has(t.studentId) ||
        !db.students.some((s) => s.id === t.studentId)
      );
    }
    if (session.role === "consultant") {
      if (!cid) return false;
      if (t.assigneeId === cid) return true;
      return Boolean(t.studentId && studentIds.has(t.studentId));
    }
    return false;
  });
}

function inTab(task: PortalTaskRecord, tab: TaskFilterTab): boolean {
  const active = task.status === "open" || task.status === "in_progress";
  if (tab === "completed") return task.status === "completed";
  if (!active) return false;
  if (tab === "overdue") return deriveUrgency(task) === "overdue";
  if (tab === "today") {
    if (!task.dueAt) return false;
    return isDueToday(task.dueAt) || deriveUrgency(task) === "overdue";
  }
  // this week
  if (!task.dueAt) return tab === "week" && active;
  const key = dayKeyInPortalTz(task.dueAt);
  if (!key) return false;
  const { start, end } = weekRangeKeys();
  return key >= start && key <= end;
}

function assertCanEdit(session: TrustedSession, task: PortalTaskRecord) {
  const cid = consultantScopeId(session);
  if (rolesAtLeastAdmin(session.role)) return;
  if (session.role === "consultant" && cid && task.assigneeId === cid) return;
  if (session.role === "consultant" && cid && task.studentId) {
    const st = visibleStudents(session).find((s) => s.id === task.studentId);
    if (st) return;
  }
  throw new AuthError("You do not have permission to edit this task.", 403);
}

/** Supabase-plane row builder — mirrors toRow() but takes DB-sourced lookups as params (no module globals). */
function dbToRow(
  task: PortalTaskRecord,
  students: Student[],
  assigneeNames: Map<string, string>,
  apps: { id: string; studentId: string; university: string }[],
  docs: { id: string; studentId: string; category: string; name: string }[],
): TaskOpsRow {
  const st = task.studentId ? students.find((s) => s.id === task.studentId) : undefined;
  const app = task.relatedApplicationId
    ? apps.find((a) => a.id === task.relatedApplicationId)
    : undefined;
  const doc = task.relatedDocumentId
    ? docs.find((d) => d.id === task.relatedDocumentId)
    : undefined;
  const urgency = deriveUrgency(task);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    studentId: task.studentId,
    studentName: st?.name ?? null,
    studentCaseId: st?.caseId ?? null,
    assigneeId: task.assigneeId,
    assigneeName: assigneeNames.get(task.assigneeId) ?? task.assigneeId,
    dueAt: task.dueAt,
    dueLabel: dueLabel(task.dueAt),
    priorityLevel: task.priorityLevel,
    urgency,
    status: task.status,
    source: task.source,
    sourceLabel: task.source === "system" ? "System generated" : "Manual",
    reminderRef: task.reminderRef,
    relatedApplicationId: task.relatedApplicationId,
    relatedApplicationLabel: app ? `${app.id} · ${app.university}` : null,
    relatedDocumentId: task.relatedDocumentId,
    relatedDocumentLabel: doc ? `${doc.category} · ${doc.name}` : null,
    linkHref: linkHref(task),
    isOverdue: urgency === "overdue" && task.status !== "completed" && task.status !== "cancelled",
    completedAt: task.completedAt,
  };
}

export const portalGetTaskOps = createServerFn({ method: "GET" })
  .validator((data: TaskOpsFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<TaskOpsPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "tasks");
      await requireModulePermission(session, "students", 1, "task operations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          listVisibleStudentsDb,
          listVisibleTasksDb,
          listAppsForStudents,
          listDocsForStudents,
          resolveConsultantDeskId,
          namesForIds,
        } = await import("@/server/ao-data");
        const { listConsultants } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const students = await listVisibleStudentsDb(client, session);
        const studentIds = students.map((s) => s.id);
        const all = await listVisibleTasksDb(client, session);
        const tab: TaskFilterTab = data.tab ?? "today";
        const q = data.q?.trim().toLowerCase();
        const day = data.day?.trim();

        const counts: TaskOpsPayload["counts"] = {
          today: all.filter((t) => inTab(t, "today")).length,
          week: all.filter((t) => inTab(t, "week")).length,
          overdue: all.filter((t) => inTab(t, "overdue")).length,
          completed: all.filter((t) => inTab(t, "completed")).length,
        };

        const apps = await listAppsForStudents(client, studentIds);
        const docs = await listDocsForStudents(client, studentIds);
        const consultantRows = await listConsultants(client);
        const cid = await resolveConsultantDeskId(client, session);
        const assigneeIds = rolesAtLeastAdmin(session.role)
          ? consultantRows.map((c) => c.id)
          : consultantRows.filter((c) => c.id === cid).map((c) => c.id);
        const assigneeNames = await namesForIds(
          client,
          consultantRows.map((c) => c.id),
        );

        let rows = all
          .filter((t) => inTab(t, tab))
          .map((t) => dbToRow(t, students, assigneeNames, apps, docs));
        if (day) {
          rows = rows.filter((r) => dayKeyInPortalTz(r.dueAt) === day);
        }
        if (q) {
          rows = rows.filter((r) =>
            [
              r.title,
              r.studentName,
              r.assigneeName,
              r.relatedApplicationLabel,
              r.relatedDocumentLabel,
            ]
              .filter(Boolean)
              .some((p) => String(p).toLowerCase().includes(q)),
          );
        }

        rows.sort((a, b) => {
          if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
          const rank = { overdue: 0, due_today: 1, upcoming: 2, normal: 3 } as const;
          const ur = rank[a.urgency] - rank[b.urgency];
          if (ur !== 0) return ur;
          return (a.dueAt ?? "").localeCompare(b.dueAt ?? "");
        });

        const calendarMarks: Record<string, number> = {};
        for (const t of all) {
          if (t.status === "cancelled") continue;
          const key = dayKeyInPortalTz(t.dueAt);
          if (!key) continue;
          calendarMarks[key] = (calendarMarks[key] ?? 0) + 1;
        }

        const assignees = assigneeIds.map((id) => ({ id, name: assigneeNames.get(id) ?? id }));
        const applications = apps.map((a) => ({
          id: a.id,
          studentId: a.studentId,
          label: `${a.id} · ${a.university}`,
        }));
        const documents = docs.map((d) => ({
          id: d.id,
          studentId: d.studentId,
          label: `${d.category} · ${d.name}`,
        }));

        return {
          rows,
          counts,
          calendarMarks,
          students: students.map((s) => ({ id: s.id, name: s.name, caseId: s.caseId })),
          assignees,
          applications,
          documents,
          automation: {
            lastRunAt: automationMeta.lastRunAt,
            lastResult: automationMeta.lastRunAt
              ? {
                  ranAt: automationMeta.lastRunAt,
                  created: automationMeta.lastCreated,
                  skipped: automationMeta.lastSkipped,
                  failed: automationMeta.lastFailed,
                  errors: automationMeta.lastErrors,
                  byKind: { ...automationMeta.lastByKind },
                }
              : null,
            // Automation sweep stays mock-only for now (shared in-process scheduler, not DB-backed).
            schedulerActive: isTaskAutomationSchedulerActive(),
          },
        };
      }

      const students = visibleStudents(session);
      const all = visibleTasks(session);
      const tab: TaskFilterTab = data.tab ?? "today";
      const q = data.q?.trim().toLowerCase();
      const day = data.day?.trim();

      const counts: TaskOpsPayload["counts"] = {
        today: all.filter((t) => inTab(t, "today")).length,
        week: all.filter((t) => inTab(t, "week")).length,
        overdue: all.filter((t) => inTab(t, "overdue")).length,
        completed: all.filter((t) => inTab(t, "completed")).length,
      };

      let rows = all.filter((t) => inTab(t, tab)).map((t) => toRow(t, students));
      if (day) {
        rows = rows.filter((r) => dayKeyInPortalTz(r.dueAt) === day);
      }
      if (q) {
        rows = rows.filter((r) =>
          [
            r.title,
            r.studentName,
            r.assigneeName,
            r.relatedApplicationLabel,
            r.relatedDocumentLabel,
          ]
            .filter(Boolean)
            .some((p) => String(p).toLowerCase().includes(q)),
        );
      }

      rows.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        const rank = { overdue: 0, due_today: 1, upcoming: 2, normal: 3 } as const;
        const ur = rank[a.urgency] - rank[b.urgency];
        if (ur !== 0) return ur;
        return (a.dueAt ?? "").localeCompare(b.dueAt ?? "");
      });

      const calendarMarks: Record<string, number> = {};
      for (const t of all) {
        if (t.status === "cancelled") continue;
        const key = dayKeyInPortalTz(t.dueAt);
        if (!key) continue;
        calendarMarks[key] = (calendarMarks[key] ?? 0) + 1;
      }

      const cid = consultantScopeId(session);
      const assignees = rolesAtLeastAdmin(session.role)
        ? db.consultants.map((c) => ({ id: c.id, name: c.name }))
        : db.consultants.filter((c) => c.id === cid).map((c) => ({ id: c.id, name: c.name }));

      const studentIds = new Set(students.map((s) => s.id));
      const applications = db.applications
        .filter((a) => studentIds.has(a.studentId))
        .map((a) => ({
          id: a.id,
          studentId: a.studentId,
          label: `${a.id} · ${a.university}`,
        }));
      const documents = db.documents
        .filter((d) => studentIds.has(d.studentId))
        .map((d) => ({
          id: d.id,
          studentId: d.studentId,
          label: `${d.category} · ${d.name}`,
        }));

      return {
        rows,
        counts,
        calendarMarks,
        students: students.map((s) => ({ id: s.id, name: s.name, caseId: s.caseId })),
        assignees,
        applications,
        documents,
        automation: {
          lastRunAt: automationMeta.lastRunAt,
          lastResult: automationMeta.lastRunAt
            ? {
                ranAt: automationMeta.lastRunAt,
                created: automationMeta.lastCreated,
                skipped: automationMeta.lastSkipped,
                failed: automationMeta.lastFailed,
                errors: automationMeta.lastErrors,
                byKind: { ...automationMeta.lastByKind },
              }
            : null,
          schedulerActive: isTaskAutomationSchedulerActive(),
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpsertTask = createServerFn({ method: "POST" })
  .validator((data: UpsertTaskInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "tasks");
      const { requireAnyModulePermission } = await import("@/server/staff-access");
      await requireAnyModulePermission(
        session,
        [
          { module: "students", minimum: 2 },
          { module: "admissions", minimum: 2 },
        ],
        "task mutations",
      );

      const title0 = data.title.trim();
      if (!title0) throw new AuthError("Title is required.", 400);
      if (!data.assigneeId) throw new AuthError("Assignee is required.", 400);
      const priorityLevel0: TaskPriorityLevel = data.priorityLevel ?? "normal";
      if (!TASK_PRIORITY_LEVELS.includes(priorityLevel0)) {
        throw new AuthError("Invalid priority.", 400);
      }

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          assertStudentVisibleDb,
          listVisibleStudentsDb,
          resolveConsultantDeskId,
          listAppsForStudents,
          listDocsForStudents,
          mapTaskRow,
          namesForIds,
        } = await import("@/server/ao-data");
        const { createTask, updateTask, writeAudit } = await import("@/services/db");
        const client = requireAoSupabaseClient();

        if (data.studentId) {
          await assertStudentVisibleDb(client, session, data.studentId);
        }
        const cid = await resolveConsultantDeskId(client, session);
        if (session.role === "consultant" && cid && data.assigneeId !== cid) {
          throw new AuthError("Consultants may only assign tasks to themselves.", 403);
        }

        let dbDueAt: string | null = null;
        if (data.dueAt != null && String(data.dueAt).trim()) {
          const raw = String(data.dueAt).trim();
          const parsed = new Date(raw.includes("T") ? raw : `${raw}T09:00:00`);
          if (Number.isNaN(parsed.getTime())) throw new AuthError("Invalid due date.", 400);
          dbDueAt = parsed.toISOString();
        }

        const students = await listVisibleStudentsDb(client, session, { includeArchived: true });
        const apps = await listAppsForStudents(
          client,
          students.map((s) => s.id),
        );
        const docs = await listDocsForStudents(
          client,
          students.map((s) => s.id),
        );

        let savedRow;
        if (data.id) {
          const { data: existingRow, error: existingErr } = await client
            .from("tasks")
            .select("*")
            .eq("id", data.id)
            .maybeSingle();
          if (existingErr) throw new Error(existingErr.message);
          if (!existingRow) throw new AuthError("Task not found.", 404);
          if (!rolesAtLeastAdmin(session.role)) {
            const canEditByAssignee = Boolean(cid && existingRow.assignee_id === cid);
            const canEditByStudent = existingRow.student_id
              ? students.some((s) => s.id === existingRow.student_id)
              : false;
            if (!canEditByAssignee && !canEditByStudent) {
              throw new AuthError("You do not have permission to edit this task.", 403);
            }
          }
          savedRow = await updateTask(client, data.id, {
            title: title0,
            description: data.description?.trim() || null,
            student_id: data.studentId ?? null,
            assignee_id: data.assigneeId,
            due_at: dbDueAt,
            priority: priorityLevel0,
            related_application_id: data.relatedApplicationId ?? null,
            related_document_id: data.relatedDocumentId ?? null,
            ...(data.status && TASK_STATUSES.includes(data.status)
              ? {
                  status: data.status,
                  completed_at: data.status === "completed" ? new Date().toISOString() : null,
                }
              : {}),
          });
          await writeAudit(client, {
            action: "task_updated",
            entity_type: "task",
            entity_id: savedRow.id,
            student_id: savedRow.student_id,
            metadata: { title: savedRow.title },
          });
        } else {
          savedRow = await createTask(client, {
            title: title0,
            description: data.description?.trim() || null,
            student_id: data.studentId ?? null,
            assignee_id: data.assigneeId,
            created_by: session.userId ?? null,
            due_at: dbDueAt,
            priority: priorityLevel0,
            status: "open",
            related_application_id: data.relatedApplicationId ?? null,
            related_document_id: data.relatedDocumentId ?? null,
          });
          await writeAudit(client, {
            action: "task_created",
            entity_type: "task",
            entity_id: savedRow.id,
            student_id: savedRow.student_id,
            metadata: { title: savedRow.title },
          });
        }

        const assigneeNames = await namesForIds(
          client,
          [savedRow.assignee_id].filter((x): x is string => Boolean(x)),
        );
        return {
          ok: true as const,
          task: dbToRow(mapTaskRow(savedRow), students, assigneeNames, apps, docs),
        };
      }

      const actor = actorMeta(session);
      const title = data.title.trim();
      if (!title) throw new AuthError("Title is required.", 400);
      if (!data.assigneeId) throw new AuthError("Assignee is required.", 400);

      const priorityLevel: TaskPriorityLevel = data.priorityLevel ?? "normal";
      if (!TASK_PRIORITY_LEVELS.includes(priorityLevel)) {
        throw new AuthError("Invalid priority.", 400);
      }

      if (data.studentId) {
        const ok = visibleStudents(session).some((s) => s.id === data.studentId);
        if (!ok) throw new AuthError("You do not have access to this student.", 403);
      }

      const cid = consultantScopeId(session);
      if (
        session.role === "consultant" &&
        cid &&
        data.assigneeId !== cid &&
        !rolesAtLeastAdmin(session.role)
      ) {
        throw new AuthError("Consultants may only assign tasks to themselves.", 403);
      }

      let dueAt: string | null = null;
      if (data.dueAt != null && String(data.dueAt).trim()) {
        const raw = String(data.dueAt).trim();
        const parsed = new Date(raw.includes("T") ? raw : `${raw}T09:00:00`);
        if (Number.isNaN(parsed.getTime())) throw new AuthError("Invalid due date.", 400);
        dueAt = parsed.toISOString();
      }

      if (data.id) {
        const existing = portalTasks.find((t) => t.id === data.id);
        if (!existing) throw new AuthError("Task not found.", 404);
        assertCanEdit(session, existing);
        if (existing.source === "system" && data.title.trim() !== existing.title) {
          // allow edit but keep source label
        }
        existing.title = title;
        existing.description = data.description?.trim() || null;
        existing.studentId = data.studentId ?? null;
        existing.assigneeId = data.assigneeId;
        existing.dueAt = dueAt;
        existing.priorityLevel = priorityLevel;
        if (data.status && TASK_STATUSES.includes(data.status)) {
          existing.status = data.status;
          existing.completedAt = data.status === "completed" ? new Date().toISOString() : null;
        }
        existing.relatedApplicationId = data.relatedApplicationId ?? null;
        existing.relatedDocumentId = data.relatedDocumentId ?? null;
        existing.updatedAt = new Date().toISOString();
        syncOfficerTasksMirror();
        appendTaskAudit(actor.name, "Updated task", existing.id);
        return { ok: true as const, task: toRow(existing, visibleStudents(session)) };
      }

      const created = createPortalTask({
        title,
        description: data.description?.trim() || null,
        studentId: data.studentId ?? null,
        assigneeId: data.assigneeId,
        createdById: actor.id,
        dueAt,
        priorityLevel,
        status: "open",
        source: "manual",
        reminderRef: null,
        relatedApplicationId: data.relatedApplicationId ?? null,
        relatedDocumentId: data.relatedDocumentId ?? null,
      });
      appendTaskAudit(actor.name, "Created task", created.id);
      return { ok: true as const, task: toRow(created, visibleStudents(session)) };
    } catch (error) {
      toError(error);
    }
  });

export const portalUpdateTaskStatus = createServerFn({ method: "POST" })
  .validator((data: UpdateTaskStatusInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "tasks");
      const { requireAnyModulePermission } = await import("@/server/staff-access");
      await requireAnyModulePermission(
        session,
        [
          { module: "students", minimum: 2 },
          { module: "admissions", minimum: 2 },
        ],
        "task mutations",
      );
      if (!TASK_STATUSES.includes(data.status)) throw new AuthError("Invalid status.", 400);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          listVisibleStudentsDb,
          resolveConsultantDeskId,
          listAppsForStudents,
          listDocsForStudents,
          mapTaskRow,
          namesForIds,
        } = await import("@/server/ao-data");
        const { updateTask, writeAudit } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const { data: existingRow, error: existingErr } = await client
          .from("tasks")
          .select("*")
          .eq("id", data.id)
          .maybeSingle();
        if (existingErr) throw new Error(existingErr.message);
        if (!existingRow) throw new AuthError("Task not found.", 404);

        const students = await listVisibleStudentsDb(client, session, { includeArchived: true });
        const cid = await resolveConsultantDeskId(client, session);
        if (!rolesAtLeastAdmin(session.role)) {
          const canEditByAssignee = Boolean(cid && existingRow.assignee_id === cid);
          const canEditByStudent = existingRow.student_id
            ? students.some((s) => s.id === existingRow.student_id)
            : false;
          if (!canEditByAssignee && !canEditByStudent) {
            throw new AuthError("You do not have permission to edit this task.", 403);
          }
        }

        const updatedRow = await updateTask(client, data.id, {
          status: data.status,
          completed_at: data.status === "completed" ? new Date().toISOString() : null,
        });
        await writeAudit(client, {
          action: `task_status_${data.status}`,
          entity_type: "task",
          entity_id: updatedRow.id,
          student_id: updatedRow.student_id,
          metadata: { status: data.status },
        });

        const apps = await listAppsForStudents(
          client,
          students.map((s) => s.id),
        );
        const docs = await listDocsForStudents(
          client,
          students.map((s) => s.id),
        );
        const assigneeNames = await namesForIds(
          client,
          [updatedRow.assignee_id].filter((x): x is string => Boolean(x)),
        );
        return {
          ok: true as const,
          task: dbToRow(mapTaskRow(updatedRow), students, assigneeNames, apps, docs),
        };
      }

      const task = portalTasks.find((t) => t.id === data.id);
      if (!task) throw new AuthError("Task not found.", 404);
      assertCanEdit(session, task);
      const actor = actorMeta(session);
      task.status = data.status;
      task.completedAt = data.status === "completed" ? new Date().toISOString() : null;
      task.updatedAt = new Date().toISOString();
      syncOfficerTasksMirror();
      appendTaskAudit(actor.name, `Task status → ${data.status}`, task.id);
      return { ok: true as const, task: toRow(task, visibleStudents(session)) };
    } catch (error) {
      toError(error);
    }
  });

export const portalRunTaskAutomation = createServerFn({ method: "POST" })
  .validator((data: { secret?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    try {
      // Prefer authenticated staff; allow optional CRON_SECRET for external schedulers.
      const cronSecret = process.env["TASK_AUTOMATION_CRON_SECRET"];
      const provided = data.secret?.trim();
      if (cronSecret && provided && provided === cronSecret) {
        const result = runTaskAutomationSweep();
        return {
          ok: true as const,
          result,
          schedulerActive: isTaskAutomationSchedulerActive(),
          schedulerError: getTaskAutomationSchedulerError(),
        };
      }

      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "tasks");
      const { requireAnyModulePermission } = await import("@/server/staff-access");
      await requireAnyModulePermission(
        session,
        [
          { module: "students", minimum: 2 },
          { module: "admissions", minimum: 2 },
        ],
        "task mutations",
      );
      const result = runTaskAutomationSweep();
      appendTaskAudit(actorMeta(session).name, "Ran task automation sweep", "automation");
      return {
        ok: true as const,
        result,
        schedulerActive: isTaskAutomationSchedulerActive(),
        schedulerError: getTaskAutomationSchedulerError(),
      };
    } catch (error) {
      toError(error);
    }
  });

export { todayKey };
