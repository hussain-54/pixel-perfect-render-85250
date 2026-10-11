import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  ErrorState,
  LoadingRows,
  EmptyState,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionRequiredBanner, isActionRequired } from "@/components/portal/ActionRequiredDocs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useData } from "@/lib/useData";
import {
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_UPLOAD_MAX_BYTES,
  validateDocumentUpload,
} from "@/lib/document-storage";
import { getCurrentStudent, getDocuments, uploadStudentDocument } from "@/services";
import { cn } from "@/lib/utils";
import type { StudentDocument } from "@/types";

export const Route = createFileRoute("/student/documents")({
  component: StudentDocuments,
});

function fileToBase64(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 70));
      }
    };
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      onProgress(75);
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

function StudentDocuments() {
  const queryClient = useQueryClient();
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const sid = studentQ.data?.id ?? "";
  const docsQ = useData(["student", sid, "docs"], () =>
    sid ? getDocuments(sid) : Promise.resolve([]),
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingDocRef = useRef<StudentDocument | null>(null);

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const doc = pendingDocRef.current;
      if (!doc || !sid) throw new Error("No document selected.");
      const validated = validateDocumentUpload({
        mimeType: file.type || "application/octet-stream",
        byteLength: file.size,
        fileName: file.name,
      });
      if (!validated.ok) throw new Error(validated.error);

      setProgress(5);
      const contentBase64 = await fileToBase64(file, setProgress);
      setProgress(85);
      const result = await uploadStudentDocument({
        studentId: sid,
        documentId: doc.id,
        category: doc.category,
        fileName: validated.fileName,
        mimeType: file.type,
        contentBase64,
        idempotencyKey: `upload-${doc.id}-${file.name}-${file.size}-${file.lastModified}`,
      });
      setProgress(100);
      return result;
    },
    onSuccess: async () => {
      setUploadError(null);
      setActiveDocId(null);
      pendingDocRef.current = null;
      await queryClient.invalidateQueries({ queryKey: ["student", sid, "docs"] });
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["officer", "documents-queue"] });
      setTimeout(() => setProgress(0), 600);
    },
    onError: (err) => {
      setUploadError(portalErrorMessage(err, "Upload failed. You can retry the same file."));
      setProgress(0);
    },
  });

  if (studentQ.isLoading) return <LoadingRows rows={5} />;
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const docs = docsQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Upload files into private storage. Officers review authorized copies only."
      />
      <ActionRequiredBanner docs={docs} />
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={DOCUMENT_ALLOWED_MIME.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setUploadError(null);
          uploadM.mutate(file);
        }}
      />
      {uploadError ? (
        <div className="mb-4 space-y-2">
          <ErrorState body={uploadError} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setUploadError(null);
              inputRef.current?.click();
            }}
          >
            Retry upload
          </Button>
        </div>
      ) : null}
      {uploadM.isPending || progress > 0 ? (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Uploading to private storage
          </p>
          <Progress value={progress} />
        </div>
      ) : null}
      <p className="mb-4 text-xs text-muted-foreground">
        Allowed: PDF, JPEG, PNG, WebP, DOC, DOCX. Max {Math.floor(DOCUMENT_UPLOAD_MAX_BYTES / (1024 * 1024))}{" "}
        MB. Files are stored privately; public passport/transcript/bank URLs are never created.
      </p>
      {docsQ.isLoading ? (
        <LoadingRows />
      ) : !docs.length ? (
        <EmptyState title="No documents" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>File</th>
              <th>Category</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th>Reviewer notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className={cn(isActionRequired(d) && "bg-warning-soft/80")}>
                <td className="font-medium text-navy">
                  {d.name}
                  {isActionRequired(d) && (
                    <span className="ml-2 rounded bg-warning px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-navy">
                      Action required
                    </span>
                  )}
                </td>
                <td>{d.category}</td>
                <td>{fmtDate(d.uploaded)}</td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td className="max-w-xs text-sm text-muted-foreground">{d.comment ?? "—"}</td>
                <td>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploadM.isPending}
                    onClick={() => {
                      pendingDocRef.current = d;
                      setActiveDocId(d.id);
                      setUploadError(null);
                      inputRef.current?.click();
                    }}
                  >
                    {activeDocId === d.id && uploadM.isPending
                      ? "Uploading..."
                      : d.awaitingUpload || isActionRequired(d)
                        ? "Upload file"
                        : "Replace file"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}