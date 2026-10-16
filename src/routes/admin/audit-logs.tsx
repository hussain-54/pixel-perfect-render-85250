import { createFileRoute } from "@tanstack/react-router";
import {
  PageHeader,
  TableWrap,
  fmtDate,
  LoadingRows,
  EmptyState,
  ErrorState,
  portalErrorMessage,
} from "@/components/common";
import { useData } from "@/lib/useData";
import { getAuditLogs } from "@/services";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AdminAuditLogs,
});

function AdminAuditLogs() {
  const auditQ = useData(["audit"], getAuditLogs);

  return (
    <div>
      <PageHeader
        title="Audit logs"
        subtitle="Firm-wide activity trail from authorized audit events (same source as Activity). Demo sessions show sample rows only."
      />
      {auditQ.isLoading ? (
        <LoadingRows />
      ) : auditQ.isError ? (
        <ErrorState body={portalErrorMessage(auditQ.error)} />
      ) : !auditQ.data?.length ? (
        <EmptyState title="No audit events" body="No activity events are visible for this account." />
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
            {auditQ.data.map((log) => (
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
