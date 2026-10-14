/**
 * System Audit Log & Activity History — read + export only (append-only store).
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import { appendAuditEvent, listAuditEvents, inferActionType } from "@/data/immutable-audit";
import { offerAuditHistory, offerRecords } from "@/data/offers-visa";
import { encodeExport } from "@/lib/export-formats";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import type { Student } from "@/types";
import {
  ACTIVITY_ACTION_TYPES,
  type ActivityActionFilter,
  type ActivityExportPayload,
  type ActivityFilters,
  type ActivityGroup,
  type ActivityLogPayload,
  type PortalAuditEvent,
} from "@/types/activity-ops";

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

let offerSeeded = false;
function seedOfferAuditsOnce() {
  if (offerSeeded) return;
  offerSeeded = true;
  for (const o of offerAuditHistory) {
    const offer = o.offerId ? offerRecords.find((x) => x.id === o.offerId) : null;
    try {
      appendAuditEvent({
        id: `al-oa-${o.id}`,
        actorId: o.actorId,
        actorName: o.actorName,
        action: o.action,
        actionType: inferActionType(o.action, o.entity),
        entityType: o.entity,
        entityId: o.entityId,
        applicationId: offer?.applicationId ?? null,
        studentId: offer?.studentId ?? null,
        detail: o.note,
        createdAt: o.at,
        mirrorLegacy: false,
      });
    } catch {
      /* already present */
    }
  }
}

function actionMatches(ev: PortalAuditEvent, filter: ActivityActionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "document") return ev.actionType.startsWith("document_");
  if (filter === "application") return ev.actionType.startsWith("application_");
  if (filter === "offer")
    return (
      ev.actionType.startsWith("offer_") ||
      ev.actionType === "deposit_updated" ||
      ev.actionType === "cas_i20_updated"
    );
  if (filter === "visa") return ev.actionType.startsWith("visa_");
  if (filter === "note") return ev.actionType === "assessment_note";
  if (filter === "task") return ev.actionType === "task_event";
  return ev.actionType === "other";
}

function dayLabel(dayKey: string, todayKey: string, yesterdayKey: string): string {
  if (dayKey === todayKey) return `Today — ${formatDayHeading(dayKey)}`;
  if (dayKey === yesterdayKey) return `Yesterday — ${formatDayHeading(dayKey)}`;
  return formatDayHeading(dayKey);
}

function formatDayHeading(dayKey: string): string {
  const d = new Date(`${dayKey}T12:00:00.000Z`);
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

function shiftDay(key: string, delta: number): string {
  const ms = Date.parse(`${key}T12:00:00.000Z`) + delta * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function filterEvents(session: TrustedSession, data: ActivityFilters): PortalAuditEvent[] {
  seedOfferAuditsOnce();
  const students = visibleStudents(session);
  const studentIds = new Set(students.map((s) => s.id));
  const actionType: ActivityActionFilter =
    data.actionType && ACTIVITY_ACTION_TYPES.some((t) => t.key === data.actionType)
      ? data.actionType
      : "all";
  const q = data.q?.trim().toLowerCase();
  const dateFrom = data.dateFrom?.trim() || null;
  const dateTo = data.dateTo?.trim() || null;
  const studentId = data.studentId?.trim() || null;
  const applicationId = data.applicationId?.trim() || null;

  return listAuditEvents()
    .filter((ev) => {
      if (ev.studentId && !studentIds.has(ev.studentId)) return false;
      if (!ev.studentId && session.role === "consultant") {
        // Allow system/admin events without student only for admins.
        return false;
      }
      if (!actionMatches(ev, actionType)) return false;
      const day = ev.createdAt.slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (studentId && ev.studentId !== studentId) return false;
      if (applicationId && ev.applicationId !== applicationId) return false;
      if (q) {
        const hay = [
          ev.action,
          ev.actorName,
          ev.outcome,
          ev.entityId,
          ev.applicationId,
          ev.documentId,
          ev.detail,
          ev.studentId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function buildPayload(session: TrustedSession, data: ActivityFilters): ActivityLogPayload {
  const all = filterEvents(session, data);
  const offset = Math.max(0, data.offset ?? 0);
  const limit = Math.min(100, Math.max(1, data.limit ?? 25));
  const page = all.slice(offset, offset + limit);
  const todayKey = new Date().toISOString().slice(0, 10);
  const yesterdayKey = shiftDay(todayKey, -1);

  const groupMap = new Map<string, PortalAuditEvent[]>();
  for (const ev of page) {
    const day = ev.createdAt.slice(0, 10);
    const list = groupMap.get(day) ?? [];
    list.push(ev);
    groupMap.set(day, list);
  }
  const groups: ActivityGroup[] = [...groupMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dayKey, items]) => ({
      dayKey,
      label: dayLabel(dayKey, todayKey, yesterdayKey),
      items,
    }));

  const students = visibleStudents(session);
  const studentIds = new Set(students.map((s) => s.id));
  return {
    groups,
    total: all.length,
    offset,
    limit,
    hasMore: offset + limit < all.length,
    filterOptions: {
      students: students.map((s) => ({ id: s.id, name: s.name, caseId: s.caseId })),
      applications: db.applications
        .filter((a) => studentIds.has(a.studentId))
        .map((a) => ({
          id: a.id,
          studentId: a.studentId,
          label: `${a.id} · ${a.university}`,
        })),
    },
    immutable: true,
  };
}

export const portalGetActivityLog = createServerFn({ method: "GET" })
  .validator((data: ActivityFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ActivityLogPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "activity logs");
      requireModulePermission(session, "reports", 1, "activity logs");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { buildActivityLogFromDb } = await import("@/server/ao-data");
        return await buildActivityLogFromDb(session, data);
      }

      return buildPayload(session, data);
    } catch (error) {
      toError(error);
    }
  });

export const portalExportActivityLog = createServerFn({ method: "POST" })
  .validator((data: ActivityFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ActivityExportPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "activity logs");
      requireModulePermission(session, "reports", 1, "activity logs");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      let rows: PortalAuditEvent[];
      if (usesSupabaseDataPlane(session)) {
        const { requireAoSupabaseClient, listScopedAuditEvents } = await import("@/server/ao-data");
        const client = requireAoSupabaseClient();
        rows = await listScopedAuditEvents(client, data ?? {});
      } else {
        rows = filterEvents(session, data ?? {});
      }
      const generatedAt = new Date().toISOString();
      const csvRows: (string | number | null)[][] = [
        ["Global Roots — System Audit Log"],
        ["Generated", generatedAt],
        ["Note", "Append-only; exports use the same filters and officer scope as the UI."],
        [],
        [
          "Timestamp",
          "Actor",
          "Action",
          "Outcome",
          "Entity",
          "Entity ID",
          "Student ID",
          "Application ID",
          "Document ID",
          "Detail",
        ],
        ...rows.map((ev) => [
          ev.createdAt,
          ev.actorName,
          ev.action,
          ev.outcome,
          ev.entityType,
          ev.entityId,
          ev.studentId,
          ev.applicationId,
          ev.documentId,
          ev.detail,
        ]),
      ];
      const pdfLines = csvRows.map((r) => r.map((c) => (c == null ? "" : String(c))).join(" | "));
      const encoded = encodeExport(
        "csv",
        `activity-log-${generatedAt.slice(0, 10)}`,
        csvRows,
        pdfLines,
        "System Audit Log",
      );
      return {
        filename: encoded.filename,
        mimeType: encoded.mimeType,
        contentBase64: encoded.contentBase64,
        generatedAt,
        rowCount: rows.length,
      };
    } catch (error) {
      toError(error);
    }
  });

/** Re-export for mutation sites. */
export { appendAuditEvent };
