/**
 * Officer task store for Task Operations Center + automation.
 * reminderRef provides idempotency for system-generated tasks.
 */
import { notifications, officerTasks } from "@/data/mock";
import { appendAuditEvent } from "@/data/immutable-audit";
import type { OfficerTask } from "@/types";
import type { PortalTaskRecord, TaskPriorityLevel, TaskSource } from "@/types/tasks-ops";

function legacyPriorityToLevel(p: OfficerTask["priority"]): TaskPriorityLevel {
  if (p === "overdue" || p === "due_today") return "high";
  if (p === "upcoming") return "normal";
  return "normal";
}

function fromLegacy(t: OfficerTask): PortalTaskRecord {
  const now = t.dueAt || new Date().toISOString();
  return {
    id: t.id,
    title: t.title,
    description: null,
    studentId: t.studentId,
    assigneeId: t.assigneeId,
    createdById: t.assigneeId,
    dueAt: t.dueAt || null,
    priorityLevel: legacyPriorityToLevel(t.priority),
    status: t.status,
    source: t.reminderRef?.startsWith("auto:") ? "system" : "manual",
    reminderRef: t.reminderRef ?? null,
    relatedApplicationId: null,
    relatedDocumentId: null,
    completedAt: t.status === "completed" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Mutable working set — seeded from officerTasks then enriched. */
export const portalTasks: PortalTaskRecord[] = officerTasks.map(fromLegacy);

// Enrich wireframe-aligned seed rows (idempotent by id).
function upsertSeed(row: PortalTaskRecord) {
  const idx = portalTasks.findIndex((t) => t.id === row.id);
  if (idx >= 0) portalTasks[idx] = { ...portalTasks[idx]!, ...row };
  else portalTasks.push(row);
}

upsertSeed({
  id: "t1",
  title: "Call University of Essex regarding CAS release",
  description: "Follow up on CAS release timing with admissions.",
  studentId: "s12",
  assigneeId: "c1",
  createdById: "c1",
  dueAt: "2026-10-08T10:00:00.000Z",
  priorityLevel: "high",
  status: "open",
  source: "manual",
  reminderRef: "task:t1",
  relatedApplicationId: "APP-3013",
  relatedDocumentId: null,
  completedAt: null,
  createdAt: "2026-10-05T09:00:00.000Z",
  updatedAt: "2026-10-05T09:00:00.000Z",
});

upsertSeed({
  id: "t2",
  title: "Follow up: Ali Raza passport renewal",
  description: "Passport expiry is approaching — confirm renewal status.",
  studentId: "s1",
  assigneeId: "c1",
  createdById: "c1",
  dueAt: "2026-10-10T16:00:00.000Z",
  priorityLevel: "high",
  status: "open",
  source: "manual",
  reminderRef: "task:t2",
  relatedApplicationId: null,
  relatedDocumentId: "d1",
  completedAt: null,
  createdAt: "2026-10-08T11:00:00.000Z",
  updatedAt: "2026-10-08T11:00:00.000Z",
});

upsertSeed({
  id: "t6",
  title: "Submit finalized application to Univ. of Leeds",
  description: "High-priority submission pack for APP-3001.",
  studentId: "s1",
  assigneeId: "c1",
  createdById: "c1",
  dueAt: "2026-10-12T09:00:00.000Z",
  priorityLevel: "high",
  status: "open",
  source: "manual",
  reminderRef: null,
  relatedApplicationId: "APP-3001",
  relatedDocumentId: null,
  completedAt: null,
  createdAt: "2026-10-09T08:00:00.000Z",
  updatedAt: "2026-10-09T08:00:00.000Z",
});

upsertSeed({
  id: "t7",
  title: "Remind Amna: Accept Bologna offer letter by 20 Oct",
  description: "System generated trigger · Offer letter expiration",
  studentId: "s8",
  assigneeId: "c1",
  createdById: null,
  dueAt: "2026-10-18T09:00:00.000Z",
  priorityLevel: "normal",
  status: "open",
  source: "system",
  reminderRef: "auto:offer-expiry:off1:2026-10-20",
  relatedApplicationId: "APP-3011",
  relatedDocumentId: null,
  completedAt: null,
  createdAt: "2026-10-10T06:00:00.000Z",
  updatedAt: "2026-10-10T06:00:00.000Z",
});

upsertSeed({
  id: "t8",
  title: "Completed: Confirm Fatima Toronto checklist",
  description: null,
  studentId: "s2",
  assigneeId: "c2",
  createdById: "c2",
  dueAt: "2026-10-07T12:00:00.000Z",
  priorityLevel: "normal",
  status: "completed",
  source: "manual",
  reminderRef: null,
  relatedApplicationId: "APP-3003",
  relatedDocumentId: null,
  completedAt: "2026-10-07T15:00:00.000Z",
  createdAt: "2026-10-05T10:00:00.000Z",
  updatedAt: "2026-10-07T15:00:00.000Z",
});

export type AutomationRunMeta = {
  lastRunAt: string | null;
  lastCreated: number;
  lastSkipped: number;
  lastFailed: number;
  lastErrors: string[];
  lastByKind: {
    document_rejection: number;
    application_deadline: number;
    offer_expiry: number;
    document_expiry: number;
  };
};

export const automationMeta: AutomationRunMeta = {
  lastRunAt: null,
  lastCreated: 0,
  lastSkipped: 0,
  lastFailed: 0,
  lastErrors: [],
  lastByKind: {
    document_rejection: 0,
    application_deadline: 0,
    offer_expiry: 0,
    document_expiry: 0,
  },
};

export function findTaskByReminderRef(ref: string): PortalTaskRecord | undefined {
  return portalTasks.find((t) => t.reminderRef === ref);
}

export function syncOfficerTasksMirror() {
  // Keep dashboard list aligned with portal task store (open/in_progress).
  officerTasks.length = 0;
  for (const t of portalTasks) {
    if (t.status !== "open" && t.status !== "in_progress") continue;
    officerTasks.push({
      id: t.id,
      studentId: t.studentId,
      title: t.title,
      dueAt: t.dueAt ?? new Date().toISOString(),
      priority:
        t.priorityLevel === "high"
          ? "due_today"
          : t.priorityLevel === "low"
            ? "normal"
            : "upcoming",
      status: t.status,
      assigneeId: t.assigneeId,
      ...(t.reminderRef ? { reminderRef: t.reminderRef } : {}),
    });
  }
}

export function appendStaffNotification(input: {
  title: string;
  body: string;
  audience?: "staff" | "admin";
}) {
  notifications.unshift({
    id: `n-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    audience: input.audience ?? "staff",
    title: input.title,
    body: input.body,
    time: new Date().toISOString(),
    read: false,
  });
}

export function appendTaskAudit(actorName: string, action: string, taskId: string) {
  const at = new Date();
  appendAuditEvent({
    id: `al-task-${Date.now().toString(36)}`,
    actorName,
    action,
    actionType: "task_event",
    outcome: action,
    entityType: "Task",
    entityId: taskId,
    createdAt: at.toISOString(),
  });
}

export function createPortalTask(
  input: Omit<PortalTaskRecord, "id" | "createdAt" | "updatedAt" | "completedAt"> & {
    id?: string;
  },
): PortalTaskRecord {
  const now = new Date().toISOString();
  const row: PortalTaskRecord = {
    id: input.id ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    title: input.title,
    description: input.description,
    studentId: input.studentId,
    assigneeId: input.assigneeId,
    createdById: input.createdById,
    dueAt: input.dueAt,
    priorityLevel: input.priorityLevel,
    status: input.status,
    source: input.source,
    reminderRef: input.reminderRef,
    relatedApplicationId: input.relatedApplicationId,
    relatedDocumentId: input.relatedDocumentId,
    completedAt: input.status === "completed" ? now : null,
    createdAt: now,
    updatedAt: now,
  };
  portalTasks.unshift(row);
  syncOfficerTasksMirror();
  return row;
}

export function createSystemTaskIdempotent(input: {
  reminderRef: string;
  title: string;
  description?: string;
  studentId: string | null;
  assigneeId: string;
  dueAt: string | null;
  priorityLevel?: TaskPriorityLevel;
  relatedApplicationId?: string | null;
  relatedDocumentId?: string | null;
  source?: TaskSource;
}): { created: boolean; task: PortalTaskRecord } {
  const existing = findTaskByReminderRef(input.reminderRef);
  if (existing) return { created: false, task: existing };
  const task = createPortalTask({
    title: input.title,
    description: input.description ?? null,
    studentId: input.studentId,
    assigneeId: input.assigneeId,
    createdById: null,
    dueAt: input.dueAt,
    priorityLevel: input.priorityLevel ?? "normal",
    status: "open",
    source: input.source ?? "system",
    reminderRef: input.reminderRef,
    relatedApplicationId: input.relatedApplicationId ?? null,
    relatedDocumentId: input.relatedDocumentId ?? null,
  });
  appendStaffNotification({
    title: "System task created",
    body: input.title,
  });
  return { created: true, task };
}

// Initial mirror
syncOfficerTasksMirror();