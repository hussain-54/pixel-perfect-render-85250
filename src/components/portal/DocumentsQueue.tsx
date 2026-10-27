import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  Panel,
  PermissionDenied,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentSecurePreview } from "@/components/portal/DocumentSecurePreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getDocumentChecklist,
  getDocumentInspection,
  getDocumentQueue,
  requestStudentDocument,
  reviewQueueDocument,
} from "@/services";
import {
  DOCUMENT_QUEUE_TABS,
  type DocumentQueueTab,
  type DocumentReviewAction,
} from "@/types/documents-queue";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy";

export function DocumentsQueue() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DocumentQueueTab>("pending");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [checklistStudentId, setChecklistStudentId] = useState("");
  const [noteMode, setNoteMode] = useState<Exclude<DocumentReviewAction, "approve"> | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const filters = useMemo(() => {
    const next: { tab: DocumentQueueTab; q?: string } = { tab };
    const trimmed = q.trim();
    if (trimmed) next.q = trimmed;
    return next;
  }, [q, tab]);

  const queueQ = useQuery({
    queryKey: ["officer", "documents-queue", filters],
    queryFn: () => getDocumentQueue(filters),
    staleTime: 20_000,
  });

  const inspectionQ = useQuery({
    queryKey: ["officer", "document-inspection", selectedId],
    queryFn: () => getDocumentInspection(selectedId!),
    enabled: Boolean(selectedId),
  });

  const checklistQ = useQuery({
    queryKey: ["officer", "document-checklist", checklistStudentId],
    queryFn: () => getDocumentChecklist(checklistStudentId),
    enabled: checklistOpen && Boolean(checklistStudentId),
  });

  useEffect(() => {
    const rows = queueQ.data?.rows ?? [];
    if (!rows.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0]!.id);
    }
  }, [queueQ.data, selectedId]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["officer", "documents-queue"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "document-inspection"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "document-checklist"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "student-profile"] });
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const reviewM = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: DocumentReviewAction;
      reason?: string;
    }) => reviewQueueDocument(id, action, reason),
    onSuccess: async () => {
      setActionError(null);
      setNote("");
      setNoteMode(null);
      await invalidate();
    },
    onError: (err) => setActionError(portalErrorMessage(err, "Review failed.")),
  });

  const requestM = useMutation({
    mutationFn: ({ studentId, category }: { studentId: string; category: string }) =>
      requestStudentDocument({
        studentId,
        category,
        idempotencyKey: `request-${studentId}-${category}`,
      }),
    onSuccess: async (result) => {
      setRequestMessage(
        result.duplicate
          ? `${result.document.category} is already on file for this student.`
          : `Requested ${result.document.category}. The student will see it as action required.`,
      );
      await invalidate();
    },
    onError: (err) => setRequestMessage(portalErrorMessage(err, "Request failed.")),
  });

  if (queueQ.isLoading) {
    return (
      <PageLoadState title="Documents" subtitle="Review submitted student compliance documents.">
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (queueQ.isError) {
    const msg = portalErrorMessage(queueQ.error);
    if (String(queueQ.error).includes("403") || msg.toLowerCase().includes("permission")) {
      return (
        <PageLoadState title="Documents">
          <PermissionDenied body={msg} />
        </PageLoadState>
      );
    }
    return (
      <PageLoadState title="Documents">
        <ErrorState body={msg} />
      </PageLoadState>
    );
  }

  const data = queueQ.data;
  if (!data) {
    return (
      <PageLoadState title="Documents">
        <EmptyState title="No document queue" />
      </PageLoadState>
    );
  }

  const doc = inspectionQ.data?.document;
  const noteReady = note.trim().length >= 3;

  return (
    <div className="space-y-4 md:space-y-5">
      <PageHeader
        compact
        title="Documents"
        subtitle="Review, verify, and validate submitted student compliance documents."
        actions={
          <Button size="sm" variant="navy" onClick={() => setChecklistOpen(true)}>
            Checklist templates
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {DOCUMENT_QUEUE_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === item.key
                ? "border-royal bg-accent text-royal"
                : "border-border bg-white text-navy hover:border-royal/40",
            )}
          >
            {item.label} ({data.counts[item.key]})
          </button>
        ))}
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search student, document, or category..."
          aria-label="Search documents"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        {!data.rows.length ? (
          <EmptyState
            title="Nothing in this queue"
            body="Try another status, or request a missing checklist document."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Student</th>
                <th>Document</th>
                <th>Wait time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                const selected = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    className={cn(selected && "bg-accent/50")}
                    aria-selected={selected}
                  >
                    <td>
                      <button
                        type="button"
                        className="text-left font-medium text-navy hover:text-royal hover:underline"
                        onClick={() => setSelectedId(row.id)}
                      >
                        {row.studentName}
                      </button>
                      <p className="text-xs text-muted-foreground">{row.studentCaseId}</p>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <p className="font-medium text-navy">{row.category}</p>
                        <p className="text-xs text-muted-foreground">{row.name}</p>
                      </button>
                    </td>
                    <td>{row.waitLabel}</td>
                    <td>
                      <StatusBadge status={row.displayStatus} />
                      {row.expiringSoon && tab !== "expiring" ? (
                        <p className="mt-1 text-xs font-semibold text-danger">Expiring soon</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}

        <Panel title={doc ? `${doc.studentName} · ${doc.category}` : "Inspection"}>
          {!selectedId ? (
            <p className="text-sm text-muted-foreground">Select a document to review it.</p>
          ) : inspectionQ.isLoading ? (
            <LoadingRows rows={4} />
          ) : inspectionQ.isError ? (
            <ErrorState
              body={portalErrorMessage(inspectionQ.error, "Could not load this document.")}
            />
          ) : doc ? (
            <div className="space-y-4">
              <DocumentSecurePreview
                documentId={doc.id}
                fileName={doc.name}
                hasPrivateFile={doc.hasPrivateFile}
              />
              {doc.storagePath ? (
                <p className="text-xs text-muted-foreground">
                  Storage path: <span className="font-mono">{doc.storagePath}</span>
                </p>
              ) : null}

              <dl className="space-y-2 text-sm">
                <Meta label="Uploaded" value={doc.uploaded ? fmtDate(doc.uploaded) : "—"} />
                <Meta label="Uploaded by" value={doc.uploadedBy} />
                <Meta
                  label="Expiry"
                  value={doc.expiresOn ? fmtDate(doc.expiresOn) : "—"}
                  warn={doc.expiringSoon}
                />
                <Meta label="Version" value={doc.versionLabel} />
                <Meta
                  label="File size"
                  value={
                    doc.fileSizeBytes != null
                      ? `${Math.max(1, Math.round(doc.fileSizeBytes / 1024))} KB`
                      : "—"
                  }
                />
                <Meta label="MIME type" value={doc.mimeType ?? "—"} />
                <Meta label="Linked application" value={doc.linkedApplicationLabel ?? "—"} />
                {doc.comment ? <Meta label="Latest note" value={doc.comment} /> : null}
              </dl>

              <Link
                to="/staff/students/$studentId"
                params={{ studentId: doc.studentId }}
                search={{ tab: "documents" }}
                className="inline-block text-sm font-semibold text-royal hover:underline"
              >
                Open student profile
              </Link>

              {actionError ? <ErrorState body={actionError} /> : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="navy"
                  disabled={
                    reviewM.isPending ||
                    doc.awaitingUpload ||
                    !doc.hasPrivateFile ||
                    doc.status === "Approved"
                  }
                  onClick={() => reviewM.mutate({ id: doc.id, action: "approve" })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewM.isPending}
                  onClick={() => {
                    setNoteMode("reject");
                    setNote("");
                    setActionError(null);
                  }}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewM.isPending || doc.awaitingUpload}
                  onClick={() => {
                    setNoteMode("request_reupload");
                    setNote("");
                    setActionError(null);
                  }}
                >
                  Request re-upload
                </Button>
              </div>

              {noteMode ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!noteReady) {
                      setActionError(
                        noteMode === "reject"
                          ? "A rejection reason is required."
                          : "A note is required when requesting a re-upload.",
                      );
                      return;
                    }
                    reviewM.mutate({ id: doc.id, action: noteMode, reason: note.trim() });
                  }}
                >
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {noteMode === "reject" ? "Rejection reason" : "Re-upload note"}
                  </label>
                  <Textarea
                    aria-label={noteMode === "reject" ? "Rejection reason" : "Re-upload note"}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      noteMode === "reject"
                        ? "Why is this document being rejected?"
                        : "What should the student upload instead?"
                    }
                    className="min-h-24"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="navy"
                      type="submit"
                      disabled={reviewM.isPending || !noteReady}
                    >
                      {noteMode === "reject" ? "Confirm rejection" : "Send request"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        setNoteMode(null);
                        setNote("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Review history
                </p>
                {!inspectionQ.data?.history.length ? (
                  <p className="text-sm text-muted-foreground">No review recorded yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {inspectionQ.data.history.map((entry) => (
                      <li
                        key={entry.id}
                        className="border-t border-border/70 pt-2 first:border-0 first:pt-0"
                      >
                        <p className="text-sm font-medium text-navy">
                          {entry.fromStatus} → {entry.toStatus}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.actorName} · {fmtDate(entry.at.slice(0, 10))}{" "}
                          {new Date(entry.at).toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {entry.note ? ` · ${entry.note}` : ""}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ) : null}
        </Panel>
      </div>

      <Dialog open={checklistOpen} onOpenChange={setChecklistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Checklist templates</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Required documents follow the student&apos;s destination. Request anything still
            missing.
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Student
            <select
              aria-label="Student"
              className={cn(selectClass, "mt-1")}
              value={checklistStudentId}
              onChange={(e) => {
                setChecklistStudentId(e.target.value);
                setRequestMessage(null);
              }}
            >
              <option value="">Select a student</option>
              {data.students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · {student.destination}
                </option>
              ))}
            </select>
          </label>

          {requestMessage ? <p className="mt-3 text-sm text-navy">{requestMessage}</p> : null}

          <div className="mt-4">
            {!checklistStudentId ? (
              <p className="text-sm text-muted-foreground">
                Choose a student to load their checklist.
              </p>
            ) : checklistQ.isLoading ? (
              <LoadingRows rows={4} />
            ) : checklistQ.isError ? (
              <ErrorState body={portalErrorMessage(checklistQ.error)} />
            ) : !checklistQ.data?.items.length ? (
              <p className="text-sm text-muted-foreground">
                No checklist is configured for {checklistQ.data?.destination ?? "this destination"}.
                Country-specific templates apply only where configured.
              </p>
            ) : (
              <ul className="space-y-2">
                {checklistQ.data?.items.map((item) => (
                  <li
                    key={item.category}
                    className="flex items-center justify-between gap-3 border-t border-border/70 pt-2 first:border-0 first:pt-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy">{item.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.onFile
                          ? item.status
                          : item.awaitingUpload
                            ? "Requested — waiting for upload"
                            : "Missing"}
                      </p>
                    </div>
                    {!item.onFile && !item.awaitingUpload ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={requestM.isPending}
                        onClick={() =>
                          requestM.mutate({
                            studentId: checklistStudentId,
                            category: item.category,
                          })
                        }
                      >
                        Request
                      </Button>
                    ) : (
                      <StatusBadge
                        status={item.awaitingUpload ? "Requested" : (item.status ?? "Approved")}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChecklistOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium text-navy", warn && "text-danger")}>{value}</dd>
    </div>
  );
}
