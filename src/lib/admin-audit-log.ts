/**
 * Map authorized PortalAuditEvent rows onto the admin AuditLog table shape.
 * Live source: listScopedAuditEvents / audit_events (RLS). Demo: mock auditLogs.
 */
import type { AuditLog } from "@/types";
import type { PortalAuditEvent } from "@/types/activity-ops";

function formatAuditTimeUtc(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso.slice(0, 10) || "—", time: "—" };
  }
  const date = d.toISOString().slice(0, 10);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

export function mapPortalAuditEventToAdminLog(ev: PortalAuditEvent): AuditLog {
  const { date, time } = formatAuditTimeUtc(ev.createdAt);
  return {
    id: ev.id,
    user: ev.actorName?.trim() || "System",
    action: ev.action?.trim() || ev.outcome || "—",
    entity: ev.entityType?.trim() || "—",
    entityId: ev.entityId?.trim() || "—",
    date,
    time,
  };
}

/** Cap admin table rows; activity workspace remains the full filtered explorer. */
export const ADMIN_AUDIT_LOG_LIMIT = 100;
