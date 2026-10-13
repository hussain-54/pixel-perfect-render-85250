/**
 * Authorized document verification queue + private file upload/preview.
 * Review decisions append history and require a reason to reject or request a re-upload.
 * File bytes are stored privately (path + metadata); public object URLs are never returned.
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import {
  appendDocumentReview,
  appendDocumentVersion,
  consumePreviewGrant,
  issuePreviewGrant,
  latestVersion,
  reviewsForDocument,
  versionsForDocument,
} from "@/data/document-reviews";
import {
  DOCUMENT_PREVIEW_TTL_SEC,
  STUDENT_DOCUMENTS_BUCKET,
  studentDocumentStoragePath,
  validateDocumentUpload,
} from "@/lib/document-storage";
import { resolveExistingStudentUploadTarget } from "@/lib/student-document-upload";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  newPreviewToken,
  readPrivateDocumentBlob,
  writePrivateDocumentBlob,
} from "@/server/document-blob-store";
import {
  automateDocumentExpiryTask,
  automateDocumentRejectionFollowUp,
} from "@/server/task-automation";
import { createServerSupabase } from "@/server/supabase";
import type { Student, StudentDocument } from "@/types";
import {
  EXPIRING_WITHIN_DAYS,
  checklistForCountry,
  type DocumentChecklistPayload,
  type DocumentInspectionPayload,
  type DocumentReviewAction,
  type DocumentPreviewIssue,
  type DocumentPreviewPayload,
  type DocumentQueueFilters,
  type DocumentQueuePayload,
  type DocumentQueueRow,
  type DocumentQueueTab,
  type DocumentUploadInput,
  type RequestDocumentInput,
  type ReviewQueueDocumentInput,
} from "@/types/documents-queue";
import { getRequestHeader } from "@tanstack/react-start/server";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
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
  if (session.role === "student") {
    const email = session.email.toLowerCase();
    return db.students.filter((s) => s.email.toLowerCase() === email && !s.archived);
  }
  return [];
}

function assertStudentVisible(session: TrustedSession, studentId: string) {
  if (!visibleStudents(session).some((s) => s.id === studentId)) {
    throw new AuthError("You do not have access to this student record.", 403);
  }
}

function visibleDocuments(session: TrustedSession): StudentDocument[] {
  const ids = new Set(visibleStudents(session).map((s) => s.id));
  return db.documents.filter((d) => ids.has(d.studentId));
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
}

function waitDays(uploaded: string): number | null {
  if (!uploaded) return null;
  const d = new Date(uploaded);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.max(0, Math.round((today.getTime() - startOfDay(d).getTime()) / 86_400_000));
}

function waitLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function isExpiring(doc: StudentDocument): boolean {
  if (doc.status === "Rejected") return false;
  const left = daysUntil(doc.expiresOn);
  return left !== null && left <= EXPIRING_WITHIN_DAYS;
}

function inTab(doc: StudentDocument, tab: DocumentQueueTab): boolean {
  if (tab === "pending")
    return doc.status === "Pending Review" || doc.status === "Needs Correction";
  if (tab === "approved") return doc.status === "Approved";
  if (tab === "rejected") return doc.status === "Rejected";
  return isExpiring(doc);
}

function displayStatus(doc: StudentDocument): string {
  if (doc.awaitingUpload) return "Requested";
  if ((doc.version ?? 1) > 1 && doc.status === "Pending Review") return "Re-uploaded";
  return doc.status;
}

function hasPrivateFile(doc: StudentDocument): boolean {
  // Path metadata present — previous versions remain previewable while awaiting a re-upload.
  return Boolean(doc.storagePath);
}

function actorMeta(session: TrustedSession) {
  const cid = consultantScopeId(session);
  const consultant = cid ? db.consultants.find((c) => c.id === cid) : undefined;
  const admin = rolesAtLeastAdmin(session.role);
  const student =
    session.role === "student"
      ? db.students.find((s) => s.email.toLowerCase() === session.email.toLowerCase())
      : undefined;
  return {
    id: consultant?.id ?? session.userId ?? student?.id ?? null,
    name: consultant?.name ?? student?.name ?? (admin ? "Admin" : session.email),
  };
}

function toRow(doc: StudentDocument, students: Student[]): DocumentQueueRow {
  const st = students.find((s) => s.id === doc.studentId);
  const version = doc.version ?? 1;
  const app = doc.linkedApplicationId
    ? db.applications.find((a) => a.id === doc.linkedApplicationId)
    : undefined;
  const waited = waitDays(doc.uploaded);
  return {
    id: doc.id,
    studentId: doc.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    destination: st?.destination ?? "—",
    name: doc.name,
    category: doc.category,
    status: doc.status,
    displayStatus: displayStatus(doc),
    uploaded: doc.uploaded,
    uploadedBy: doc.uploadedBy || st?.name || "Student",
    waitDays: waited,
    waitLabel: waitLabel(waited),
    expiresOn: doc.expiresOn ?? null,
    expiringSoon: isExpiring(doc),
    version,
    versionLabel: doc.awaitingUpload
      ? "Not uploaded"
      : version === 1
        ? "v1 (Initial)"
        : `v${version}`,
    awaitingUpload: Boolean(doc.awaitingUpload),
    linkedApplicationId: app?.id ?? doc.linkedApplicationId ?? null,
    linkedApplicationLabel: app ? `${app.id} · ${app.university}` : null,
    comment: doc.comment ?? null,
    reviewer: doc.reviewer ?? null,
    hasPrivateFile: hasPrivateFile(doc),
    storagePath: doc.storagePath ?? null,
    mimeType: doc.mimeType ?? null,
    fileSizeBytes: doc.fileSizeBytes ?? null,
  };
}

function nextDocumentId() {
  const nums = db.documents.map((d) => {
    const match = /^d(\d+)$/.exec(d.id);
    return match ? Number(match[1]) : 0;
  });
  return `d${Math.max(0, ...nums) + 1}`;
}

function findByCategory(studentId: string, category: string) {
  const key = category.trim().toLowerCase();
  return db.documents.find(
    (d) => d.studentId === studentId && d.category.trim().toLowerCase() === key,
  );
}

function bearerToken(): string | undefined {
  const authHeader = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
}

const requestCache = new Map<string, string>();
const uploadCache = new Map<string, string>();

export const portalGetDocumentQueue = createServerFn({ method: "GET" })
  .validator((data: DocumentQueueFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<DocumentQueuePayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      let students = visibleStudents(session);
      let docs = visibleDocuments(session);
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          listVisibleStudentsDb,
          listDocsForStudents,
          enrichDocumentsWithVersions,
        } = await import("@/server/ao-data");
        const client = requireAoSupabaseClient();
        students = await listVisibleStudentsDb(client, session);
        docs = await enrichDocumentsWithVersions(
          client,
          await listDocsForStudents(
            client,
            students.map((s) => s.id),
          ),
        );
      }
      const tab: DocumentQueueTab = data.tab ?? "pending";
      const q = data.q?.trim().toLowerCase();

      const counts: DocumentQueuePayload["counts"] = {
        pending: docs.filter((d) => inTab(d, "pending")).length,
        approved: docs.filter((d) => inTab(d, "approved")).length,
        rejected: docs.filter((d) => inTab(d, "rejected")).length,
        expiring: docs.filter((d) => inTab(d, "expiring")).length,
      };

      let rows = docs.filter((d) => inTab(d, tab));
      if (q) {
        rows = rows.filter((d) => {
          const st = students.find((s) => s.id === d.studentId);
          return (
            d.name.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q) ||
            (st?.name ?? "").toLowerCase().includes(q) ||
            (st?.caseId ?? "").toLowerCase().includes(q)
          );
        });
      }

      const mapped = rows.map((d) => toRow(d, students));
      mapped.sort((a, b) => {
        if (tab === "pending") {
          const aw = a.waitDays ?? -1;
          const bw = b.waitDays ?? -1;
          return bw - aw;
        }
        if (tab === "expiring") {
          return (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999");
        }
        return (b.uploaded || "").localeCompare(a.uploaded || "");
      });

      return {
        rows: mapped,
        counts,
        students: students.map((s) => ({
          id: s.id,
          name: s.name,
          caseId: s.caseId,
          destination: s.destination,
        })),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetDocumentInspection = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<DocumentInspectionPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { requireAoSupabaseClient, getScopedDocumentRow, enrichDocumentsWithVersions } =
          await import("@/server/ao-data");
        const { listDocumentVersions, listDocumentReviews } = await import("@/services/db");
        const { mapDocumentRow } = await import("@/lib/ao-mappers");
        const client = requireAoSupabaseClient();
        const { row, student } = await getScopedDocumentRow(client, session, data.id);
        const [docEnriched] = await enrichDocumentsWithVersions(client, [mapDocumentRow(row)]);
        const versions = await listDocumentVersions(client, row.id);
        const reviewRows = await listDocumentReviews(client, row.id);
        const reviewerIds = reviewRows
          .map((r) => r.reviewer_id)
          .filter((x): x is string => Boolean(x));
        const uploaderIds = versions
          .map((v) => v.uploaded_by)
          .filter((x): x is string => Boolean(x));
        const { namesForIds } = await import("@/server/ao-data");
        const names = await namesForIds(client, [...reviewerIds, ...uploaderIds]);

        let prevStatus: DocumentQueueRow["status"] = "Pending Review";
        const sortedReviews = [...reviewRows].sort((a, b) =>
          a.reviewed_at.localeCompare(b.reviewed_at),
        );
        const history = sortedReviews
          .map((r) => {
            const toStatus: DocumentQueueRow["status"] =
              r.action === "approved"
                ? "Approved"
                : r.action === "rejected"
                  ? "Rejected"
                  : "Needs Correction";
            const uiAction =
              r.action === "approved"
                ? "approve"
                : r.action === "rejected"
                  ? "reject"
                  : "request_reupload";
            const entry = {
              id: r.id,
              documentId: r.document_id,
              action: uiAction as DocumentReviewAction,
              fromStatus: prevStatus,
              toStatus,
              actorId: r.reviewer_id,
              actorName: (r.reviewer_id && names.get(r.reviewer_id)) || "Officer",
              at: r.reviewed_at,
              note: r.comments,
              version: 1,
            };
            prevStatus = toStatus;
            return entry;
          })
          .reverse();

        return {
          document: docEnriched
            ? toRow(docEnriched, [student])
            : toRow(mapDocumentRow(row), [student]),
          history,
          versions: versions.map((v) => ({
            id: v.id,
            versionNumber: v.version_number,
            fileName: v.file_name,
            mimeType: v.mime_type ?? "application/octet-stream",
            fileSizeBytes: v.file_size_bytes ?? 0,
            uploadedByName: (v.uploaded_by && names.get(v.uploaded_by)) || "Student",
            uploadedAt: v.uploaded_at,
            storagePath: v.storage_path,
          })),
        };
      }

      const doc = visibleDocuments(session).find((d) => d.id === data.id);
      if (!doc) throw new AuthError("Document not found.", 404);
      return {
        document: toRow(doc, visibleStudents(session)),
        history: reviewsForDocument(doc.id),
        versions: versionsForDocument(doc.id).map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          fileName: v.fileName,
          mimeType: v.mimeType,
          fileSizeBytes: v.fileSizeBytes,
          uploadedByName: v.uploadedByName,
          uploadedAt: v.uploadedAt,
          storagePath: v.storagePath,
        })),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetDocumentChecklist = createServerFn({ method: "GET" })
  .validator((data: { studentId: string }) => data)
  .handler(async ({ data }): Promise<DocumentChecklistPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      assertStudentVisible(session, data.studentId);
      const student = visibleStudents(session).find((s) => s.id === data.studentId);
      if (!student) throw new AuthError("Student not found.", 404);
      const template = checklistForCountry(student.destination);
      if (!template) {
        return {
          studentId: student.id,
          studentName: student.name,
          destination: student.destination,
          items: [],
        };
      }
      const items = template.map((category) => {
        const existing = findByCategory(student.id, category);
        return {
          category,
          documentId: existing?.id ?? null,
          status: existing?.status ?? null,
          awaitingUpload: Boolean(existing?.awaitingUpload),
          onFile: Boolean(existing && !existing.awaitingUpload),
        };
      });
      return {
        studentId: student.id,
        studentName: student.name,
        destination: student.destination,
        items,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalRequestDocument = createServerFn({ method: "POST" })
  .validator((data: RequestDocumentInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { requireAoSupabaseClient, assertStudentVisibleDb } =
          await import("@/server/ao-data");
        const { ensureStudentDocument } = await import("@/services/db");
        const { mapDocumentRow } = await import("@/lib/ao-mappers");
        const client = requireAoSupabaseClient();
        const student = await assertStudentVisibleDb(client, session, data.studentId);

        const category = data.category.trim();
        const allowed = checklistForCountry(student.destination);
        if (!allowed) {
          throw new AuthError("No checklist is configured for this destination.", 400);
        }
        if (!category || !allowed.some((item) => item.toLowerCase() === category.toLowerCase())) {
          throw new AuthError("That document is not on this destination checklist.", 400);
        }
        const canonical = allowed.find((item) => item.toLowerCase() === category.toLowerCase())!;

        const { data: existingRow, error: existingErr } = await client
          .from("student_documents")
          .select("*")
          .eq("student_id", student.id)
          .eq("doc_type", canonical)
          .maybeSingle();
        if (existingErr) throw new Error(existingErr.message);
        if (existingRow) {
          return {
            ok: true as const,
            duplicate: true as const,
            document: toRow(mapDocumentRow(existingRow), [student]),
          };
        }

        // Verified remote student_documents columns only (no awaiting_upload / linked_application_id).
        const created = await ensureStudentDocument(client, {
          student_id: student.id,
          doc_type: canonical,
          label: `${canonical} (requested)`,
          status: "needs_correction",
        });
        return {
          ok: true as const,
          duplicate: false as const,
          document: toRow(mapDocumentRow(created), [student]),
        };
      }

      assertStudentVisible(session, data.studentId);
      const student = db.students.find((s) => s.id === data.studentId);
      if (!student) throw new AuthError("Student not found.", 404);

      const category = data.category.trim();
      const allowed = checklistForCountry(student.destination);
      if (!allowed) {
        throw new AuthError("No checklist is configured for this destination.", 400);
      }
      if (!category || !allowed.some((item) => item.toLowerCase() === category.toLowerCase())) {
        throw new AuthError("That document is not on this destination checklist.", 400);
      }
      const canonical = allowed.find((item) => item.toLowerCase() === category.toLowerCase())!;

      if (data.idempotencyKey) {
        const cached = requestCache.get(data.idempotencyKey);
        if (cached) {
          const existing = db.documents.find((d) => d.id === cached);
          if (existing) {
            return {
              ok: true as const,
              duplicate: true as const,
              document: toRow(existing, visibleStudents(session)),
            };
          }
        }
      }

      const existing = findByCategory(student.id, canonical);
      if (existing) {
        if (data.idempotencyKey) requestCache.set(data.idempotencyKey, existing.id);
        return {
          ok: true as const,
          duplicate: true as const,
          document: toRow(existing, visibleStudents(session)),
        };
      }

      const actor = actorMeta(session);
      const doc: StudentDocument = {
        id: nextDocumentId(),
        studentId: student.id,
        name: `${canonical} (requested)`,
        category: canonical,
        uploaded: new Date().toISOString().slice(0, 10),
        status: "Needs Correction",
        comment: "Please upload this document.",
        reviewer: actor.name,
        version: 1,
        awaitingUpload: true,
        uploadedBy: student.name,
        storageBucket: STUDENT_DOCUMENTS_BUCKET,
        storagePath: null,
      };
      db.documents.push(doc);
      if (data.idempotencyKey) requestCache.set(data.idempotencyKey, doc.id);
      appendDocumentReview({
        id: `drv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        documentId: doc.id,
        action: "request_reupload",
        fromStatus: "Needs Correction",
        toStatus: "Needs Correction",
        actorId: actor.id,
        actorName: actor.name,
        at: new Date().toISOString(),
        note: "Checklist request: please upload this document.",
        version: 1,
      });

      return {
        ok: true as const,
        duplicate: false as const,
        document: toRow(doc, visibleStudents(session)),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalReviewQueueDocument = createServerFn({ method: "POST" })
  .validator((data: ReviewQueueDocumentInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);

      const note = data.note?.trim() ?? "";

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          getScopedDocumentRow,
          enrichDocumentsWithVersions,
          namesForIds,
        } = await import("@/server/ao-data");
        const { createDocumentReview, getStudentDocumentById, listDocumentReviews } =
          await import("@/services/db");
        const { mapDocumentRow } = await import("@/lib/ao-mappers");
        const client = requireAoSupabaseClient();
        const { row, student } = await getScopedDocumentRow(client, session, data.documentId);

        if (data.action === "approve") {
          if (row.awaiting_upload || row.current_version <= 0) {
            throw new AuthError("No private file has been uploaded yet.", 400);
          }
        } else if (
          (data.action === "reject" || data.action === "request_reupload") &&
          note.length < 3
        ) {
          throw new AuthError(
            data.action === "reject"
              ? "A rejection reason is required."
              : "A note is required when requesting a re-upload.",
            400,
          );
        }

        const dbAction =
          data.action === "approve"
            ? "approved"
            : data.action === "reject"
              ? "rejected"
              : "reupload_requested";
        await createDocumentReview(client, {
          documentId: row.id,
          reviewerId: session.userId ?? null,
          action: dbAction,
          comments: note || null,
        });

        // apply_document_review trigger updates student_documents.status; reload it.
        const refreshedRow = await getStudentDocumentById(client, row.id);
        const refreshedDoc = refreshedRow ?? row;
        const [enriched] = await enrichDocumentsWithVersions(client, [
          mapDocumentRow(refreshedDoc),
        ]);

        if (data.action === "approve") {
          const { nextJourneyStageIfAdvanced } = await import("@/lib/journey-stage");
          const { data: journeyRow } = await client
            .from("students")
            .select("journey_stage")
            .eq("id", student.id)
            .maybeSingle();
          const nextStage = nextJourneyStageIfAdvanced(
            journeyRow?.journey_stage,
            "documents_under_review",
          );
          if (nextStage) {
            await client.from("students").update({ journey_stage: nextStage }).eq("id", student.id);
          }
        }

        const reviewRows = await listDocumentReviews(client, row.id);
        const names = await namesForIds(
          client,
          reviewRows.map((r) => r.reviewer_id).filter((x): x is string => Boolean(x)),
        );
        let prevStatus: DocumentQueueRow["status"] = "Pending Review";
        const history = [...reviewRows]
          .sort((a, b) => a.reviewed_at.localeCompare(b.reviewed_at))
          .map((r) => {
            const toStatus: DocumentQueueRow["status"] =
              r.action === "approved"
                ? "Approved"
                : r.action === "rejected"
                  ? "Rejected"
                  : "Needs Correction";
            const uiAction: DocumentReviewAction =
              r.action === "approved"
                ? "approve"
                : r.action === "rejected"
                  ? "reject"
                  : "request_reupload";
            const entry = {
              id: r.id,
              documentId: r.document_id,
              action: uiAction,
              fromStatus: prevStatus,
              toStatus,
              actorId: r.reviewer_id,
              actorName: (r.reviewer_id && names.get(r.reviewer_id)) || "Officer",
              at: r.reviewed_at,
              note: r.comments,
              version: 1,
            };
            prevStatus = toStatus;
            return entry;
          })
          .reverse();

        return {
          ok: true as const,
          unchanged: false as const,
          document: toRow(enriched ?? mapDocumentRow(refreshedDoc), [student]),
          history,
        };
      }

      const doc = visibleDocuments(session).find((d) => d.id === data.documentId);
      if (!doc) throw new AuthError("Document not found.", 404);

      const actor = actorMeta(session);
      const fromStatus = doc.status;

      if (data.action === "approve") {
        if (doc.awaitingUpload || !hasPrivateFile(doc)) {
          throw new AuthError("No private file has been uploaded yet.", 400);
        }
        if (doc.status === "Approved") {
          return {
            ok: true as const,
            unchanged: true as const,
            document: toRow(doc, visibleStudents(session)),
            history: reviewsForDocument(doc.id),
          };
        }
        doc.status = "Approved";
        delete doc.comment;
        doc.reviewer = actor.name;
      } else if (data.action === "reject") {
        if (note.length < 3) {
          throw new AuthError("A rejection reason is required.", 400);
        }
        if (doc.status === "Rejected" && doc.comment === note) {
          return {
            ok: true as const,
            unchanged: true as const,
            document: toRow(doc, visibleStudents(session)),
            history: reviewsForDocument(doc.id),
          };
        }
        doc.status = "Rejected";
        doc.comment = note;
        doc.reviewer = actor.name;
        doc.awaitingUpload = false;
        automateDocumentRejectionFollowUp({
          documentId: doc.id,
          studentId: doc.studentId,
          category: doc.category,
          note,
        });
      } else if (data.action === "request_reupload") {
        if (note.length < 3) {
          throw new AuthError("A note is required when requesting a re-upload.", 400);
        }
        if (doc.awaitingUpload) {
          throw new AuthError("This document is already waiting for an upload.", 400);
        }
        if (doc.status === "Needs Correction" && doc.comment === note) {
          return {
            ok: true as const,
            unchanged: true as const,
            document: toRow(doc, visibleStudents(session)),
            history: reviewsForDocument(doc.id),
          };
        }
        doc.status = "Needs Correction";
        doc.comment = note;
        doc.reviewer = actor.name;
        doc.awaitingUpload = true;
      } else {
        throw new AuthError("Unknown review action.", 400);
      }

      appendDocumentReview({
        id: `drv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        documentId: doc.id,
        action: data.action,
        fromStatus,
        toStatus: doc.status,
        actorId: actor.id,
        actorName: actor.name,
        at: new Date().toISOString(),
        note: note || null,
        version: doc.version ?? 1,
      });

      return {
        ok: true as const,
        unchanged: false as const,
        document: toRow(doc, visibleStudents(session)),
        history: reviewsForDocument(doc.id),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalUploadStudentDocument = createServerFn({ method: "POST" })
  .validator((data: DocumentUploadInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);

      let bytes: Buffer;
      try {
        bytes = Buffer.from(data.contentBase64, "base64");
      } catch {
        throw new AuthError("Invalid file payload.", 400);
      }

      const validated = validateDocumentUpload({
        mimeType: data.mimeType,
        byteLength: bytes.byteLength,
        fileName: data.fileName,
      });
      if (!validated.ok) throw new AuthError(validated.error, 400);

      const category = data.category.trim();
      if (!category) throw new AuthError("Document category is required.", 400);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { requireAoSupabaseClient, assertStudentVisibleDb, resolveOwnStudentDb } =
          await import("@/server/ao-data");
        const { ensureStudentDocument, registerDocumentVersion, getStudentDocumentById } =
          await import("@/services/db");
        const { mapDocumentRow } = await import("@/lib/ao-mappers");
        const client = requireAoSupabaseClient();

        const accessToken = bearerToken();
        if (!accessToken) throw new AuthError("Sign in required. Missing access token.", 401);
        const storageClient = createServerSupabase(accessToken);
        if (!storageClient) throw new AuthError("Storage is not configured.", 503);

        // --- Student: existing requirement only; never upsert/create; ignore client studentId ---
        if (session.role === "student") {
          const owner = await resolveOwnStudentDb(client, session);
          const documentId = data.documentId?.trim() ?? "";
          const existingRow = documentId ? await getStudentDocumentById(client, documentId) : null;
          const resolved = resolveExistingStudentUploadTarget({
            documentId,
            category,
            ownerStudentId: owner.id,
            existing: existingRow
              ? {
                  id: existingRow.id,
                  student_id: existingRow.student_id,
                  doc_type: existingRow.doc_type,
                  current_version: existingRow.current_version ?? 0,
                }
              : null,
          });
          if (!resolved.ok) throw new AuthError(resolved.message, resolved.status);

          const target = resolved.target;
          const nextVersion = target.current_version + 1;
          const storagePath = studentDocumentStoragePath(
            owner.id,
            target.id,
            nextVersion,
            validated.fileName,
          );
          const { error: uploadError } = await storageClient.storage
            .from(STUDENT_DOCUMENTS_BUCKET)
            .upload(storagePath, bytes, { contentType: data.mimeType, upsert: false });
          if (uploadError)
            throw new AuthError("Upload failed. Please retry with an allowed file.", 400);

          // registerDocumentVersion also bumps current_version + pending_review (verified columns).
          // Client expiresOn / linkedApplicationId / status / metadata are intentionally ignored.
          const versionRow = await registerDocumentVersion(client, {
            studentId: owner.id,
            documentId: target.id,
            versionNumber: nextVersion,
            fileName: validated.fileName,
            mimeType: data.mimeType,
            fileSizeBytes: bytes.byteLength,
            uploadedBy: session.userId ?? null,
          });

          const finalRow = await getStudentDocumentById(client, target.id);
          const { nextJourneyStageIfAdvanced } = await import("@/lib/journey-stage");
          const { data: journeyRow } = await client
            .from("students")
            .select("journey_stage")
            .eq("id", owner.id)
            .maybeSingle();
          const nextStage = nextJourneyStageIfAdvanced(
            journeyRow?.journey_stage,
            "documents_submitted",
          );
          if (nextStage) {
            await client.from("students").update({ journey_stage: nextStage }).eq("id", owner.id);
          }
          return {
            ok: true as const,
            duplicate: false as const,
            document: toRow(mapDocumentRow(finalRow ?? existingRow!), [owner]),
            version: {
              id: versionRow.id,
              versionNumber: versionRow.version_number,
              // Do not expose private storage object keys to students.
              storagePath: "",
            },
          };
        }

        // --- Staff: may create/ensure requirements; verified columns only ---
        const student = await assertStudentVisibleDb(client, session, data.studentId);
        let targetId = data.documentId?.trim() || "";
        let existingRow = targetId ? await getStudentDocumentById(client, targetId) : null;
        if (targetId && !existingRow) throw new AuthError("Document not found.", 404);
        if (existingRow && existingRow.student_id !== student.id) {
          throw new AuthError("Document does not belong to this student.", 403);
        }
        if (existingRow && existingRow.doc_type.trim().toLowerCase() !== category.toLowerCase()) {
          throw new AuthError("Document type does not match this requirement.", 400);
        }

        if (!existingRow) {
          existingRow = await ensureStudentDocument(client, {
            student_id: student.id,
            doc_type: category,
            label: validated.fileName,
            status: "pending_review",
          });
        }
        targetId = existingRow.id;
        const nextVersion = (existingRow.current_version ?? 0) + 1;

        const storagePath = studentDocumentStoragePath(
          student.id,
          targetId,
          nextVersion,
          validated.fileName,
        );
        const { error: uploadError } = await storageClient.storage
          .from(STUDENT_DOCUMENTS_BUCKET)
          .upload(storagePath, bytes, { contentType: data.mimeType, upsert: false });
        if (uploadError) throw new AuthError(`Upload failed: ${uploadError.message}`, 400);

        const versionRow = await registerDocumentVersion(client, {
          studentId: student.id,
          documentId: targetId,
          versionNumber: nextVersion,
          fileName: validated.fileName,
          mimeType: data.mimeType,
          fileSizeBytes: bytes.byteLength,
          uploadedBy: session.userId ?? null,
        });

        const finalRow = await getStudentDocumentById(client, targetId);
        const { nextJourneyStageIfAdvanced } = await import("@/lib/journey-stage");
        const { data: journeyRow } = await client
          .from("students")
          .select("journey_stage")
          .eq("id", student.id)
          .maybeSingle();
        const nextStage = nextJourneyStageIfAdvanced(
          journeyRow?.journey_stage,
          "documents_submitted",
        );
        if (nextStage) {
          await client.from("students").update({ journey_stage: nextStage }).eq("id", student.id);
        }
        return {
          ok: true as const,
          duplicate: false as const,
          document: toRow(mapDocumentRow(finalRow ?? existingRow), [student]),
          version: {
            id: versionRow.id,
            versionNumber: versionRow.version_number,
            storagePath: versionRow.storage_path,
          },
        };
      }

      // Demo / mock plane
      const isStudentUploader = session.role === "student";
      if (isStudentUploader) {
        const own = visibleStudents(session)[0];
        if (!own) throw new AuthError("Student record not found for this account.", 403);
        const documentId = data.documentId?.trim() ?? "";
        const existingDoc = documentId
          ? (db.documents.find((d) => d.id === documentId) ?? null)
          : null;
        const resolved = resolveExistingStudentUploadTarget({
          documentId,
          category,
          ownerStudentId: own.id,
          existing: existingDoc
            ? {
                id: existingDoc.id,
                student_id: existingDoc.studentId,
                doc_type: existingDoc.category,
                current_version: existingDoc.version ?? 0,
              }
            : null,
        });
        if (!resolved.ok) throw new AuthError(resolved.message, resolved.status);
        // Force studentId to trusted owner; drop unauthorized client metadata fields.
        const { expiresOn: _e, linkedApplicationId: _l, ...studentSafe } = data;
        data = { ...studentSafe, studentId: own.id, documentId: resolved.target.id };
      } else {
        assertStudentVisible(session, data.studentId);
      }

      if (data.idempotencyKey) {
        const cached = uploadCache.get(data.idempotencyKey);
        if (cached) {
          const existing = db.documents.find((d) => d.id === cached);
          if (existing) {
            return {
              ok: true as const,
              duplicate: true as const,
              document: toRow(existing, visibleStudents(session)),
            };
          }
        }
      }

      let doc = data.documentId
        ? db.documents.find((d) => d.id === data.documentId)
        : findByCategory(data.studentId, category);

      if (data.documentId && !doc) throw new AuthError("Document not found.", 404);
      if (doc && doc.studentId !== data.studentId) {
        throw new AuthError("Document does not belong to this student.", 403);
      }
      // Students never create requirements in demo either (fail closed).
      if (!doc && isStudentUploader) {
        throw new AuthError("A document id is required to upload.", 400);
      }

      const actor = actorMeta(session);
      const nextVersion = (doc?.version ?? 0) + 1;
      const documentId = doc?.id ?? nextDocumentId();
      const storagePath = studentDocumentStoragePath(
        data.studentId,
        documentId,
        nextVersion,
        validated.fileName,
      );

      // Prefer Supabase private Storage when a real JWT is present.
      let sha256: string | null = null;
      const accessToken = bearerToken();
      if (session.source === "supabase" && accessToken) {
        const client = createServerSupabase(accessToken);
        if (!client) throw new AuthError("Storage is not configured.", 503);
        const { error } = await client.storage
          .from(STUDENT_DOCUMENTS_BUCKET)
          .upload(storagePath, bytes, {
            contentType: data.mimeType,
            upsert: false,
          });
        if (error) throw new AuthError(`Upload failed: ${error.message}`, 400);
      } else {
        const written = await writePrivateDocumentBlob(storagePath, bytes);
        sha256 = written.sha256;
      }

      if (!doc) {
        doc = {
          id: documentId,
          studentId: data.studentId,
          name: validated.fileName,
          category,
          uploaded: new Date().toISOString().slice(0, 10),
          status: "Pending Review",
          version: nextVersion,
          awaitingUpload: false,
          uploadedBy: actor.name,
          storageBucket: STUDENT_DOCUMENTS_BUCKET,
          storagePath,
          mimeType: data.mimeType,
          fileSizeBytes: bytes.byteLength,
          ...(!isStudentUploader && data.expiresOn ? { expiresOn: data.expiresOn } : {}),
          ...(!isStudentUploader && data.linkedApplicationId
            ? { linkedApplicationId: data.linkedApplicationId }
            : {}),
        };
        db.documents.push(doc);
      } else {
        doc.name = validated.fileName;
        doc.uploaded = new Date().toISOString().slice(0, 10);
        doc.status = "Pending Review";
        doc.version = nextVersion;
        doc.awaitingUpload = false;
        doc.uploadedBy = actor.name;
        doc.storageBucket = STUDENT_DOCUMENTS_BUCKET;
        doc.storagePath = storagePath;
        doc.mimeType = data.mimeType;
        doc.fileSizeBytes = bytes.byteLength;
        delete doc.comment;
        if (!isStudentUploader && data.expiresOn) doc.expiresOn = data.expiresOn;
        if (!isStudentUploader && data.linkedApplicationId) {
          doc.linkedApplicationId = data.linkedApplicationId;
        }
      }

      const versionRow = appendDocumentVersion({
        id: `dv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        documentId: doc.id,
        versionNumber: nextVersion,
        storageBucket: STUDENT_DOCUMENTS_BUCKET,
        storagePath,
        fileName: validated.fileName,
        mimeType: data.mimeType,
        fileSizeBytes: bytes.byteLength,
        uploadedById: actor.id,
        uploadedByName: actor.name,
        uploadedAt: new Date().toISOString(),
        sha256,
      });
      doc.currentVersionId = versionRow.id;
      if (doc.expiresOn) automateDocumentExpiryTask(doc);

      if (data.idempotencyKey) uploadCache.set(data.idempotencyKey, doc.id);

      return {
        ok: true as const,
        duplicate: false as const,
        document: toRow(doc, visibleStudents(session)),
        version: {
          id: versionRow.id,
          versionNumber: versionRow.versionNumber,
          storagePath: isStudentUploader ? "" : versionRow.storagePath,
        },
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalIssueDocumentPreview = createServerFn({ method: "POST" })
  .validator((data: { documentId: string; versionId?: string }) => data)
  .handler(async ({ data }): Promise<DocumentPreviewIssue> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);
      const doc = visibleDocuments(session).find((d) => d.id === data.documentId);
      if (!doc) throw new AuthError("Document not found.", 404);
      if (!hasPrivateFile(doc)) {
        throw new AuthError("No private file is available for preview.", 404);
      }

      const version = data.versionId
        ? versionsForDocument(doc.id).find((v) => v.id === data.versionId)
        : latestVersion(doc.id);

      const storagePath = version?.storagePath ?? doc.storagePath;
      const mimeType = version?.mimeType ?? doc.mimeType;
      const fileName = version?.fileName ?? doc.name;
      if (!storagePath || !mimeType) {
        throw new AuthError("No private file is available for preview.", 404);
      }

      let signedUrl: string | null = null;
      const accessToken = bearerToken();
      if (session.source === "supabase" && accessToken) {
        const client = createServerSupabase(accessToken);
        if (client) {
          const { data: signed, error } = await client.storage
            .from(STUDENT_DOCUMENTS_BUCKET)
            .createSignedUrl(storagePath, DOCUMENT_PREVIEW_TTL_SEC);
          if (!error && signed?.signedUrl) signedUrl = signed.signedUrl;
        }
      }

      const token = newPreviewToken();
      const expiresAt = Date.now() + DOCUMENT_PREVIEW_TTL_SEC * 1000;
      issuePreviewGrant({
        token,
        documentId: doc.id,
        versionId: version?.id ?? doc.currentVersionId ?? "current",
        storagePath,
        mimeType,
        fileName,
        expiresAt,
        issuedToEmail: session.email,
      });

      return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        mimeType,
        fileName,
        ttlSec: DOCUMENT_PREVIEW_TTL_SEC,
        signedUrl,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalFetchDocumentPreview = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<DocumentPreviewPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["student", "consultant", "admin", "super_admin"]);
      const grant = consumePreviewGrant(data.token, session.email);
      if (!grant) throw new AuthError("Preview link expired or is invalid.", 403);

      // Re-check document visibility at fetch time.
      const doc = visibleDocuments(session).find((d) => d.id === grant.documentId);
      if (!doc) throw new AuthError("You do not have access to this document.", 403);

      const accessToken = bearerToken();
      if (session.source === "supabase" && accessToken) {
        const client = createServerSupabase(accessToken);
        if (!client) throw new AuthError("Storage is not configured.", 503);
        const { data: blob, error } = await client.storage
          .from(STUDENT_DOCUMENTS_BUCKET)
          .download(grant.storagePath);
        if (error || !blob) throw new AuthError("Unable to read private document.", 404);
        const buf = Buffer.from(await blob.arrayBuffer());
        return {
          mimeType: grant.mimeType,
          fileName: grant.fileName,
          contentBase64: buf.toString("base64"),
          expiresAt: new Date(grant.expiresAt).toISOString(),
        };
      }

      const bytes = await readPrivateDocumentBlob(grant.storagePath);
      if (!bytes) throw new AuthError("Private document object was not found.", 404);
      return {
        mimeType: grant.mimeType,
        fileName: grant.fileName,
        contentBase64: bytes.toString("base64"),
        expiresAt: new Date(grant.expiresAt).toISOString(),
      };
    } catch (error) {
      toError(error);
    }
  });
