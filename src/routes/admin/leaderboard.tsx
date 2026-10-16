import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PageHeader,
  TableWrap,
  LoadingRows,
  EmptyState,
  ErrorState,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import {
  LEADERBOARD_METRIC_LABELS,
  LEADERBOARD_METRICS,
  LEADERBOARD_PERIOD_LABELS,
  LEADERBOARD_PERIODS,
  formatLeaderboardValue,
  isLeaderboardMetric,
  isLeaderboardPeriod,
  type LeaderboardMetricKey,
  type LeaderboardPeriod,
} from "@/lib/leaderboard-rules";
import { getConsultantLeaderboard } from "@/services";

export const Route = createFileRoute("/admin/leaderboard")({
  component: AdminLeaderboard,
});

function AdminLeaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("month");
  const [metric, setMetric] = useState<LeaderboardMetricKey>("students");

  const boardQ = useQuery({
    queryKey: ["admin", "consultant-leaderboard", period, metric],
    queryFn: () => getConsultantLeaderboard({ period, metric }),
    staleTime: 15_000,
  });

  if (boardQ.isLoading) return <LoadingRows rows={8} />;
  if (boardQ.isError) {
    const text = portalErrorMessage(boardQ.error);
    if (text.includes("403") || text.toLowerCase().includes("permission")) {
      return <PermissionDenied body={text} />;
    }
    return <ErrorState body={text} />;
  }

  const payload = boardQ.data;
  const rows = payload?.rows ?? [];
  const metricUnavailable =
    payload?.metricAvailability[metric] === "unavailable";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Consultant leaderboard"
        subtitle="Firm ranking from live Supabase counts. No invented scores — unavailable sources show as Not available."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex w-full flex-col gap-1 sm:w-auto">
          <label htmlFor="leaderboard-period" className="text-xs font-medium text-muted-foreground">
            Period
          </label>
          <select
            id="leaderboard-period"
            aria-label="Period"
            value={period}
            onChange={(e) => {
              if (isLeaderboardPeriod(e.target.value)) setPeriod(e.target.value);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:min-w-[12rem]"
          >
            {LEADERBOARD_PERIODS.map((key) => (
              <option key={key} value={key}>
                {LEADERBOARD_PERIOD_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-full flex-col gap-1 sm:w-auto">
          <label htmlFor="leaderboard-metric" className="text-xs font-medium text-muted-foreground">
            Metric
          </label>
          <select
            id="leaderboard-metric"
            aria-label="Metric"
            value={metric}
            onChange={(e) => {
              if (isLeaderboardMetric(e.target.value)) setMetric(e.target.value);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:min-w-[14rem]"
          >
            {LEADERBOARD_METRICS.map((key) => (
              <option key={key} value={key}>
                {LEADERBOARD_METRIC_LABELS[key]}
                {payload?.metricAvailability[key] === "unavailable" ? " (unavailable)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {payload?.note ? (
        <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {payload.note}
          {payload.source === "live" && payload.window
            ? payload.periodApplies
              ? ` Window ${payload.window.start ?? "…"} → ${payload.window.end}.`
              : " Period filter does not apply to this metric."
            : null}
        </p>
      ) : null}

      {payload?.source === "unavailable" ? (
        <EmptyState
          title="Leaderboard not available"
          body={payload.note ?? "Live data plane is required for consultant rankings."}
        />
      ) : !rows.length ? (
        <EmptyState title="No consultants" body="No desks available to rank." />
      ) : metricUnavailable ? (
        <EmptyState
          title="Not available"
          body={`Reliable source for ${LEADERBOARD_METRIC_LABELS[metric]} could not be loaded under current access.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <TableWrap>
            <thead>
              <tr>
                <th className="w-14">#</th>
                <th>Consultant</th>
                <th className="hidden sm:table-cell">Department</th>
                <th>{LEADERBOARD_METRIC_LABELS[metric]}</th>
                <th className="hidden md:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.consultantId} className={i === 0 && c.value != null ? "bg-accent/60" : undefined}>
                  <td className="font-display text-lg font-semibold text-navy">
                    {c.rank != null ? c.rank : "—"}
                  </td>
                  <td>
                    <div className="font-medium text-navy">{c.name}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{c.department}</div>
                  </td>
                  <td className="hidden sm:table-cell">{c.department}</td>
                  <td className="font-display text-xl font-semibold text-royal">
                    {formatLeaderboardValue(c.value)}
                  </td>
                  <td className="hidden md:table-cell">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}
    </div>
  );
}
