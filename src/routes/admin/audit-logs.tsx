import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, fmtDate, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getAuditLogs } from "@/services";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AdminAuditLogs,
});

function AdminAuditLogs() {
  const auditQ = useData(["audit"], getAuditLogs);

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Immutable-style activity trail (mock)." />
      {auditQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {(auditQ.data ?? []).map((log) => (
              <tr key={log.id}>
                <td>
                  {fmtDate(log.date)} {log.time}
                </td>
                <td className="font-medium text-navy">{log.user}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.entityId}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
