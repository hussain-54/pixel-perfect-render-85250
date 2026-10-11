/**
 * Backend task automation rules.
 * Runs on the server (scheduler + event hooks). Uses reminderRef idempotency.
 */
import * as db from "@/data/mock";
import {
  appendTaskAudit,
  automationMeta,
  createSystemTaskIdempotent,
} from "@/data/portal-tasks";
import { offerRecords } from "@/data/offers-visa";
import { dayKeyInPortalTz, daysUntilDateKey } from "@/lib/task-time";
import type { StudentDocument } from "@/types";
import {
  DEADLINE_ALERT_DAYS,
  DOCUMENT_EXPIRY_ALERT_DAYS,
  type TaskAutomationKind,
  type TaskAutomationRunResult,
} from "@/types/tasks-ops";

const EXPIRY_CATEGORIES = new Set(["Passport", "IELTS / English Test"]);

function assigneeForStudent(studentId: string | null | undefined): string | null {
  if (!studentId) return null;
  const st = db.students.find((s) => s.id === studentId);
  return st?.consultantId ?? null;
}

function emptyByKind(): Record<TaskAutomationKind, number> {
  return {
    document_rejection: 0,
    application_deadline: 0,
    offer_expiry: 0,
    document_expiry: 0,
  };
}

/**
 * Document rejection → follow-up task (event-driven).
 * Safe to call repeatedly — reminderRef is unique per document + rejection cycle.
 */
export function automateDocumentRejectionFollowUp(input: {
  documentId: string;
  studentId: string;
  category: string;
  note?: string | null;
}): { created: boolean } {
  const assigneeId = assigneeForStudent(input.studentId);
  if (!assigneeId) return { created: false };
  const ref = `auto:doc-reject:${input.documentId}`;
  const result = createSystemTaskIdempotent({
    reminderRef: ref,
    title: `Follow up: rejected ${input.category}`,
    description: input.note?.trim()
      ? `Document rejected. Note: ${input.note.trim()}`
      : "Document rejection follow-up — request corrected upload.",
    studentId: input.studentId,
    assigneeId,
    dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    priorityLevel: "high",
    relatedDocumentId: input.documentId,
  });
  if (result.created) {
    appendTaskAudit("System", "Auto task: document rejection follow-up", result.task.id);
  }
  return { created: result.created };
}

/**
 * When a passport / language-test expiry date is recorded, create a reminder if
 * the expiry falls inside the configured alert window (or is already past).
 */
export function automateDocumentExpiryTask(doc: StudentDocument): { created: boolean } {
  if (!EXPIRY_CATEGORIES.has(doc.category)) return { created: false };
  const expiryKey = dayKeyInPortalTz(doc.expiresOn);
  if (!expiryKey) return { created: false };
  const left = daysUntilDateKey(expiryKey);
  if (left === null) return { created: false };
  if (left > DOCUMENT_EXPIRY_ALERT_DAYS) return { created: false };

  const assigneeId = assigneeForStudent(doc.studentId);
  if (!assigneeId) return { created: false };

  const ref = `auto:doc-expiry:${doc.id}:${expiryKey}`;
  const result = createSystemTaskIdempotent({
    reminderRef: ref,
    title: `${doc.category} expiry alert — ${doc.name}`,
    description:
      left < 0
        ? `Recorded expiry ${expiryKey} is past. Confirm renewal.`
        : `Expiry ${expiryKey} is within ${DOCUMENT_EXPIRY_ALERT_DAYS} days.`,
    studentId: doc.studentId,
    assigneeId,
    dueAt: `${expiryKey}T09:00:00.000Z`,
    priorityLevel: left <= 14 ? "high" : "normal",
    relatedDocumentId: doc.id,
  });
  if (result.created) {
    appendTaskAudit("System", "Auto task: document expiry", result.task.id);
  }
  return { created: result.created };
}

function scanApplicationDeadlines(byKind: Record<TaskAutomationKind, number>, errors: string[]) {
  for (const app of db.applications) {
    try {
      if (!app.deadline || app.deadline === "—" || app.deadline === "-") continue;
      const key = dayKeyInPortalTz(app.deadline);
      if (!key) continue;
      const left = daysUntilDateKey(key);
      if (left === null || left < 0 || left > DEADLINE_ALERT_DAYS) continue;
      const assigneeId = assigneeForStudent(app.studentId) ?? app.officerId;
      if (!assigneeId) continue;
      const ref = `auto:app-deadline:${app.id}:${key}`;
      const result = createSystemTaskIdempotent({
        reminderRef: ref,
        title: `Application deadline approaching — ${app.university}`,
        description: `Deadline ${key} (<${DEADLINE_ALERT_DAYS} days). Application ${app.id}.`,
        studentId: app.studentId,
        assigneeId,
        dueAt: `${key}T09:00:00.000Z`,
        priorityLevel: "high",
        relatedApplicationId: app.id,
      });
      if (result.created) {
        byKind.application_deadline += 1;
        appendTaskAudit("System", "Auto task: application deadline", result.task.id);
      }
    } catch (err) {
      errors.push(`application ${app.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function scanOfferExpiries(byKind: Record<TaskAutomationKind, number>, errors: string[]) {
  for (const offer of offerRecords) {
    try {
      if (offer.status === "accepted" || offer.status === "declined" || offer.status === "expired") {
        continue;
      }
      const key = dayKeyInPortalTz(offer.responseDeadline);
      if (!key) continue;
      const left = daysUntilDateKey(key);
      if (left === null || left < 0 || left > DEADLINE_ALERT_DAYS) continue;
      const assigneeId = assigneeForStudent(offer.studentId);
      if (!assigneeId) continue;
      const st = db.students.find((s) => s.id === offer.studentId);
      const app = db.applications.find((a) => a.id === offer.applicationId);
      const ref = `auto:offer-expiry:${offer.id}:${key}`;
      const result = createSystemTaskIdempotent({
        reminderRef: ref,
        title: `Remind ${st?.name ?? "student"}: Accept offer by ${key}`,
        description: `System generated trigger · Offer letter expiration (${app?.university ?? offer.applicationId})`,
        studentId: offer.studentId,
        assigneeId,
        dueAt: `${key}T09:00:00.000Z`,
        priorityLevel: left <= 3 ? "high" : "normal",
        relatedApplicationId: offer.applicationId,
      });
      if (result.created) {
        byKind.offer_expiry += 1;
        appendTaskAudit("System", "Auto task: offer expiry", result.task.id);
      }
    } catch (err) {
      errors.push(`offer ${offer.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function scanDocumentExpiries(byKind: Record<TaskAutomationKind, number>, errors: string[]) {
  for (const doc of db.documents) {
    try {
      const before = byKind.document_expiry;
      const { created } = automateDocumentExpiryTask(doc);
      if (created) byKind.document_expiry = before + 1;
    } catch (err) {
      errors.push(`document ${doc.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Full scheduled sweep — application deadlines, offer expiries, document expiries.
 * Document rejection is event-driven separately.
 */
export function runTaskAutomationSweep(): TaskAutomationRunResult {
  const byKind = emptyByKind();
  const errors: string[] = [];

  scanApplicationDeadlines(byKind, errors);
  scanOfferExpiries(byKind, errors);
  scanDocumentExpiries(byKind, errors);

  const created =
    byKind.application_deadline + byKind.offer_expiry + byKind.document_expiry;

  const result: TaskAutomationRunResult = {
    ranAt: new Date().toISOString(),
    created,
    skipped: 0,
    failed: errors.length,
    errors: errors.slice(0, 20),
    byKind,
  };

  automationMeta.lastRunAt = result.ranAt;
  automationMeta.lastCreated = result.created;
  automationMeta.lastSkipped = result.skipped;
  automationMeta.lastFailed = result.failed;
  automationMeta.lastErrors = result.errors;
  automationMeta.lastByKind = { ...result.byKind };
  return result;
}