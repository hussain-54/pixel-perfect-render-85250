import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, Panel, TableWrap, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getMonthlyStats } from "@/services";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const statsQ = useData(["monthly-stats"], getMonthlyStats);
  const data = statsQ.data ?? [];

  return (
    <div>
      <PageHeader title="Reports" subtitle="Lead and application trends from demo monthly stats." />
      {statsQ.isLoading ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <Panel title="Leads vs applications" className="mb-6">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 255)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="leads" fill="#005FCB" name="Leads" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="applications"
                    fill="#008FEA"
                    name="Applications"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <TableWrap>
            <thead>
              <tr>
                <th>Month</th>
                <th>Leads</th>
                <th>Applications</th>
                <th>Conversion</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.month}>
                  <td className="font-medium text-navy">{row.month}</td>
                  <td>{row.leads}</td>
                  <td>{row.applications}</td>
                  <td>
                    {row.leads ? `${Math.round((row.applications / row.leads) * 100)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </>
      )}
    </div>
  );
}
