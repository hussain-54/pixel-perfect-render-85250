import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { isActionRequired } from "@/components/portal/ActionRequiredDocs";
import { useData } from "@/lib/useData";
import { getDocuments, lookupStudent } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/documents")({
  component: AdminDocuments,
});

function AdminDocuments() {
  const docsQ = useData(["documents"], getDocuments);

  return (
    <div>
      <PageHeader title="Documents" subtitle="Global document registry." />
      {docsQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Student</th>
              <th>File</th>
              <th>Category</th>
              <th>Uploaded</th>
              <th>Status</th>
              <th>Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {(docsQ.data ?? []).map((d) => (
              <tr key={d.id} className={cn(isActionRequired(d) && "bg-warning-soft/50")}>
                <td className="font-medium text-navy">{lookupStudent(d.studentId)?.name ?? "—"}</td>
                <td>{d.name}</td>
                <td>{d.category}</td>
                <td>{fmtDate(d.uploaded)}</td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td>{d.reviewer ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
