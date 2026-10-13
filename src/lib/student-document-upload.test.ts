import { describe, expect, it } from "vitest";
import { resolveExistingStudentUploadTarget } from "./student-document-upload";

const existing = {
  id: "doc-1",
  student_id: "stu-1",
  doc_type: "Passport",
  current_version: 1,
};

describe("resolveExistingStudentUploadTarget", () => {
  it("rejects missing document id (student cannot create a requirement)", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: undefined,
      category: "Passport",
      ownerStudentId: "stu-1",
      existing: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/document id/i);
    }
  });

  it("rejects nonexistent document", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: "doc-missing",
      category: "Passport",
      ownerStudentId: "stu-1",
      existing: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });

  it("rejects wrong owner", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: "doc-1",
      category: "Passport",
      ownerStudentId: "stu-other",
      existing,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(403);
      expect(r.message).not.toMatch(/stu-/);
    }
  });

  it("rejects mismatched document type", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: "doc-1",
      category: "CV",
      ownerStudentId: "stu-1",
      existing,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("accepts valid existing-document upload", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: "doc-1",
      category: "passport",
      ownerStudentId: "stu-1",
      existing,
    });
    expect(r).toEqual({ ok: true, target: existing });
  });

  it("accepts resubmission against the same existing requirement", () => {
    const prior = { ...existing, current_version: 3 };
    const r = resolveExistingStudentUploadTarget({
      documentId: "doc-1",
      category: "Passport",
      ownerStudentId: "stu-1",
      existing: prior,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.target.id).toBe("doc-1");
      expect(r.target.current_version).toBe(3);
      expect(r.target.current_version + 1).toBe(4);
    }
  });

  it("does not treat client category alone as authority to create a requirement", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: "",
      category: "Invented Requirement",
      ownerStudentId: "stu-1",
      existing: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});

describe("staff document creation remains a separate path", () => {
  it("helper never invents a document id when none exists (staff uses ensureStudentDocument)", () => {
    const r = resolveExistingStudentUploadTarget({
      documentId: undefined,
      category: "Passport",
      ownerStudentId: "stu-1",
      existing: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.message).toMatch(/document id/i);
    }
  });
});
