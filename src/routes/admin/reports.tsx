import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Panel,
  PermissionDenied,
  StatCard,
  TableWrap,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBase64File } from "@/lib/export-formats";
import { formatMetricCount } from "@/lib/report-rules";
import { exportModuleReports, getModuleReports } from "@/services";
import { REPORT_TIMEFRAMES, type ReportTimeframeKey } from "@/types/reports-ops";
import type { ModuleReportsFilters } from "@/types/module-reports";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-navy";

function stageLabel(key: string) {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function AdminReports() {
  const [timeframe, setTimeframe] = useState<ReportTimeframeKey>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [journeyStage, setJourneyStage] = useState("all");
  const [assignedStaffId, setAssignedStaffId] = useState("all");
  const [campaignId, setCampaignId] = useState("all");

  const filters = useMemo((): ModuleReportsFilters => {
    const next: ModuleReportsFilters = { timeframe };
    if (startDate.trim()) next.startDate = startDate.trim();
    if (endDate.trim()) next.endDate = endDate.trim();
    if (journeyStage !== "all") next.journeyStage = journeyStage;
    if (assignedStaffId !== "all") next.assignedStaffId = assignedStaffId;
    if (campaignId !== "all") next.campaignId = campaignId;
    return next;
  }, [timeframe, startDate, endDate, journeyStage, assignedStaffId, campaignId]);

  const reportQ = useQuery({
    queryKey: ["admin", "module-reports", filters],
    queryFn: () => getModuleReports(filters),
    staleTime: 20_000,
  });

  const exportM = useMutation({
    mutationFn: (format: "csv" | "excel") => exportModuleReports({ ...filters, format }),
    onSuccess: (payload) => {
      downloadBase64File(payload.filename, payload.mimeType, payload.contentBase64);
    },
  });

  if (reportQ.isLoading) return <LoadingRows rows={10} />;
  if (reportQ.isError) {
    const msg = portalErrorMessage(reportQ.error);
    if (msg.includes("403") || msg.toLowerCase().includes("permission")) {
      return <PermissionDenied body={msg} />;
    }
    return <ErrorState body={msg} />;
  }

  const data = reportQ.data;
  if (!data) return <EmptyState title="No report data" />;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Persisted aggregates across journey, admissions, finance, HR, marketing and office ops. Missing data shows N/A — never as zero."
        actions={
          data.canExport ? (
            <div className="flex flex-wrap gap-2">
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
                variant="outline"
                disabled={exportM.isPending}
                onClick={() => exportM.mutate("excel")}
              >
                Export Excel
              </Button>
            </div>
          ) : null
        }
      />

      <Panel title="Filters" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 text-sm">
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Timeframe</span>
            <select
              className={selectClass}
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
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Start date</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">End date</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Journey stage</span>
            <select
              className={selectClass}
              value={journeyStage}
              onChange={(e) => setJourneyStage(e.target.value)}
            >
              <option value="all">All stages</option>
              {data.filterOptions.journeyStages.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Assigned staff</span>
            <select
              className={selectClass}
              value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}
            >
              <option value="all">All staff</option>
              {data.filterOptions.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Campaign</span>
            <select
              className={selectClass}
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="all">All campaigns</option>
              {data.filterOptions.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Window: {data.filters.startDate ?? "—"} → {data.filters.endDate ?? "—"} · Plane:{" "}
          {data.dataPlane}. Officer funnel analytics remain on{" "}
          <Link to="/staff/reports" className="font-semibold text-royal hover:underline">
            Staff Reports
          </Link>
          .
        </p>
      </Panel>

      {/* Journey */}
      <Panel title="Student journey" className="mb-6">
        {!data.journey.available ? (
          <EmptyState title="Unavailable" body={data.journey.reason} />
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <StatCard label="Registered (window)" value={data.journey.totalRegistered} />
              <StatCard
                label="Counsellor assignments"
                value={data.journey.counsellorWorkload.length}
              />
              <StatCard
                label="Admission owners"
                value={
                  data.journey.admissionWorkload == null
                    ? "N/A"
                    : data.journey.admissionWorkload.length
                }
              />
            </div>
            {data.journey.admissionWorkloadUnavailable ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {data.journey.admissionWorkloadUnavailable}
              </p>
            ) : null}
            <TableWrap>
              <thead>
                <tr>
                  <th>Journey stage</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.journey.byStage).map(([stage, count]) => (
                  <tr key={stage}>
                    <td>{stageLabel(stage)}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {data.journey.registrationTrend.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Registration trend
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Registrations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.journey.registrationTrend.slice(-14).map((r) => (
                      <tr key={r.date}>
                        <td>{r.date}</td>
                        <td>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      {/* Admissions */}
      <Panel title="Admissions" className="mb-6">
        {!data.admissions.available ? (
          <EmptyState title="Unavailable" body={data.admissions.reason} />
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Docs pending verification"
                value={data.admissions.documentsPendingVerification}
              />
              <StatCard label="Offers received" value={data.admissions.offersReceived} />
              <StatCard label="Offers accepted" value={data.admissions.offersAccepted} />
              <StatCard
                label="Offers awaiting action"
                value={data.admissions.offersAwaitingAction}
              />
              <StatCard label="Visa pending" value={data.admissions.visaPending} />
              <StatCard label="Visa approved" value={data.admissions.visaApproved} />
            </div>
            <TableWrap>
              <thead>
                <tr>
                  <th>Application stage</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.admissions.applicationsByStage).map(([stage, count]) => (
                  <tr key={stage}>
                    <td>{stageLabel(stage)}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        )}
      </Panel>

      {/* Finance */}
      <Panel title="Finance" className="mb-6">
        {!data.finance.available ? (
          <EmptyState title="Unavailable" body={data.finance.reason} />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">{data.finance.note}</p>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                label="Signup claimed (awaiting)"
                value={data.finance.signupClaimedAwaiting}
              />
              <StatCard label="Signup verified" value={data.finance.signupVerified} />
              <StatCard label="Signup rejected" value={data.finance.signupRejected} />
              <StatCard label="Signup unpaid" value={data.finance.signupUnpaid} />
              <StatCard label="Signup waived" value={data.finance.signupWaived} />
            </div>
            <TableWrap>
              <thead>
                <tr>
                  <th>University fee kind</th>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.finance.universityByKindStatus).flatMap(([kind, statuses]) =>
                  Object.entries(statuses).map(([status, count]) => (
                    <tr key={`${kind}-${status}`}>
                      <td>{stageLabel(kind)}</td>
                      <td>{status}</td>
                      <td>{count}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </TableWrap>
            <p className="mt-2 text-xs text-muted-foreground">
              Details under{" "}
              <Link to="/admin/finance" className="font-semibold text-royal hover:underline">
                Finance
              </Link>
              .
            </p>
          </>
        )}
      </Panel>

      {/* HR */}
      <Panel title="HR & Attendance" className="mb-6">
        {!data.hr.available ? (
          <EmptyState title="Unavailable" body={data.hr.reason} />
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Attendance by status
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.hr.attendanceByStatus).map(([status, count]) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Leave by status
                </p>
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.hr.leaveByStatus).map(([status, count]) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
            </div>
            {data.hr.employeeSummaryUnavailable ? (
              <p className="text-xs text-muted-foreground">{data.hr.employeeSummaryUnavailable}</p>
            ) : data.hr.employeeSummary ? (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Employee status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.hr.employeeSummary.map((e) => (
                    <tr key={e.status}>
                      <td>{e.status}</td>
                      <td>{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : null}
          </>
        )}
      </Panel>

      {/* Marketing */}
      <Panel title="Digital Marketing" className="mb-6">
        {!data.marketing.available ? (
          <EmptyState title="Unavailable" body={data.marketing.reason} />
        ) : (
          <>
            {data.marketing.conversionNote ? (
              <p className="mb-3 text-xs text-muted-foreground">{data.marketing.conversionNote}</p>
            ) : null}
            <TableWrap>
              <thead>
                <tr>
                  <th>Campaign / source bucket</th>
                  <th>Inquiries</th>
                  <th>Registered (email match)</th>
                </tr>
              </thead>
              <tbody>
                {data.marketing.inquiriesByCampaign.map((c) => (
                  <tr key={c.campaignId ?? "none"}>
                    <td>{c.campaignName}</td>
                    <td>{c.inquiries}</td>
                    <td>{formatMetricCount(c.registeredStudents)}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                By attribution source label
              </p>
              <TableWrap>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.marketing.inquiriesBySource).map(([source, count]) => (
                    <tr key={source}>
                      <td>{source}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </div>
          </>
        )}
      </Panel>

      {/* Ops */}
      <Panel title="Office Operations" className="mb-6">
        {!data.operations.available ? (
          <EmptyState title="Unavailable" body={data.operations.reason} />
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground">{data.operations.note}</p>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Ops sales (count)" value={data.operations.opsSalesCount} />
              <StatCard
                label="Ops sales total"
                value={
                  data.operations.opsSalesTotalAmount == null
                    ? "N/A"
                    : data.operations.opsSalesTotalAmount
                }
              />
              <StatCard
                label="Stock received qty"
                value={
                  data.operations.stockReceivedQuantity == null
                    ? "N/A"
                    : data.operations.stockReceivedQuantity
                }
              />
              <StatCard
                label="Expense statuses"
                value={
                  data.operations.expensesByStatus == null
                    ? "N/A"
                    : Object.keys(data.operations.expensesByStatus).length
                }
              />
            </div>
            {data.operations.stockReceivedUnavailable ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {data.operations.stockReceivedUnavailable}
              </p>
            ) : null}
            {data.operations.expensesUnavailable ? (
              <p className="mb-2 text-xs text-muted-foreground">
                {data.operations.expensesUnavailable}
              </p>
            ) : null}
            <TableWrap>
              <thead>
                <tr>
                  <th>Purchase status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.operations.purchasesByStatus).map(([status, count]) => (
                  <tr key={status}>
                    <td>{status}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {data.operations.expensesByStatus ? (
              <div className="mt-4">
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Expense status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.operations.expensesByStatus).map(([status, count]) => (
                      <tr key={status}>
                        <td>{status}</td>
                        <td>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Records under{" "}
              <Link to="/admin/operations" className="font-semibold text-royal hover:underline">
                Office Ops
              </Link>
              .
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}
