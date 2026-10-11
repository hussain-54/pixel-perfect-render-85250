import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  TableWrap,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { downloadBase64File } from "@/lib/export-formats";
import { cn } from "@/lib/utils";
import { exportOfficerReports, getOfficerReports } from "@/services";
import {
  REPORT_TIMEFRAMES,
  type ReportExportFormat,
  type ReportTimeframeKey,
  type ReportsFilters,
} from "@/types/reports-ops";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-white px-3 text-sm text-navy";

export function ReportsAnalytics() {
  const [timeframe, setTimeframe] = useState<ReportTimeframeKey>("30d");
  const [destination, setDestination] = useState("all");
  const [intake, setIntake] = useState("all");
  const [university, setUniversity] = useState("all");

  const filters = useMemo((): ReportsFilters => {
    const next: ReportsFilters = { timeframe };
    if (destination !== "all") next.destination = destination;
    if (intake !== "all") next.intake = intake;
    if (university !== "all") next.university = university;
    return next;
  }, [timeframe, destination, intake, university]);

  const reportQ = useQuery({
    queryKey: ["officer", "reports", filters],
    queryFn: () => getOfficerReports(filters),
    staleTime: 20_000,
  });

  const exportM = useMutation({
    mutationFn: (format: ReportExportFormat) =>
      exportOfficerReports({ ...filters, format }),
    onSuccess: (payload) => {
      downloadBase64File(payload.filename, payload.mimeType, payload.contentBase64);
    },
  });

  if (reportQ.isLoading) return <LoadingRows rows={10} />;
  if (reportQ.isError) {
    const msg = portalErrorMessage(reportQ.error);
    if (msg.toLowerCase().includes("permission") || String(reportQ.error).includes("403")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  const data = reportQ.data;
  if (!data) return <EmptyState title="No report data" />;

  return (
    <div>
      <PageHeader
        title="Performance & Conversion Analytics"
        subtitle="Evaluate application processing efficiency and conversion metrics for assigned caseloads."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={exportM.isPending}
              onClick={() => exportM.mutate("excel")}
            >
              Export Excel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={exportM.isPending}
              onClick={() => exportM.mutate("csv")}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="navy"
              disabled={exportM.isPending}
              onClick={() => exportM.mutate("pdf")}
            >
              Export PDF Report
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Timeframe
          <select
            className={cn(selectClass, "mt-1")}
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as ReportTimeframeKey)}
          >
            {REPORT_TIMEFRAMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Destination
          <select
            className={cn(selectClass, "mt-1")}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="all">All Countries</option>
            {data.filterOptions.destinations.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Intake
          <select
            className={cn(selectClass, "mt-1")}
            value={intake}
            onChange={(e) => setIntake(e.target.value)}
          >
            <option value="all">All Intakes</option>
            {data.filterOptions.intakes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          University
          <select
            className={cn(selectClass, "mt-1")}
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
          >
            <option value="all">All Universities</option>
            {data.filterOptions.universities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {exportM.isError ? (
        <div className="mb-4">
          <ErrorState body={portalErrorMessage(exportM.error, "Export failed.")} />
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <div key={kpi.key} className="rounded-md border border-border bg-white p-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {kpi.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-navy">{kpi.display}</p>
            {kpi.footnote ? (
              <p className="mt-1 text-xs text-muted-foreground">{kpi.footnote}</p>
            ) : null}
          </div>
        ))}
      </div>

      {data.empty ? (
        <EmptyState
          title="No activity in this period"
          body="Try widening the timeframe or clearing destination / intake / university filters."
        />
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Application Funnel Conversion">
          <ul className="space-y-3">
            {data.funnel.map((step) => {
              const width =
                step.rateOfStarted == null ? 0 : Math.max(4, Math.round(step.rateOfStarted * 100));
              return (
                <li key={step.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-navy">{step.label}</span>
                    <span className="text-sm font-semibold text-navy">
                      {step.count}
                      {step.rateOfStarted != null
                        ? ` · ${Math.round(step.rateOfStarted * 100)}%`
                        : ""}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div
                      className="h-2 rounded bg-royal"
                      style={{ width: `${width}%` }}
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Submissions Monthly Trend">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 255)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="submitted" fill="#005FCB" name="Submitted" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="University Partner Performance" className="mb-6">
        {!data.universities.length ? (
          <p className="text-sm text-muted-foreground">No university rows for these filters.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>University Partner</th>
                <th>Submitted</th>
                <th>Offers Received</th>
                <th>Rejections</th>
                <th>Offer Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.universities.map((row) => (
                <tr key={row.university}>
                  <td className="font-medium text-navy">{row.university}</td>
                  <td>{row.submitted}</td>
                  <td>{row.offersReceived}</td>
                  <td>{row.rejections}</td>
                  <td>{row.offerSuccessDisplay}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel title="Metric definitions">
        <ul className="space-y-2 text-sm text-muted-foreground">
          {Object.values(data.definitions).map((d) => (
            <li key={d.label}>
              <span className="font-semibold text-navy">{d.label}:</span> {d.numerator} /{" "}
              {d.denominator}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Scope: {data.scopedStudentCount} students · {data.scopedApplicationCount} applications
          matching dimension filters. Exports use the same filters and authorization.
        </p>
      </Panel>
    </div>
  );
}