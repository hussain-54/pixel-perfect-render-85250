/**
 * Cross-module Reports — aggregated counts from persisted tables (RLS + section auth).
 * Reuses officer funnel elsewhere; this portal covers journey/finance/HR/marketing/ops.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  resolveBusinessRoleFromTrustedAppRole,
  type BusinessRole,
} from "@/lib/business-permissions";
import {
  canExportReports,
  canViewHrEmployeeSummaries,
  canViewReportsPortal,
  countByKey,
  emptyJourneyStageCounts,
  inDateRange,
  parseReportDateKey,
  registrationTrendByDay,
  reportSectionAccess,
  sanitizeSpreadsheetCell,
  signupFeeStatusBuckets,
  universityFeeByKindAndStatus,
  workloadByAssignee,
} from "@/lib/report-rules";
import { campaignConversionMetrics } from "@/lib/marketing-rules";
import { canViewOpsExpenses } from "@/lib/ops-rules";
import { JOURNEY_STAGE_ORDER } from "@/lib/journey-stage";
import { encodeExport } from "@/lib/export-formats";
import { REPORT_TIMEFRAMES, type ReportTimeframeKey } from "@/types/reports-ops";
import type {
  ModuleReportsExportPayload,
  ModuleReportsFilters,
  ModuleReportsPayload,
  UnavailableSection,
} from "@/types/module-reports";

function toError(error: unknown): never {
  if (error instanceof AuthError) throw new Error(`${error.status}:${error.message}`);
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

async function resolveSessionBusinessRole(session: TrustedSession): Promise<BusinessRole | null> {
  const mapped = resolveBusinessRoleFromTrustedAppRole(session.role);
  if (!session.userId || session.source !== "supabase") return mapped;
  try {
    const { requireAoSupabaseClient } = await import("@/server/ao-data");
    const client = requireAoSupabaseClient();
    const { data } = await client
      .from("profiles")
      .select("business_role")
      .eq("id", session.userId)
      .maybeSingle();
    if (data?.business_role) return data.business_role as BusinessRole;
  } catch {
    /* fall through */
  }
  return mapped;
}

function dayMs(key: string): number {
  return Date.parse(`${key}T12:00:00.000Z`);
}

function resolveDateWindow(filters: ModuleReportsFilters): {
  timeframe: ReportTimeframeKey;
  start: string | null;
  end: string;
} {
  const endOverride = filters.endDate?.trim() || null;
  const startOverride = filters.startDate?.trim() || null;
  const end = endOverride || new Date().toISOString().slice(0, 10);
  const tf =
    filters.timeframe && REPORT_TIMEFRAMES.some((t) => t.key === filters.timeframe)
      ? filters.timeframe
      : "30d";

  if (startOverride || endOverride) {
    return {
      timeframe: tf,
      start: startOverride,
      end,
    };
  }
  if (tf === "all") return { timeframe: tf, start: null, end };
  if (tf === "ytd") {
    return { timeframe: tf, start: `${new Date().getUTCFullYear()}-01-01`, end };
  }
  const meta = REPORT_TIMEFRAMES.find((t) => t.key === tf);
  const days = meta?.days ?? 30;
  const startMs = dayMs(end) - (days - 1) * 86_400_000;
  return {
    timeframe: tf,
    start: new Date(startMs).toISOString().slice(0, 10),
    end,
  };
}

function unavailable(reason: string): UnavailableSection {
  return { available: false, reason };
}

function emptyPayload(
  session: TrustedSession,
  businessRole: BusinessRole | null,
  filters: ModuleReportsFilters,
): ModuleReportsPayload {
  const window = resolveDateWindow(filters);
  const sectionAccess = reportSectionAccess({ appRole: session.role, businessRole });
  return {
    filters: {
      timeframe: window.timeframe,
      startDate: window.start,
      endDate: window.end,
      journeyStage: filters.journeyStage?.trim() || null,
      assignedStaffId: filters.assignedStaffId?.trim() || null,
      campaignId: filters.campaignId?.trim() || null,
    },
    filterOptions: {
      staff: [],
      campaigns: [],
      journeyStages: [...JOURNEY_STAGE_ORDER],
    },
    sectionAccess,
    canExport: canExportReports({ appRole: session.role, businessRole }),
    journey: unavailable("Live data plane required for journey aggregates."),
    admissions: unavailable("Live data plane required for admissions aggregates."),
    finance: unavailable("Live data plane required for finance aggregates."),
    hr: unavailable("Live data plane required for HR aggregates."),
    marketing: unavailable("Live data plane required for marketing aggregates."),
    operations: unavailable("Live data plane required for operations aggregates."),
    dataPlane: "empty",
  };
}

async function buildModuleReportsPayload(
  session: TrustedSession,
  businessRole: BusinessRole | null,
  data: ModuleReportsFilters,
): Promise<ModuleReportsPayload> {
  const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
  if (!usesSupabaseDataPlane(session)) {
    return emptyPayload(session, businessRole, data);
  }

  const client = requireAoSupabaseClient();
  const window = resolveDateWindow(data);
  const sectionAccess = reportSectionAccess({ appRole: session.role, businessRole });
  const journeyStageFilter = data.journeyStage?.trim() || null;
  const staffFilter = data.assignedStaffId?.trim() || null;
  const campaignFilter = data.campaignId?.trim() || null;
  const includeEmployeeSummary = canViewHrEmployeeSummaries({
    appRole: session.role,
    businessRole,
  });
  const includeOpsExpenses = canViewOpsExpenses({ appRole: session.role, businessRole });

  // Filter options (minimal columns) — consultant names live on profiles
  const [consultantsRes, campaignsRes] = await Promise.all([
    client.from("consultants").select("id").limit(200),
    sectionAccess.marketing
      ? client.from("marketing_campaigns").select("id, name").is("archived_at", null).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const consultantIds = (consultantsRes.data ?? []).map((c) => c.id);
  const { data: staffProfiles } =
    consultantIds.length > 0
      ? await client.from("profiles").select("id, full_name").in("id", consultantIds)
      : { data: [] as Array<{ id: string; full_name: string }> };
  const nameById = new Map((staffProfiles ?? []).map((p) => [p.id, p.full_name]));

  const filterOptions = {
    staff: consultantIds.map((id) => ({
      id,
      label: nameById.get(id) || id,
    })),
    campaigns: (campaignsRes.data ?? []).map((c) => ({ id: c.id, name: c.name })),
    journeyStages: [...JOURNEY_STAGE_ORDER],
  };

  // —— Journey ——
  let journey: ModuleReportsPayload["journey"] = unavailable(
    "Not authorized for student journey metrics.",
  );
  if (sectionAccess.journey) {
    let sq = client
      .from("students")
      .select("id, journey_stage, assigned_consultant_id, created_at, archived_at, email")
      .is("archived_at", null)
      .limit(5000);
    if (journeyStageFilter) sq = sq.eq("journey_stage", journeyStageFilter as never);
    if (staffFilter) sq = sq.eq("assigned_consultant_id", staffFilter);
    const { data: students, error: stuErr } = await sq;
    if (stuErr) throw new Error(stuErr.message);

    const inWindow = (students ?? []).filter((s) => {
      const key = parseReportDateKey(s.created_at);
      if (window.start === null) return true;
      return inDateRange(key, window.start, window.end);
    });

    const byStage = emptyJourneyStageCounts();
    for (const s of inWindow) {
      const k = s.journey_stage in byStage ? s.journey_stage : "profile_submitted";
      byStage[k] = (byStage[k] ?? 0) + 1;
    }

    let admissionWorkload: Array<{ assigneeId: string; count: number }> | null = null;
    let admissionWorkloadUnavailable: string | null = null;
    const { data: handovers, error: hoErr } = await client
      .from("admission_handovers")
      .select("to_owner_id, handed_over_at, status")
      .limit(2000);
    if (hoErr) {
      admissionWorkloadUnavailable = "Admission handover data unavailable";
    } else {
      const filtered = (handovers ?? []).filter((h) => {
        const key = parseReportDateKey(h.handed_over_at);
        if (window.start === null) return true;
        return inDateRange(key, window.start, window.end);
      });
      admissionWorkload = workloadByAssignee(filtered.map((h) => ({ assigneeId: h.to_owner_id })));
    }

    journey = {
      available: true,
      totalRegistered: inWindow.length,
      byStage,
      registrationTrend: registrationTrendByDay(
        inWindow.map((s) => s.created_at),
        window.start,
        window.end,
      ),
      counsellorWorkload: workloadByAssignee(
        inWindow.map((s) => ({ assigneeId: s.assigned_consultant_id })),
      ),
      admissionWorkload,
      admissionWorkloadUnavailable,
    };
  }

  // —— Admissions ——
  let admissions: ModuleReportsPayload["admissions"] = unavailable(
    "Not authorized for admissions metrics.",
  );
  if (sectionAccess.admissions) {
    const [appsRes, docsRes, offersRes, visaRes] = await Promise.all([
      client.from("applications").select("id, stage, created_at").limit(5000),
      client
        .from("student_documents")
        .select("id, status, created_at")
        .eq("status", "pending_review")
        .limit(5000),
      client.from("offers").select("id, status, created_at").limit(5000),
      client.from("visa_milestones").select("id, decision, created_at").limit(5000),
    ]);
    for (const r of [appsRes, docsRes, offersRes, visaRes]) {
      if (r.error) throw new Error(r.error.message);
    }

    const apps = (appsRes.data ?? []).filter((a) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(a.created_at), window.start, window.end);
    });
    const offers = (offersRes.data ?? []).filter((o) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(o.created_at), window.start, window.end);
    });
    const visas = (visaRes.data ?? []).filter((v) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(v.created_at), window.start, window.end);
    });

    admissions = {
      available: true,
      applicationsByStage: countByKey(apps.map((a) => ({ key: a.stage }))),
      documentsPendingVerification: (docsRes.data ?? []).length,
      offersReceived: offers.length,
      offersAccepted: offers.filter((o) => o.status === "accepted").length,
      offersAwaitingAction: offers.filter((o) =>
        ["awaiting_student", "conditions_pending"].includes(o.status),
      ).length,
      visaPending: visas.filter((v) => v.decision === "pending").length,
      visaApproved: visas.filter((v) => v.decision === "approved").length,
    };
  }

  // —— Finance ——
  let finance: ModuleReportsPayload["finance"] = unavailable(
    "Not authorized for finance aggregates.",
  );
  if (sectionAccess.finance) {
    const [signupRes, uniRes] = await Promise.all([
      client.from("signup_fee_payments").select("status, created_at").limit(5000),
      client.from("university_fee_obligations").select("kind, status, created_at").limit(5000),
    ]);
    if (signupRes.error) throw new Error(signupRes.error.message);
    if (uniRes.error) throw new Error(uniRes.error.message);

    const signups = (signupRes.data ?? []).filter((r) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(r.created_at), window.start, window.end);
    });
    const unis = (uniRes.data ?? []).filter((r) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(r.created_at), window.start, window.end);
    });
    const buckets = signupFeeStatusBuckets(signups.map((s) => s.status));
    finance = {
      available: true,
      signupClaimedAwaiting: buckets.claimedAwaiting,
      signupVerified: buckets.verified,
      signupRejected: buckets.rejected,
      signupUnpaid: buckets.unpaid,
      signupWaived: buckets.waived,
      universityByKindStatus: universityFeeByKindAndStatus(unis),
      note: "Claimed signup/university fees are not verified payments. Kinds stay distinct (application_fee, offer_deposit, tuition, etc.).",
    };
  }

  // —— HR ——
  let hr: ModuleReportsPayload["hr"] = unavailable("Not authorized for HR metrics.");
  if (sectionAccess.hr) {
    const [attRes, leaveRes, empRes] = await Promise.all([
      client.from("hr_attendance_records").select("status, work_date").limit(5000),
      client.from("hr_leave_requests").select("status, created_at").limit(2000),
      includeEmployeeSummary
        ? client.from("hr_employees").select("status").limit(2000)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (attRes.error) throw new Error(attRes.error.message);
    if (leaveRes.error) throw new Error(leaveRes.error.message);

    const attendance = (attRes.data ?? []).filter((a) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(a.work_date), window.start, window.end);
    });
    const leave = (leaveRes.data ?? []).filter((l) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(l.created_at), window.start, window.end);
    });

    let employeeSummary: Array<{ status: string; count: number }> | null = null;
    let employeeSummaryUnavailable: string | null = null;
    if (!includeEmployeeSummary) {
      employeeSummaryUnavailable = "Employee summaries restricted to authorized HR roles";
    } else if (empRes.error) {
      employeeSummaryUnavailable = "Employee summary unavailable";
    } else {
      const by = countByKey((empRes.data ?? []).map((e) => ({ key: e.status })));
      employeeSummary = Object.entries(by).map(([status, count]) => ({ status, count }));
    }

    hr = {
      available: true,
      attendanceByStatus: countByKey(attendance.map((a) => ({ key: a.status }))),
      attendanceTrend: registrationTrendByDay(
        attendance.map((a) => a.work_date),
        window.start,
        window.end,
      ),
      leaveByStatus: countByKey(leave.map((l) => ({ key: l.status }))),
      employeeSummary,
      employeeSummaryUnavailable,
    };
  }

  // —— Marketing ——
  let marketing: ModuleReportsPayload["marketing"] = unavailable(
    "Not authorized for marketing metrics.",
  );
  if (sectionAccess.marketing) {
    let inqQ = client
      .from("consultation_requests")
      .select("id, email, campaign_id, attribution_source, created_at")
      .limit(5000);
    if (campaignFilter) inqQ = inqQ.eq("campaign_id", campaignFilter);
    const [inqRes, campRes, stuEmailRes] = await Promise.all([
      inqQ,
      client.from("marketing_campaigns").select("id, name").limit(200),
      client.from("students").select("email").limit(2000),
    ]);
    if (inqRes.error) throw new Error(inqRes.error.message);
    if (campRes.error) throw new Error(campRes.error.message);

    const inquiries = (inqRes.data ?? []).filter((i) => {
      if (window.start === null) return true;
      return inDateRange(parseReportDateKey(i.created_at), window.start, window.end);
    });
    const campNames = new Map((campRes.data ?? []).map((c) => [c.id, c.name]));
    const studentEmails = stuEmailRes.error ? null : (stuEmailRes.data ?? []).map((s) => s.email);

    const byCamp = new Map<string | null, { emails: string[]; count: number }>();
    for (const i of inquiries) {
      const key = i.campaign_id;
      const cur = byCamp.get(key) ?? { emails: [], count: 0 };
      cur.count += 1;
      cur.emails.push(i.email);
      byCamp.set(key, cur);
    }

    const inquiriesByCampaign = [...byCamp.entries()].map(([campaignId, v]) => {
      const conv = campaignConversionMetrics({
        inquiryEmails: v.emails,
        studentEmails,
      });
      return {
        campaignId,
        campaignName: campaignId
          ? (campNames.get(campaignId) ?? campaignId.slice(0, 8))
          : "No campaign / organic / direct",
        inquiries: v.count,
        registeredStudents: conv.registeredStudents,
      };
    });

    marketing = {
      available: true,
      inquiriesByCampaign,
      inquiriesBySource: countByKey(
        inquiries.map((i) => ({
          key: i.attribution_source?.trim() || "unspecified",
        })),
      ),
      conversionNote:
        studentEmails === null
          ? "Registered-student conversion is N/A when student email match data is unavailable under RLS."
          : null,
    };
  }

  // —— Operations ——
  let operations: ModuleReportsPayload["operations"] = unavailable(
    "Not authorized for office operations metrics.",
  );
  if (sectionAccess.operations) {
    const [poRes, movRes, salesRes, expRes] = await Promise.all([
      client.from("ops_purchase_orders").select("status, created_at").limit(2000),
      client
        .from("ops_stock_movements")
        .select("quantity, kind, created_at")
        .eq("kind", "receive")
        .limit(5000),
      client.from("ops_sales_orders").select("total_amount, created_at").limit(2000),
      includeOpsExpenses
        ? client.from("ops_expenses").select("status, created_at").limit(2000)
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (poRes.error) {
      operations = unavailable(
        poRes.error.message.includes("does not exist")
          ? "Office Operations tables not applied on this database yet."
          : poRes.error.message,
      );
    } else {
      if (movRes.error && !/does not exist/i.test(movRes.error.message)) {
        throw new Error(movRes.error.message);
      }
      if (salesRes.error && !/does not exist/i.test(salesRes.error.message)) {
        throw new Error(salesRes.error.message);
      }

      const purchases = (poRes.data ?? []).filter((p) => {
        if (window.start === null) return true;
        return inDateRange(parseReportDateKey(p.created_at), window.start, window.end);
      });
      const movements = movRes.error
        ? null
        : (movRes.data ?? []).filter((m) => {
            if (window.start === null) return true;
            return inDateRange(parseReportDateKey(m.created_at), window.start, window.end);
          });
      const sales = salesRes.error
        ? []
        : (salesRes.data ?? []).filter((s) => {
            if (window.start === null) return true;
            return inDateRange(parseReportDateKey(s.created_at), window.start, window.end);
          });

      let expensesByStatus: Record<string, number> | null = null;
      let expensesUnavailable: string | null = null;
      if (!includeOpsExpenses) {
        expensesUnavailable = "Expense aggregates restricted for this role";
      } else if (expRes.error) {
        expensesUnavailable = "Expense data unavailable";
      } else {
        const expenses = (expRes.data ?? []).filter((e) => {
          if (window.start === null) return true;
          return inDateRange(parseReportDateKey(e.created_at), window.start, window.end);
        });
        expensesByStatus = countByKey(expenses.map((e) => ({ key: e.status })));
      }

      operations = {
        available: true,
        purchasesByStatus: countByKey(purchases.map((p) => ({ key: p.status }))),
        stockReceivedQuantity:
          movements === null ? null : movements.reduce((n, m) => n + Number(m.quantity), 0),
        stockReceivedUnavailable: movements === null ? "Stock movement data unavailable" : null,
        opsSalesCount: sales.length,
        opsSalesTotalAmount: sales.reduce((n, s) => n + Number(s.total_amount), 0),
        expensesByStatus,
        expensesUnavailable,
        note: "Operational sales/expenses are not student tuition, signup fees, or university fee obligations.",
      };
    }
  }

  return {
    filters: {
      timeframe: window.timeframe,
      startDate: window.start,
      endDate: window.end,
      journeyStage: journeyStageFilter,
      assignedStaffId: staffFilter,
      campaignId: campaignFilter,
    },
    filterOptions,
    sectionAccess,
    canExport: canExportReports({ appRole: session.role, businessRole }),
    journey,
    admissions,
    finance,
    hr,
    marketing,
    operations,
    dataPlane: "supabase",
  };
}

export const portalGetModuleReports = createServerFn({ method: "GET" })
  .validator((data: ModuleReportsFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ModuleReportsPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      if (!canViewReportsPortal({ appRole: session.role, businessRole })) {
        throw new AuthError("You do not have access to Reports.", 403);
      }
      return await buildModuleReportsPayload(session, businessRole, data);
    } catch (error) {
      toError(error);
    }
  });

function sectionToRows(
  title: string,
  section: { available: boolean; reason?: string } & Record<string, unknown>,
): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [[title]];
  if (!section.available) {
    rows.push(["Unavailable", String(section["reason"] ?? "")]);
    rows.push([]);
    return rows;
  }
  for (const [k, v] of Object.entries(section)) {
    if (k === "available") continue;
    if (v == null) {
      rows.push([k, "N/A"]);
      continue;
    }
    if (typeof v === "object") {
      rows.push([k, JSON.stringify(v)]);
    } else {
      rows.push([k, v as string | number]);
    }
  }
  rows.push([]);
  return rows;
}

export const portalExportModuleReports = createServerFn({ method: "POST" })
  .validator((data: ModuleReportsFilters & { format: "csv" | "excel" }) => data)
  .handler(async ({ data }): Promise<ModuleReportsExportPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      const businessRole = await resolveSessionBusinessRole(session);
      if (!canExportReports({ appRole: session.role, businessRole })) {
        throw new AuthError("You do not have permission to export reports.", 403);
      }

      const payload = await buildModuleReportsPayload(session, businessRole, data);
      if (!payload.canExport) {
        throw new AuthError("Export not authorized for this session.", 403);
      }

      const generatedAt = new Date().toISOString();
      const rawRows: (string | number | null)[][] = [
        ["Global Roots — Module Reports"],
        ["Generated", generatedAt],
        [
          "Filters",
          `timeframe=${payload.filters.timeframe}`,
          `start=${payload.filters.startDate ?? ""}`,
          `end=${payload.filters.endDate ?? ""}`,
          `stage=${payload.filters.journeyStage ?? ""}`,
          `staff=${payload.filters.assignedStaffId ?? ""}`,
          `campaign=${payload.filters.campaignId ?? ""}`,
        ],
        [],
        ...sectionToRows("Journey", payload.journey),
        ...sectionToRows("Admissions", payload.admissions),
        ...sectionToRows("Finance", payload.finance),
        ...sectionToRows("HR", payload.hr),
        ...sectionToRows("Marketing", payload.marketing),
        ...sectionToRows("Operations", payload.operations),
      ];

      const csvRows = rawRows.map((row) => row.map((cell) => sanitizeSpreadsheetCell(cell)));

      const encoded = encodeExport(
        data.format,
        `module-reports-${payload.filters.timeframe}-${generatedAt.slice(0, 10)}`,
        csvRows,
        csvRows.map((r) => r.map((c) => String(c ?? "")).join(" | ")),
        "Module Reports",
      );

      return {
        format: data.format,
        filename: encoded.filename,
        mimeType: encoded.mimeType,
        contentBase64: encoded.contentBase64,
        generatedAt,
      };
    } catch (error) {
      toError(error);
    }
  });
