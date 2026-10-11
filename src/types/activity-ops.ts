/** System Audit Log & Activity History (wireframe page 10). */

export const ACTIVITY_ACTION_TYPES = [
  { key: "all", label: "All Actions" },
  { key: "document", label: "Document reviews" },
  { key: "application", label: "Application stages / submissions" },
  { key: "offer", label: "Offers / deposits / CAS" },
  { key: "visa", label: "Visa milestones" },
  { key: "note", label: "Notes / assessments" },
  { key: "task", label: "Tasks" },
  { key: "other", label: "Other" },
] as const;

export type ActivityActionFilter = (typeof ACTIVITY_ACTION_TYPES)[number]["key"];

export type ActivityTone = "success" | "danger" | "info" | "warning" | "neutral";

export type AuditActionType =
  | "document_approved"
  | "document_rejected"
  | "document_reupload_requested"
  | "document_reviewed"
  | "application_stage_changed"
  | "application_submitted"
  | "application_created"
  | "offer_created"
  | "offer_accepted"
  | "offer_declined"
  | "offer_updated"
  | "deposit_updated"
  | "cas_i20_updated"
  | "visa_stage_changed"
  | "assessment_note"
  | "task_event"
  | "other";

export type PortalAuditEvent = {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  actionType: AuditActionType;
  outcome: string;
  entityType: string;
  entityId: string;
  studentId: string | null;
  applicationId: string | null;
  documentId: string | null;
  detail: string | null;
  metadata: Record<string, string>;
  createdAt: string;
  /** Derived presentation tone (approvals green, rejections red, etc.). */
  tone: ActivityTone;
};

export type ActivityFilters = {
  dateFrom?: string;
  dateTo?: string;
  actionType?: ActivityActionFilter;
  studentId?: string;
  applicationId?: string;
  q?: string;
  offset?: number;
  limit?: number;
};

export type ActivityGroup = {
  dayKey: string;
  label: string;
  items: PortalAuditEvent[];
};

export type ActivityLogPayload = {
  groups: ActivityGroup[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  filterOptions: {
    students: { id: string; name: string; caseId: string }[];
    applications: { id: string; label: string; studentId: string }[];
  };
  immutable: true;
};

export type ActivityExportPayload = {
  filename: string;
  mimeType: string;
  contentBase64: string;
  generatedAt: string;
  rowCount: number;
};
