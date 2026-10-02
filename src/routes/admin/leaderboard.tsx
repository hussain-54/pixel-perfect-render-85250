import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, FilterSelect } from "@/components/common";
import { useData } from "@/lib/useData";
import { getConsultants } from "@/services";
import type { Consultant } from "@/types";

export const Route = createFileRoute("/admin/leaderboard")({
  component: AdminLeaderboard,
});

type Period = "Week" | "Month" | "Quarter" | "Year";
type MetricKey = keyof Consultant["metrics"];

const periodScale: Record<Period, number> = {
  Week: 0.22,
  Month: 1,
  Quarter: 2.85,
  Year: 11,
};

const metricLabels: Record<MetricKey, string> = {
  students: "Active students",
  appointmentsCompleted: "Appointments completed",
  applicationsSubmitted: "Applications submitted",
  offers: "Offers received",
  visaCases: "Visa cases",
  completedCases: "Cases completed",
};

function AdminLeaderboard() {
  const [period, setPeriod] = useState<Period>("Month");
  const [metric, setMetric] = useState<MetricKey>("offers");
  const consQ = useData(["consultants"], getConsultants);

  const ranked = useMemo(() => {
    const scale = periodScale[period];
    return [...(consQ.data ?? [])]
      .map((c) => ({
        ...c,
        score: Math.round(c.metrics[metric] * scale),
        raw: c.metrics[metric],
      }))
      .sort((a, b) => b.score - a.score);
  }, [consQ.data, period, metric]);

  return (
    <div>
      <PageHeader
        title="Consultant leaderboard"
        subtitle="Internal performance view — scaled from demo metrics, not published."
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <FilterSelect
          label="Period"
          value={period}
          onChange={(v) => setPeriod((v || "Month") as Period)}
          options={["Week", "Month", "Quarter", "Year"]}
        />
        <select
          aria-label="Metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {(Object.keys(metricLabels) as MetricKey[]).map((key) => (
            <option key={key} value={key}>
              {metricLabels[key]}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Showing <strong className="text-navy">{metricLabels[metric]}</strong> for demo period{" "}
        <strong className="text-navy">{period}</strong> (multiplier ×{periodScale[period]} on base
        mock totals).
      </p>
      <TableWrap>
        <thead>
          <tr>
            <th>#</th>
            <th>Consultant</th>
            <th>Department</th>
            <th>Score</th>
            <th>Base (all-time mock)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((c, i) => (
            <tr key={c.id} className={i === 0 ? "bg-accent/60" : undefined}>
              <td className="font-display text-lg font-semibold text-navy">{i + 1}</td>
              <td className="font-medium text-navy">{c.name}</td>
              <td>{c.department}</td>
              <td className="font-display text-xl font-semibold text-royal">{c.score}</td>
              <td className="text-muted-foreground">{c.raw}</td>
              <td>{c.status}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}
