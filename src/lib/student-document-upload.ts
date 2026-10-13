/**
 * Pure checks for student document uploads against an existing requirement row.
 * Ownership must be established from the trusted student record, not client studentId.
 */

export type ExistingStudentDocumentRef = {
  id: string;
  student_id: string;
  doc_type: string;
  current_version: number;
};

export type StudentUploadTargetResult =
  | { ok: true; target: ExistingStudentDocumentRef }
  | { ok: false; status: 400 | 403 | 404; message: string };

/**
 * Students may only upload/replace files for an existing staff-created requirement.
 * Does not create requirements; does not authorize by client-supplied studentId alone.
 */
export function resolveExistingStudentUploadTarget(input: {
  documentId: string | undefined | null;
  category: string;
  /** Authenticated student's id from DB (profile link), never trusted client claim alone. */
  ownerStudentId: string;
  existing: ExistingStudentDocumentRef | null;
}): StudentUploadTargetResult {
  const documentId = input.documentId?.trim() ?? "";
  const category = input.category.trim();
  const ownerStudentId = input.ownerStudentId.trim();

  if (!documentId) {
    return { ok: false, status: 400, message: "A document id is required to upload." };
  }
  if (!category) {
    return { ok: false, status: 400, message: "Document category is required." };
  }
  if (!ownerStudentId) {
    return { ok: false, status: 403, message: "Student record could not be verified." };
  }
  if (!input.existing) {
    return { ok: false, status: 404, message: "Document not found." };
  }
  if (input.existing.id !== documentId) {
    return { ok: false, status: 404, message: "Document not found." };
  }
  if (input.existing.student_id !== ownerStudentId) {
    return { ok: false, status: 403, message: "You do not have access to this document." };
  }
  if (input.existing.doc_type.trim().toLowerCase() !== category.toLowerCase()) {
    return { ok: false, status: 400, message: "Document type does not match this requirement." };
  }
  return { ok: true, target: input.existing };
}
