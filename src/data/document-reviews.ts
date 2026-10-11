import type { DocumentStatus } from "@/types";
import type { DocumentReviewRecord } from "@/types/documents-queue";
import { appendAuditEvent } from "@/data/immutable-audit";
import { documents } from "@/data/mock";
import { STUDENT_DOCUMENTS_BUCKET } from "@/lib/document-storage";

export type DocumentVersionRecord = {
  id: string;
  documentId: string;
  versionNumber: number;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedById: string | null;
  uploadedByName: string;
  uploadedAt: string;
  sha256: string | null;
};

export type DocumentPreviewGrant = {
  token: string;
  documentId: string;
  versionId: string;
  storagePath: string;
  mimeType: string;
  fileName: string;
  expiresAt: number;
  issuedToEmail: string;
};

export const documentVersions: DocumentVersionRecord[] = [];
export const documentReviews: DocumentReviewRecord[] = [];
const previewGrants = new Map<string, DocumentPreviewGrant>();

export function appendDocumentVersion(row: DocumentVersionRecord) {
  documentVersions.unshift(row);
  return row;
}

export function versionsForDocument(documentId: string) {
  return documentVersions
    .filter((v) => v.documentId === documentId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export function latestVersion(documentId: string) {
  return versionsForDocument(documentId)[0] ?? null;
}

export function appendDocumentReview(row: DocumentReviewRecord) {
  documentReviews.unshift(row);
  const action =
    row.action === "approve"
      ? "Approved document"
      : row.action === "reject"
        ? "Rejected document"
        : row.action === "request_reupload"
          ? "Requested document re-upload"
          : "Reviewed document";
  const doc = documents.find((d) => d.id === row.documentId);
  appendAuditEvent({
    id: `al-doc-${row.id}`,
    actorId: row.actorId,
    actorName: row.actorName,
    action,
    actionType:
      row.action === "approve"
        ? "document_approved"
        : row.action === "reject"
          ? "document_rejected"
          : row.action === "request_reupload"
            ? "document_reupload_requested"
            : "document_reviewed",
    outcome: row.action,
    entityType: "Document",
    entityId: row.documentId,
    documentId: row.documentId,
    studentId: doc?.studentId ?? null,
    applicationId: doc?.linkedApplicationId ?? null,
    detail: row.note ?? null,
    createdAt: row.at,
  });
  return row;
}

export function reviewsForDocument(documentId: string) {
  return documentReviews
    .filter((r) => r.documentId === documentId)
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function issuePreviewGrant(input: Omit<DocumentPreviewGrant, "token"> & { token: string }) {
  previewGrants.set(input.token, input);
  return input;
}

export function consumePreviewGrant(token: string, email: string): DocumentPreviewGrant | null {
  const grant = previewGrants.get(token);
  if (!grant) return null;
  if (grant.expiresAt < Date.now()) {
    previewGrants.delete(token);
    return null;
  }
  if (grant.issuedToEmail !== email) return null;
  return grant;
}

export function defaultBucket() {
  return STUDENT_DOCUMENTS_BUCKET;
}