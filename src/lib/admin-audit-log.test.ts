import { describe, expect, it } from "vitest";
import {
  ADMIN_AUDIT_LOG_LIMIT,
  mapPortalAuditEventToAdminLog,
} from "./admin-audit-log";
import type { PortalAuditEvent } from "@/types/activity-ops";

const sample = (partial: Partial<PortalAuditEvent> = {}): PortalAuditEvent => ({
  id: "ev1",
  actorId: "u1",
  actorName: "Ayesha Khan",
  action: "document.approved",
  actionType: "document_approved",
  outcome: "Approved",
  entityType: "student_document",
  entityId: "doc-1",
  studentId: "s1",
  applicationId: null,
  documentId: "doc-1",
  detail: null,
  metadata: {},
  createdAt: "2026-09-30T16:05:00.000Z",
  tone: "success",
  ...partial,
});

describe("admin audit log mapping", () => {
  it("maps live PortalAuditEvent fields onto AuditLog columns", () => {
    const log = mapPortalAuditEventToAdminLog(sample());
    expect(log).toEqual({
      id: "ev1",
      user: "Ayesha Khan",
      action: "document.approved",
      entity: "student_document",
      entityId: "doc-1",
      date: "2026-09-30",
      time: "16:05",
    });
  });

  it("handles missing actor / entity safely", () => {
    const log = mapPortalAuditEventToAdminLog(
      sample({ actorName: "  ", entityType: "", entityId: "", action: "" }),
    );
    expect(log.user).toBe("System");
    expect(log.action).toBe("Approved");
    expect(log.entity).toBe("—");
    expect(log.entityId).toBe("—");
  });

  it("documents the admin table row cap (not a fabricated event source)", () => {
    expect(ADMIN_AUDIT_LOG_LIMIT).toBe(100);
  });
});
