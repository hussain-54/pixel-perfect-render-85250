import { appendAuditEvent } from "@/data/immutable-audit";
import { applications } from "@/data/mock";
import type { ApplicationStageHistoryRecord } from "@/types/applications-pipeline";

export const applicationStageHistory: ApplicationStageHistoryRecord[] = [];

export function appendStageHistory(row: ApplicationStageHistoryRecord) {
  applicationStageHistory.unshift(row);
  const app = applications.find((a) => a.id === row.applicationId);
  appendAuditEvent({
    id: `al-ash-${row.id}`,
    actorId: row.changedById,
    actorName: row.changedByName,
    action: `Moved stage to "${row.toStage}"`,
    actionType:
      row.toStage === "Submitted" ? "application_submitted" : "application_stage_changed",
    outcome: row.toStage,
    entityType: "Application",
    entityId: row.applicationId,
    applicationId: row.applicationId,
    studentId: app?.studentId ?? null,
    detail: row.note,
    createdAt: row.changedAt,
  });
  return row;
}

export function historyForApplication(applicationId: string) {
  return applicationStageHistory
    .filter((h) => h.applicationId === applicationId)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}
