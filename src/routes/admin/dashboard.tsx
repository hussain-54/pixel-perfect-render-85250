import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserPlus, GraduationCap, FileText } from "lucide-react";
import { PageHeader, StatCard, Panel, LoadingRows, fmtDate } from "@/components/common";
import { useData } from "@/lib/useData";
import { getStudents, getLeads, getApplications, getDocuments, getAuditLogs } from "@/services";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const studentsQ = useData(["students"], getStudents);
  const leadsQ = useData(["leads"], getLeads);
  const appsQ = useData(["applications"], getApplications);
  const docsQ = useData(["documents"], getDocuments);
  const auditQ = useData(["audit"], getAuditLogs);

  if (studentsQ.isLoading) return <LoadingRows rows={6} />;

  const newLeads = (leadsQ.data ?? []).filter((l) => l.status === "New").length;
  const pendingDocs = (docsQ.data ?? []).filter((d) => d.status === "Pending Review").length;

  return (
    <div>
      <PageHeader
        title="Operations overview"
        subtitle="Internal admin demo — not visible on the public site."
      />
      <p className="mb-4 rounded-md border border-dashed border-navy/20 bg-background px-3 py-2 text-xs text-muted-foreground">
        All figures come from <code className="text-royal">mock.ts</code>. Connect real analytics
        when a backend is added.
      </p>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active students" value={studentsQ.data?.length ?? 0} icon={<Users />} />
        <StatCard label="New leads" value={newLeads} icon={<UserPlus />} />
        <StatCard label="Applications" value={appsQ.data?.length ?? 0} icon={<GraduationCap />} />
        <StatCard label="Pending doc reviews" value={pendingDocs} icon={<FileText />} />
      </div>
      <Panel title="Recent audit events">
        {auditQ.isLoading ? (
          <LoadingRows rows={3} />
        ) : (
          <ul className="space-y-3">
            {(auditQ.data ?? []).slice(0, 5).map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 first:border-0 first:pt-0 text-sm"
              >
                <div>
                  <span className="font-semibold text-navy">{log.user}</span>
                  <span className="text-muted-foreground"> · {log.action}</span>
                  <span className="block text-xs text-muted-foreground">
                    {log.entity} {log.entityId}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {fmtDate(log.date)} {log.time}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/admin/audit-logs"
          className="mt-4 inline-block text-sm font-semibold text-royal hover:underline"
        >
          Full audit log →
        </Link>
      </Panel>
    </div>
  );
}
