import type { DocumentStatus } from "@/types";

/** Documents with an expiry inside this window appear under Expiring Soon. */
export const EXPIRING_WITHIN_DAYS = 90;

export const DOCUMENT_QUEUE_TABS = [
  { key: "pending", label: "Pending Verification" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "expiring", label: "Expiring Soon" },
] as const;

export type DocumentQueueTab = (typeof DOCUMENT_QUEUE_TABS)[number]["key"];

export type DocumentReviewAction = "approve" | "reject" | "request_reupload";

/** Destination checklists. Only exact country keys are used — no wildcard fallback in the UI. */
export const DOCUMENT_CHECKLISTS: Record<string, readonly string[]> = {
  UK: [
    "Passport",
    "Academic Transcripts",
    "Academic Certificates",
    "IELTS / English Test",
    "SOP",
    "CV",
    "Recommendation Letter",
    "Financial Documents",
  ],
  Germany: [
    "Passport",
    "Academic Transcripts",
    "Academic Certificates",
    "IELTS / English Test",
    "SOP",
    "CV",
  ],
  Italy: ["Passport", "Academic Transcripts", "Portfolio", "IELTS / English Test", "SOP", "Photographs"],
  Canada: ["Passport", "Academic Transcripts", "IELTS / English Test", "SOP", "Financial Documents"],
  USA: ["Passport", "Academic Transcripts", "IELTS / English Test", "SOP", "Financial Documents"],
  Australia: ["Passport", "Academic Transcripts", "IELTS / English Test", "SOP", "CV"],
};

/** Exact destination match only — unconfigured countries return null. */
export function checklistForCountry(country: string): readonly string[] | null {
  const key = country.trim();
  if (!key) return null;
  return DOCUMENT_CHECKLISTS[key] ?? null;
}

export function hasChecklistForCountry(country: string): boolean {
  return checklistForCountry(country) !== null;
}

export type DocumentReviewRecord = {
  id: string;
  documentId: string;
  action: DocumentReviewAction | "dashboard_review";
  fromStatus: DocumentStatus;
  toStatus: DocumentStatus;
  actorId: string | null;
  actorName: string;
  at: string;
  note: string | null;
  version: number;
};

export type DocumentQueueRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  destination: string;
  name: string;
  category: string;
  status: DocumentStatus;
  /** Queue label. "Re-uploaded" when a newer file is waiting. */
  displayStatus: string;
  uploaded: string;
  uploadedBy: string;
  waitDays: number | null;
  waitLabel: string;
  expiresOn: string | null;
  expiringSoon: boolean;
  version: number;
  versionLabel: string;
  awaitingUpload: boolean;
  linkedApplicationId: string | null;
  linkedApplicationLabel: string | null;
  comment: string | null;
  reviewer: string | null;
  hasPrivateFile: boolean;
  storagePath: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
};

export type DocumentQueueFilters = {
  q?: string;
  tab?: DocumentQueueTab;
};

export type DocumentQueuePayload = {
  rows: DocumentQueueRow[];
  counts: Record<DocumentQueueTab, number>;
  students: { id: string; name: string; caseId: string; destination: string }[];
};

export type DocumentVersionSummary = {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedByName: string;
  uploadedAt: string;
  storagePath: string;
};

export type DocumentInspectionPayload = {
  document: DocumentQueueRow;
  history: DocumentReviewRecord[];
  versions: DocumentVersionSummary[];
};

export type DocumentUploadInput = {
  studentId: string;
  /**
   * Existing document requirement id.
   * Required for student uploads (students cannot create requirements).
   * Staff may omit to ensure/create by category on the staff upload path.
   */
  documentId?: string;
  category: string;
  fileName: string;
  mimeType: string;
  /** Base64 file bytes (no data-URL prefix). */
  contentBase64: string;
  /** Staff-only; ignored for student uploads. */
  expiresOn?: string;
  /** Staff-only; ignored for student uploads. */
  linkedApplicationId?: string;
  idempotencyKey?: string;
};

export type DocumentPreviewIssue = {
  token: string;
  expiresAt: string;
  mimeType: string;
  fileName: string;
  ttlSec: number;
  /** Present only for Supabase-backed objects; never a permanent public URL. */
  signedUrl: string | null;
};

export type DocumentPreviewPayload = {
  mimeType: string;
  fileName: string;
  contentBase64: string;
  expiresAt: string;
};

export type DocumentChecklistItem = {
  category: string;
  documentId: string | null;
  status: DocumentStatus | null;
  awaitingUpload: boolean;
  onFile: boolean;
};

export type DocumentChecklistPayload = {
  studentId: string;
  studentName: string;
  destination: string;
  items: DocumentChecklistItem[];
};

export type RequestDocumentInput = {
  studentId: string;
  category: string;
  idempotencyKey?: string;
};

export type ReviewQueueDocumentInput = {
  documentId: string;
  action: DocumentReviewAction;
  note?: string;
};
