/**
 * Append-only in-memory audit trail for the demo portal.
 * Mirrors DB rules: no update/delete APIs; records are frozen after insert.
 * Production: public.audit_events + write_audit_event() + reject_audit_mutation triggers.
 */
import { auditLogs, applications, documents, students } from "@/data/mock";
import type {
  ActivityTone,
  AuditActionType,
  PortalAuditEvent,
} from "@/types/activity-ops";

const store: PortalAuditEvent[] = [];
let seeded = false;

export function toneFor(actionType: AuditActionType, outcome: string): ActivityTone {
  const o = outcome.toLowerCase();
  if (
    actionType === "document_approved" ||
    actionType === "offer_accepted" ||
    o.includes("approved") ||
    o.includes("accepted") ||
    o.includes("issued")
  ) {
    return "success";
  }
  if (
    actionType === "document_rejected" ||
    actionType === "offer_declined" ||
    o.includes("reject") ||
    o.includes("declin") ||
    o.includes("refused")
  ) {
    return "danger";
  }
  if (actionType === "application_stage_changed" || actionType.startsWith("visa")) {
    return "warning";
  }
  if (
    actionType === "application_submitted" ||
    actionType === "assessment_note" ||
    actionType === "application_created"
  ) {
    return "info";
  }
  return "neutral";
}

export function inferActionType(action: string, entity: string): AuditActionType {
  const a = action.toLowerCase();
  const e = entity.toLowerCase();
  if (a.includes("approved") && e.includes("document")) return "document_approved";
  if (a.includes("rejected") && e.includes("document")) return "document_rejected";
  if (a.includes("re-upload") || a.includes("reupload")) return "document_reupload_requested";
  if (e.includes("document")) return "document_reviewed";
  if (a.includes("submitted") && e.includes("application")) return "application_submitted";
  if (a.includes("stage") || a.includes("moved stage")) return "application_stage_changed";
  if (e.includes("application")) return "application_created";
  if (a.includes("accepted") && e.includes("offer")) return "offer_accepted";
  if (a.includes("declined") && e.includes("offer")) return "offer_declined";
  if (e.includes("offer")) return "offer_updated";
  if (e.includes("deposit")) return "deposit_updated";
  if (e.includes("cas") || e.includes("i-20")) return "cas_i20_updated";
  if (e.includes("visa")) return "visa_stage_changed";
  if (a.includes("note") || a.includes("assessment")) return "assessment_note";
  if (e.includes("task")) return "task_event";
  return "other";
}

export function inferOutcome(action: string, actionType: AuditActionType): string {
  if (actionType === "document_approved") return "Approved";
  if (actionType === "document_rejected") return "Rejected";
  if (actionType === "offer_accepted") return "Accepted";
  if (actionType === "offer_declined") return "Declined";
  if (actionType === "application_submitted") return "Submitted";
  if (actionType === "application_stage_changed") return "Stage changed";
  if (action.includes("→")) return action.split("→").pop()?.trim() || action;
  return action;
}

export type AppendAuditInput = {
  id?: string;
  actorId?: string | null;
  actorName: string;
  action: string;
  actionType?: AuditActionType;
  outcome?: string;
  entityType: string;
  entityId: string;
  studentId?: string | null;
  applicationId?: string | null;
  documentId?: string | null;
  detail?: string | null;
  metadata?: Record<string, string>;
  createdAt?: string;
  /** When false, skip writing the legacy admin auditLogs row (seed path). */
  mirrorLegacy?: boolean;
};

function insertEvent(input: AppendAuditInput): PortalAuditEvent {
  const id =
    input.id ?? `al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  if (store.some((e) => e.id === id)) {
    throw new Error("Audit event id already exists (append-only).");
  }
  const actionType = input.actionType ?? inferActionType(input.action, input.entityType);
  const outcome = input.outcome ?? inferOutcome(input.action, actionType);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const event: PortalAuditEvent = Object.freeze({
    id,
    actorId: input.actorId ?? null,
    actorName: input.actorName,
    action: input.action,
    actionType,
    outcome,
    entityType: input.entityType,
    entityId: input.entityId,
    studentId: input.studentId ?? null,
    applicationId: input.applicationId ?? null,
    documentId: input.documentId ?? null,
    detail: input.detail ?? null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    createdAt,
    tone: toneFor(actionType, outcome),
  });
  store.unshift(event);

  if (input.mirrorLegacy !== false) {
    const at = new Date(createdAt);
    auditLogs.unshift({
      id,
      user: input.actorName,
      action: input.action,
      entity: input.entityType,
      entityId: input.entityId,
      date: createdAt.slice(0, 10),
      time: Number.isNaN(at.getTime())
        ? "00:00"
        : at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
    });
  }
  return event;
}

/** Append-only. Throws if id already exists. Never mutates prior rows. */
export function appendAuditEvent(input: AppendAuditInput): PortalAuditEvent {
  ensureAuditSeeded();
  return insertEvent(input);
}

export function updateAuditEvent(): never {
  throw new Error("audit_events is append-only");
}

export function deleteAuditEvent(): never {
  throw new Error("audit_events is append-only");
}

export function listAuditEvents(): readonly PortalAuditEvent[] {
  ensureAuditSeeded();
  return store;
}

function ensureAuditSeeded() {
  if (seeded) return;
  seeded = true;

  const legacySnapshot = auditLogs.map((row) => ({ ...row }));
  for (const row of legacySnapshot) {
    const createdAt = `${row.date}T${(row.time.length === 5 ? `${row.time}:00` : row.time)}.000Z`;
    const app = applications.find((a) => a.id === row.entityId);
    const doc = documents.find((d) => d.id === row.entityId);
    const st = students.find((s) => s.caseId === row.entityId || s.id === row.entityId);
    try {
      insertEvent({
        id: row.id,
        actorName: row.user,
        action: row.action,
        entityType: row.entity,
        entityId: row.entityId,
        studentId: doc?.studentId ?? app?.studentId ?? st?.id ?? null,
        applicationId: app?.id ?? doc?.linkedApplicationId ?? null,
        documentId: doc?.id ?? null,
        createdAt: Number.isNaN(Date.parse(createdAt)) ? `${row.date}T12:00:00.000Z` : createdAt,
        mirrorLegacy: false,
      });
    } catch {
      /* skip duplicates */
    }
  }

  for (const doc of documents.filter((d) => d.status === "Approved").slice(0, 4)) {
    const st = students.find((s) => s.id === doc.studentId);
    try {
      insertEvent({
        id: `al-seed-doc-${doc.id}`,
        actorName: doc.reviewer || "System",
        action: `Approved ${doc.category} for ${st?.name ?? doc.studentId}`,
        actionType: "document_approved",
        outcome: "Approved",
        entityType: "Document",
        entityId: doc.id,
        documentId: doc.id,
        studentId: doc.studentId,
        applicationId: doc.linkedApplicationId ?? null,
        detail: doc.linkedApplicationId
          ? `Document ID: ${doc.id} · Linked Application: ${doc.linkedApplicationId}`
          : `Document ID: ${doc.id}`,
        createdAt: `${doc.uploaded}T10:15:00.000Z`,
        mirrorLegacy: true,
      });
    } catch {
      /* skip */
    }
  }

  for (const app of applications) {
    if (!app.appliedOn || app.appliedOn === "—" || app.appliedOn === "-") continue;
    if (app.status !== "Submitted" && app.status !== "Offer Received" && app.status !== "Rejected") {
      continue;
    }
    const st = students.find((s) => s.id === app.studentId);
    try {
      insertEvent({
        id: `al-seed-app-${app.id}`,
        actorName: "System",
        action: `Submitted Application to ${app.university} for ${st?.name ?? app.studentId}`,
        actionType: "application_submitted",
        outcome: "Submitted",
        entityType: "Application",
        entityId: app.id,
        applicationId: app.id,
        studentId: app.studentId,
        detail: `Application ID: ${app.id} · Stage set to "${app.status}"`,
        createdAt: `${app.appliedOn}T09:40:00.000Z`,
        mirrorLegacy: true,
      });
    } catch {
      /* skip */
    }
  }
}

ensureAuditSeeded();