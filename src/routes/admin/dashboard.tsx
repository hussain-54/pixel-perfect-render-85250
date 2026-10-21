import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  UserPlus,
  GraduationCap,
  FileText,
  Wallet,
  Handshake,
  ListTodo,
  Plane,
} from "lucide-react";
import {
  PageHeader,
  PageLoadState,
  StatCard,
  Panel,
  LoadingRows,
  EmptyState,
  ErrorState,
  PermissionDenied,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { Input } from "@/components/ui/input";
import { useData } from "@/lib/useData";
import { getAdminOpsOverview } from "@/services";
import { JOURNEY_STAGE_ORDER } from "@/lib/journey-stage";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboard,
});

function stageLabel(key: string) {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function AdminDashboard() {
  const opsQ = useData(["admin", "ops-overview"], getAdminOpsOverview);
  const [q, setQ] = useState("");

  const filteredStudents = useMemo(() => {
    const rows = opsQ.data?.searchableStudents ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(needle) ||
        s.caseId.toLowerCase().includes(needle) ||
        s.journeyStage.toLowerCase().includes(needle) ||
        s.id.toLowerCase().includes(needle),
    );
  }, [opsQ.data?.searchableStudents, q]);

  const pageTitle = "Operations overview";
  const pageSubtitle =
    "Authorized live aggregates across intake, counselling, admissions, documents and finance.";

  if (opsQ.isLoading) {
    return (
      <PageLoadState title={pageTitle} subtitle={pageSubtitle}>
        <LoadingRows rows={8} />
      </PageLoadState>
    );
  }
  if (opsQ.isError) {
    const msg = portalErrorMessage(opsQ.error);
    if (msg.includes("403") || msg.toLowerCase().includes("permission")) {
      return (
        <PageLoadState title={pageTitle} subtitle={pageSubtitle}>
          <PermissionDenied body={msg} />
        </PageLoadState>
      );
    }
    return (
      <PageLoadState title={pageTitle} subtitle={pageSubtitle}>
        <ErrorState body={msg} onRetry={() => void opsQ.refetch()} />
      </PageLoadState>
    );
  }

  const data = opsQ.data;
  if (!data) {
    return (
      <PageLoadState title={pageTitle} subtitle={pageSubtitle}>
        <EmptyState
          title="Overview unavailable"
          body="No operations data was returned for your session. Try refreshing, or contact an administrator if this continues."
          action={
            <button
              type="button"
              className="text-sm font-semibold text-royal hover:underline"
              onClick={() => void opsQ.refetch()}
            >
              Refresh
            </button>
          }
        />
      </PageLoadState>
    );
  }
  const m = data.metrics;

  return (
    <div>
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active students" value={m.activeStudents} icon={<Users />} />
        <StatCard
          label="Signup fees to verify"
          value={data.includeFinanceDetails ? m.pendingSignupFeeVerification : "—"}
          hint={
            data.includeFinanceDetails ? "Claimed / unpaid signup fees" : "Finance view restricted"
          }
          icon={<Wallet />}
        />
        <StatCard
          label="Handover queue"
          value={m.handoverQueue}
          hint="Submitted to Admission Team"
          icon={<Handshake />}
        />
        <StatCard
          label="Docs awaiting review"
          value={data.includeDocumentDetails ? m.documentsAwaitingVerification : "—"}
          hint={data.includeDocumentDetails ? "Pending verification" : "Document detail restricted"}
          icon={<FileText />}
        />
        <StatCard
          label="Apps needing action"
          value={m.applicationsRequiringAction}
          icon={<GraduationCap />}
        />
        <StatCard
          label="Offers needing action"
          value={m.offersRequiringAction}
          icon={<UserPlus />}
        />
        <StatCard
          label="University fees outstanding"
          value={data.includeFinanceDetails ? m.outstandingUniversityFees : "—"}
          hint="Due or claimed (not verified)"
          icon={<Wallet />}
        />
        <StatCard
          label="Overdue tasks"
          value={m.overdueTasks}
          hint={`Counselling queue: ${m.counsellingQueue} · Visa attention: ${m.visaCasesRequiringAttention}`}
          icon={<ListTodo />}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Students by journey stage">
          <ul className="space-y-2 text-sm">
            {JOURNEY_STAGE_ORDER.map((stage) => {
              const count = m.studentsByStage[stage] ?? 0;
              if (!count) return null;
              return (
                <li
                  key={stage}
                  className="flex items-center justify-between border-t border-border/70 pt-2 first:border-0 first:pt-0"
                >
                  <span className="text-navy">{stageLabel(stage)}</span>
                  <span className="font-semibold text-navy">{count}</span>
                </li>
              );
            })}
            {Object.values(m.studentsByStage).every((n) => !n) ? (
              <li className="text-muted-foreground">No active students in scope.</li>
            ) : null}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link to="/admin/students" className="font-semibold text-royal hover:underline">
              Students →
            </Link>
            <Link to="/admin/applications" className="font-semibold text-royal hover:underline">
              Applications →
            </Link>
            <Link to="/admin/documents" className="font-semibold text-royal hover:underline">
              Documents →
            </Link>
            <Link to="/admin/finance" className="font-semibold text-royal hover:underline">
              Finance →
            </Link>
            <Link to="/staff/applications" className="font-semibold text-royal hover:underline">
              Handover / apps desk →
            </Link>
          </div>
        </Panel>

        <Panel
          title="Student journey search"
          action={
            data.isSuperAdmin ? (
              <span className="text-xs text-muted-foreground">Super Admin session</span>
            ) : null
          }
        >
          <Input
            placeholder="Search name, case ID, stage…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-3"
            aria-label="Search students by journey"
          />
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matching students in authorized scope.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
              {filteredStudents.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2 first:border-0 first:pt-0"
                >
                  <div>
                    <Link
                      to="/staff/students/$studentId"
                      params={{ studentId: s.id }}
                      search={{ tab: "assessment" }}
                      className="font-semibold text-navy hover:underline"
                    >
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.caseId} · {stageLabel(s.journeyStage)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDate(s.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Plane className="size-3.5" /> Visa attention cases: {m.visaCasesRequiringAttention}
          </p>
        </Panel>
      </div>
    </div>
  );
}
