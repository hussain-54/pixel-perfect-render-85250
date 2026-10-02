import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  ErrorState,
  LoadingRows,
  EmptyState,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionRequiredBanner, isActionRequired } from "@/components/portal/ActionRequiredDocs";
import { useData } from "@/lib/useData";
import { getCurrentStudent, getDocuments } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/documents")({
  component: StudentDocuments,
});

function StudentDocuments() {
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const sid = studentQ.data?.id ?? "";
  const docsQ = useData(["student", sid, "docs"], () =>
    sid ? getDocuments(sid) : Promise.resolve([]),
  );

  if (studentQ.isLoading) return <LoadingRows rows={5} />;
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const docs = docsQ.data ?? [];

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Upload replacements for any item marked Action Required."
      />
      <ActionRequiredBanner docs={docs} />
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
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
