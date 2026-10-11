/**
 * Private student-document storage rules.
 * Paths are stored; public object URLs are never used for previews.
 */
export const STUDENT_DOCUMENTS_BUCKET = "student-documents" as const;

/** Hard cap aligned with the private Storage bucket (50 MB). */
export const DOCUMENT_MAX_BYTES = 52_428_800;

/** Practical demo upload cap for base64 server-fn transport. */
export const DOCUMENT_UPLOAD_MAX_BYTES = 10_485_760;

export const DOCUMENT_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type DocumentAllowedMime = (typeof DOCUMENT_ALLOWED_MIME)[number];

export const DOCUMENT_PREVIEW_TTL_SEC = 60;

export function isAllowedDocumentMime(mime: string): mime is DocumentAllowedMime {
  return (DOCUMENT_ALLOWED_MIME as readonly string[]).includes(mime);
}

export function sanitizeDocumentFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "document";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "document";
}

export function studentDocumentStoragePath(
  studentId: string,
  documentId: string,
  version: number,
  fileName: string,
): string {
  const safe = sanitizeDocumentFileName(fileName);
  return `${studentId}/${documentId}/v${version}_${safe}`;
}

export function validateDocumentUpload(input: {
  mimeType: string;
  byteLength: number;
  fileName: string;
}): { ok: true; fileName: string } | { ok: false; error: string } {
  if (!input.fileName.trim()) return { ok: false, error: "A file name is required." };
  if (!isAllowedDocumentMime(input.mimeType)) {
    return {
      ok: false,
      error: "File type not allowed. Use PDF, JPEG, PNG, WebP, DOC, or DOCX.",
    };
  }
  if (input.byteLength <= 0) return { ok: false, error: "The file is empty." };
  if (input.byteLength > DOCUMENT_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large. Maximum upload size is ${Math.floor(DOCUMENT_UPLOAD_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }
  if (input.byteLength > DOCUMENT_MAX_BYTES) {
    return { ok: false, error: "File exceeds the storage bucket limit." };
  }
  return { ok: true, fileName: sanitizeDocumentFileName(input.fileName) };
}