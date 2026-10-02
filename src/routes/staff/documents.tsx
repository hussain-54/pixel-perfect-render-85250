import { createFileRoute } from "@tanstack/react-router";
import { DEMO_CONSULTANT_ID } from "@/components/portal/demo";
import { PageHeader, TableWrap, fmtDate, LoadingRows, EmptyState } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { isActionRequired } from "@/components/portal/ActionRequiredDocs";
import { useData } from "@/lib/useData";
import { getDocuments, getStudents, lookupStudent } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/documents")({
  component: StaffDocuments,
});

function StaffDocuments() {
  const docsQ = useData(["documents"], getDocuments);
  const studentsQ = useData(["students"], getStudents);
  const myStudentIds = new Set(
    (studentsQ.data ?? []).filter((s) => s.consultantId === DEMO_CONSULTANT_ID).map((s) => s.id),
  );
  const rows = (docsQ.data ?? []).filter((d) => myStudentIds.has(d.studentId));

  return (
    <div>
      <PageHeader title="Documents" subtitle="Review queue for your students." />
      {docsQ.isLoading || studentsQ.isLoading ? (
        <LoadingRows />
      ) : !rows.length ? (
        <EmptyState title="No documents" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Student</th>
              <th>File</th>
              <th>Category</th>
              <th>Uploaded</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className={cn(isActionRequired(d) && "bg-warning-soft/60")}>
                <td className="font-medium text-navy">{lookupStudent(d.studentId)?.name ?? "—"}</td>
                <td>{d.name}</td>
                <td>{d.category}</td>
                <td>{fmtDate(d.uploaded)}</td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
