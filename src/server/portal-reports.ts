/**
 * Officer Reports — metrics computed from live portal data (not wireframe samples).
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import { documentReviews } from "@/data/document-reviews";
import { offerRecords, visaMilestones } from "@/data/offers-visa";
import { encodeExport } from "@/lib/export-formats";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import type { Application, Student } from "@/types";
import {
  REPORT_METRIC_DEFINITIONS,
  REPORT_TIMEFRAMES,
  type ReportExportFormat,
  type ReportKpi,
  type ReportsExportPayload,
  type ReportsFilters,
  type ReportsPayload,
  type ReportTimeframeKey,
  type UniversityReportRow,
} from "@/types/reports-ops";

function toError(error: unknown): never {
  if (error instanceof AuthError) throw new Error(`${error.status}:${error.message}`);
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function consultantScopeId(session: TrustedSession): string | null {
  if (session.role === "consultant") return session.consultantId ?? null;
  return null;
}

function visibleStudents(session: TrustedSession): Student[] {
  if (rolesAtLeastAdmin(session.role)) return db.students.filter((s) => !s.archived);
  if (session.role === "consultant") {
    const cid = consultantScopeId(session);
    if (!cid) return [];
    return db.students.filter((s) => s.consultantId === cid && !s.archived);
  }
  return [];
}

function visibleApplications(session: TrustedSession): Application[] {
  const ids = new Set(visibleStudents(session).map((s) => s.id));
  if (rolesAtLeastAdmin(session.role)) return db.applications.filter((a) => ids.has(a.studentId));
  return db.applications.filter((a) => ids.has(a.studentId));
}

function parseDateKey(raw: string | null | undefined): string | null {
  if (!raw || raw === "—" || raw === "-") return null;
  const t = Date.parse(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function dayMs(key: string): number {
  return Date.parse(`${key}T12:00:00.000Z`);
}

function resolveRange(timeframe: ReportTimeframeKey): {
  start: string | null;
  end: string;
  priorStart: string | null;
  priorEnd: string | null;
  days: number | null;
} {
  const end = new Date().toISOString().slice(0, 10);
  const endMs = dayMs(end);
  if (timeframe === "all") {
    return { start: null, end, priorStart: null, priorEnd: null, days: null };
  }
  if (timeframe === "ytd") {
    const start = `${new Date().getUTCFullYear()}-01-01`;
    const days = Math.max(1, Math.round((endMs - dayMs(start)) / 86_400_000) + 1);
    const priorEndMs = dayMs(start) - 86_400_000;
    const priorStartMs = priorEndMs - (days - 1) * 86_400_000;
    return {
      start,
      end,
      priorStart: new Date(priorStartMs).toISOString().slice(0, 10),
      priorEnd: new Date(priorEndMs).toISOString().slice(0, 10),
      days,
    };
  }
  const meta = REPORT_TIMEFRAMES.find((t) => t.key === timeframe);
  const days = meta?.days ?? 30;
  const startMs = endMs - (days - 1) * 86_400_000;
  const priorEndMs = startMs - 86_400_000;
  const priorStartMs = priorEndMs - (days - 1) * 86_400_000;
  return {
    start: new Date(startMs).toISOString().slice(0, 10),
    end,
    priorStart: new Date(priorStartMs).toISOString().slice(0, 10),
    priorEnd: new Date(priorEndMs).toISOString().slice(0, 10),
    days,
  };
}

function inRange(dateKey: string | null, start: string | null, end: string): boolean {
  if (!dateKey) return false;
  if (start && dateKey < start) return false;
  return dateKey <= end;
}

function normalizeFilters(data: ReportsFilters | undefined): Required<ReportsFilters> {
  const tf = data?.timeframe;
  const timeframe: ReportTimeframeKey =
    tf && REPORT_TIMEFRAMES.some((t) => t.key === tf) ? tf : "30d";
  return {
    timeframe,
    destination: data?.destination?.trim() || "all",
    intake: data?.intake?.trim() || "all",
    university: data?.university?.trim() || "all",
  };
}

function matchDimensions(app: Application, f: Required<ReportsFilters>): boolean {
  if (f.destination !== "all" && app.country !== f.destination) return false;
  if (f.intake !== "all" && app.intake !== f.intake) return false;
  if (f.university !== "all" && app.university !== f.university) return false;
  return true;
}

function isSubmittedApp(app: Application): boolean {
  if (parseDateKey(app.appliedOn)) return true;
  return (
    app.status === "Submitted" ||
    app.status === "Offer Received" ||
    app.status === "Rejected" ||
    app.status === "Withdrawn"
  );
}

function safeRate(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

function pctDisplay(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function buildPayload(session: TrustedSession, raw: ReportsFilters | undefined): ReportsPayload {
  const filters = normalizeFilters(raw);
  const range = resolveRange(filters.timeframe);
  const students = visibleStudents(session);
  const studentIds = new Set(students.map((s) => s.id));
  const allApps = visibleApplications(session).filter((a) => matchDimensions(a, filters));

  const filterOptions = {
    destinations: [...new Set(visibleApplications(session).map((a) => a.country))].sort(),
    intakes: [...new Set(visibleApplications(session).map((a) => a.intake))].sort(),
    universities: [...new Set(visibleApplications(session).map((a) => a.university))].sort(),
  };

  // Started files: dimension-filtered apps. Timeframe: include if appliedOn in range,
  // or (All Time) include undated apps too.
  const started = allApps.filter((a) => {
    const key = parseDateKey(a.appliedOn);
    if (filters.timeframe === "all") return true;
    if (key) return inRange(key, range.start, range.end);
    // Undated apps are open pipeline — exclude from bounded windows to avoid inventing dates.
    return false;
  });

  const submittedInWindow = allApps.filter((a) => {
    const key = parseDateKey(a.appliedOn);
    return key != null && inRange(key, range.start, range.end);
  });

  const priorSubmitted =
    range.priorStart && range.priorEnd
      ? allApps.filter((a) => {
          const key = parseDateKey(a.appliedOn);
          return key != null && inRange(key, range.priorStart, range.priorEnd!);
        }).length
      : null;

  const appsSubmitted = submittedInWindow.length;
  const momDelta =
    priorSubmitted == null ? null : appsSubmitted - priorSubmitted;

  const offerAppIds = new Set(allApps.map((a) => a.id));
  const offersInWindow = offerRecords.filter((o) => {
    if (!offerAppIds.has(o.applicationId) && !studentIds.has(o.studentId)) return false;
    // Must match dimension filters via linked application when present.
    const app = db.applications.find((a) => a.id === o.applicationId);
    if (app && !matchDimensions(app, filters)) return false;
    const key = parseDateKey(o.offerDate);
    if (filters.timeframe === "all") return true;
    return key != null && inRange(key, range.start, range.end);
  });
  const offersReceived = offersInWindow.length;
  const offerRate = safeRate(offersReceived, appsSubmitted);

  const docs = db.documents.filter((d) => studentIds.has(d.studentId));
  const docsVerified = docs.filter((d) => {
    if (d.status !== "Approved") return false;
    const key = parseDateKey(d.uploaded);
    if (filters.timeframe === "all") return true;
    return key != null && inRange(key, range.start, range.end);
  }).length;

  // Turnaround: first review with approve/reject after upload, only reliable pairs.
  const turnaroundDays: number[] = [];
  for (const doc of docs) {
    const uploadKey = parseDateKey(doc.uploaded);
    if (!uploadKey) continue;
    const uploadMs = dayMs(uploadKey);
    const reviews = documentReviews
      .filter(
        (r) =>
          r.documentId === doc.id &&
          (r.action === "approve" || r.action === "reject") &&
          !Number.isNaN(Date.parse(r.at)),
      )
      .sort((a, b) => a.at.localeCompare(b.at));
    const first = reviews[0];
    if (!first) continue;
    if (filters.timeframe !== "all") {
      const rk = parseDateKey(first.at);
      if (!rk || !inRange(rk, range.start, range.end)) continue;
    }
    const days = (Date.parse(first.at) - uploadMs) / 86_400_000;
    if (days >= 0 && days < 365) turnaroundDays.push(days);
  }
  const avgTurnaround =
    turnaroundDays.length > 0
      ? turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length
      : null;

  const startedSubmitted = started.filter(isSubmittedApp);
  const startedIds = new Set(started.map((a) => a.id));
  const offersIssuedApps = new Set(
    offerRecords.filter((o) => startedIds.has(o.applicationId)).map((o) => o.applicationId),
  );
  const offersAcceptedApps = new Set(
    offerRecords
      .filter((o) => startedIds.has(o.applicationId) && o.status === "accepted")
      .map((o) => o.applicationId),
  );
  const visaGrantedApps = new Set(
    visaMilestones
      .filter(
        (v): v is typeof v & { applicationId: string } =>
          Boolean(v.applicationId) &&
          startedIds.has(v.applicationId!) &&
          v.decision === "approved",
      )
      .map((v) => v.applicationId),
  );

  const funnelBase = started.length;
  const funnel = [
    {
      key: "started",
      label: "Started Files",
      count: started.length,
      rateOfStarted: funnelBase ? 1 : null,
    },
    {
      key: "submitted",
      label: "Submitted Apps",
      count: startedSubmitted.length,
      rateOfStarted: safeRate(startedSubmitted.length, funnelBase),
    },
    {
      key: "offers_issued",
      label: "Offers Issued",
      count: offersIssuedApps.size,
      rateOfStarted: safeRate(offersIssuedApps.size, funnelBase),
    },
    {
      key: "offers_accepted",
      label: "Offers Accepted",
      count: offersAcceptedApps.size,
      rateOfStarted: safeRate(offersAcceptedApps.size, funnelBase),
    },
    {
      key: "visa_granted",
      label: "Visa Granted",
      count: visaGrantedApps.size,
      rateOfStarted: safeRate(visaGrantedApps.size, funnelBase),
    },
  ];

  // Monthly trend: last 5 calendar months of submitted counts (same dimension filters).
  const monthlyTrend: ReportsPayload["monthlyTrend"] = [];
  const now = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const submitted = allApps.filter((a) => {
      const key = parseDateKey(a.appliedOn);
      return key != null && key.startsWith(monthKey);
    }).length;
    monthlyTrend.push({ monthKey, label, submitted });
  }

  const byUni = new Map<string, UniversityReportRow>();
  for (const app of allApps) {
    const key = parseDateKey(app.appliedOn);
    const submitted =
      filters.timeframe === "all"
        ? isSubmittedApp(app)
        : key != null && inRange(key, range.start, range.end);
    if (!submitted && filters.timeframe !== "all") {
      // still track rejections/offers only for submitted-in-window unis via submitted count
    }
    const row = byUni.get(app.university) ?? {
      university: app.university,
      submitted: 0,
      offersReceived: 0,
      rejections: 0,
      offerSuccessRate: null,
      offerSuccessDisplay: "—",
    };
    if (
      filters.timeframe === "all"
        ? isSubmittedApp(app)
        : key != null && inRange(key, range.start, range.end)
    ) {
      row.submitted += 1;
      if (app.status === "Rejected") row.rejections += 1;
    }
    byUni.set(app.university, row);
  }
  for (const o of offerRecords) {
    const app = db.applications.find((a) => a.id === o.applicationId);
    if (!app || !matchDimensions(app, filters)) continue;
    if (!studentIds.has(o.studentId)) continue;
    const key = parseDateKey(o.offerDate);
    if (filters.timeframe !== "all" && (!key || !inRange(key, range.start, range.end))) continue;
    const row = byUni.get(app.university) ?? {
      university: app.university,
      submitted: 0,
      offersReceived: 0,
      rejections: 0,
      offerSuccessRate: null,
      offerSuccessDisplay: "—",
    };
    row.offersReceived += 1;
    byUni.set(app.university, row);
  }
  const universities = [...byUni.values()]
    .map((r) => {
      const rate = safeRate(r.offersReceived, r.submitted);
      return {
        ...r,
        offerSuccessRate: rate,
        offerSuccessDisplay: pctDisplay(rate),
      };
    })
    .filter((r) => r.submitted > 0 || r.offersReceived > 0)
    .sort((a, b) => b.submitted - a.submitted || a.university.localeCompare(b.university));

  const kpis: ReportKpi[] = [
    {
      key: "appsSubmitted",
      label: REPORT_METRIC_DEFINITIONS.appsSubmitted.label,
      value: appsSubmitted,
      display: String(appsSubmitted),
      footnote:
        momDelta == null
          ? priorSubmitted == null
            ? null
            : "No prior period"
          : `${momDelta >= 0 ? "+" : ""}${momDelta} vs prior period`,
    },
    {
      key: "offersReceived",
      label: REPORT_METRIC_DEFINITIONS.offersReceived.label,
      value: offersReceived,
      display: String(offersReceived),
      footnote: offerRate == null ? "Offer rate — (no submissions)" : `${pctDisplay(offerRate)} offer rate`,
    },
    {
      key: "docsVerified",
      label: REPORT_METRIC_DEFINITIONS.docsVerified.label,
      value: docsVerified,
      display: String(docsVerified),
      footnote:
        turnaroundDays.length > 0
          ? `${(turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length).toFixed(1)}d avg review (sample)`
          : "No paired review timestamps",
    },
    {
      key: "avgTurnaround",
      label: REPORT_METRIC_DEFINITIONS.avgTurnaround.label,
      value: avgTurnaround,
      display: avgTurnaround == null ? "—" : avgTurnaround.toFixed(1),
      footnote:
        avgTurnaround == null
          ? "Insufficient timestamps"
          : `Days/app from ${turnaroundDays.length} reviewed doc${turnaroundDays.length === 1 ? "" : "s"}`,
    },
  ];

  return {
    filters,
    filterOptions,
    range: {
      start: range.start,
      end: range.end,
      priorStart: range.priorStart,
      priorEnd: range.priorEnd,
    },
    kpis,
    funnel,
    monthlyTrend,
    universities,
    definitions: REPORT_METRIC_DEFINITIONS,
    empty: started.length === 0 && appsSubmitted === 0 && offersReceived === 0,
    scopedStudentCount: students.length,
    scopedApplicationCount: allApps.length,
  };
}

/** Supabase-plane version of buildPayload — same pure helpers, DB-sourced collections. */
async function buildPayloadFromDb(
  session: TrustedSession,
  raw: ReportsFilters | undefined,
): Promise<ReportsPayload> {
  const { requireAoSupabaseClient, listVisibleStudentsDb, listAppsForStudents, listDocsForStudents, listOffersForStudents, listVisaMilestonesForStudents, listDocumentReviewRowsForDocuments } =
    await import("@/server/ao-data");
  const client = requireAoSupabaseClient();

  const filters = normalizeFilters(raw);
  const range = resolveRange(filters.timeframe);
  const students = await listVisibleStudentsDb(client, session);
  const studentIds = new Set(students.map((s) => s.id));
  const allAppsRaw = await listAppsForStudents(client, [...studentIds]);
  const allApps = allAppsRaw.filter((a) => matchDimensions(a, filters));

  const filterOptions = {
    destinations: [...new Set(allAppsRaw.map((a) => a.country))].sort(),
    intakes: [...new Set(allAppsRaw.map((a) => a.intake))].sort(),
    universities: [...new Set(allAppsRaw.map((a) => a.university))].sort(),
  };

  const started = allApps.filter((a) => {
    const key = parseDateKey(a.appliedOn);
    if (filters.timeframe === "all") return true;
    if (key) return inRange(key, range.start, range.end);
    return false;
  });

  const submittedInWindow = allApps.filter((a) => {
    const key = parseDateKey(a.appliedOn);
    return key != null && inRange(key, range.start, range.end);
  });

  const priorSubmitted =
    range.priorStart && range.priorEnd
      ? allApps.filter((a) => {
          const key = parseDateKey(a.appliedOn);
          return key != null && inRange(key, range.priorStart, range.priorEnd!);
        }).length
      : null;

  const appsSubmitted = submittedInWindow.length;
  const momDelta = priorSubmitted == null ? null : appsSubmitted - priorSubmitted;

  const offers = await listOffersForStudents(client, [...studentIds]);
  const offerAppIds = new Set(allApps.map((a) => a.id));
  const offersInWindow = offers.filter((o) => {
    if (!offerAppIds.has(o.applicationId) && !studentIds.has(o.studentId)) return false;
    const app = allAppsRaw.find((a) => a.id === o.applicationId);
    if (app && !matchDimensions(app, filters)) return false;
    const key = parseDateKey(o.offerDate);
    if (filters.timeframe === "all") return true;
    return key != null && inRange(key, range.start, range.end);
  });
  const offersReceived = offersInWindow.length;
  const offerRate = safeRate(offersReceived, appsSubmitted);

  const docs = await listDocsForStudents(client, [...studentIds]);
  const docsVerified = docs.filter((d) => {
    if (d.status !== "Approved") return false;
    const key = parseDateKey(d.uploaded);
    if (filters.timeframe === "all") return true;
    return key != null && inRange(key, range.start, range.end);
  }).length;

  const reviewRows = await listDocumentReviewRowsForDocuments(client, docs.map((d) => d.id));
  const reviewsByDoc = new Map<string, { action: "approve" | "reject"; at: string }[]>();
  for (const r of reviewRows) {
    const list = reviewsByDoc.get(r.documentId) ?? [];
    list.push({ action: r.action, at: r.at });
    reviewsByDoc.set(r.documentId, list);
  }
  const turnaroundDays: number[] = [];
  for (const doc of docs) {
    const uploadKey = parseDateKey(doc.uploaded);
    if (!uploadKey) continue;
    const uploadMs = dayMs(uploadKey);
    const reviews = (reviewsByDoc.get(doc.id) ?? [])
      .filter((r) => !Number.isNaN(Date.parse(r.at)))
      .sort((a, b) => a.at.localeCompare(b.at));
    const first = reviews[0];
    if (!first) continue;
    if (filters.timeframe !== "all") {
      const rk = parseDateKey(first.at);
      if (!rk || !inRange(rk, range.start, range.end)) continue;
    }
    const days = (Date.parse(first.at) - uploadMs) / 86_400_000;
    if (days >= 0 && days < 365) turnaroundDays.push(days);
  }
  const avgTurnaround =
    turnaroundDays.length > 0
      ? turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length
      : null;

  const startedSubmitted = started.filter(isSubmittedApp);
  const startedIds = new Set(started.map((a) => a.id));
  const offersIssuedApps = new Set(offers.filter((o) => startedIds.has(o.applicationId)).map((o) => o.applicationId));
  const offersAcceptedApps = new Set(
    offers.filter((o) => startedIds.has(o.applicationId) && o.status === "accepted").map((o) => o.applicationId),
  );
  const visas = await listVisaMilestonesForStudents(client, [...studentIds]);
  const visaGrantedApps = new Set(
    visas
      .filter(
        (v): v is typeof v & { applicationId: string } =>
          Boolean(v.applicationId) && startedIds.has(v.applicationId!) && v.decision === "approved",
      )
      .map((v) => v.applicationId),
  );

  const funnelBase = started.length;
  const funnel = [
    { key: "started", label: "Started Files", count: started.length, rateOfStarted: funnelBase ? 1 : null },
    {
      key: "submitted",
      label: "Submitted Apps",
      count: startedSubmitted.length,
      rateOfStarted: safeRate(startedSubmitted.length, funnelBase),
    },
    {
      key: "offers_issued",
      label: "Offers Issued",
      count: offersIssuedApps.size,
      rateOfStarted: safeRate(offersIssuedApps.size, funnelBase),
    },
    {
      key: "offers_accepted",
      label: "Offers Accepted",
      count: offersAcceptedApps.size,
      rateOfStarted: safeRate(offersAcceptedApps.size, funnelBase),
    },
    {
      key: "visa_granted",
      label: "Visa Granted",
      count: visaGrantedApps.size,
      rateOfStarted: safeRate(visaGrantedApps.size, funnelBase),
    },
  ];

  const monthlyTrend: ReportsPayload["monthlyTrend"] = [];
  const now = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const submitted = allApps.filter((a) => {
      const key = parseDateKey(a.appliedOn);
      return key != null && key.startsWith(monthKey);
    }).length;
    monthlyTrend.push({ monthKey, label, submitted });
  }

  const byUni = new Map<string, UniversityReportRow>();
  for (const app of allApps) {
    const key = parseDateKey(app.appliedOn);
    const row = byUni.get(app.university) ?? {
      university: app.university,
      submitted: 0,
      offersReceived: 0,
      rejections: 0,
      offerSuccessRate: null,
      offerSuccessDisplay: "—",
    };
    if (filters.timeframe === "all" ? isSubmittedApp(app) : key != null && inRange(key, range.start, range.end)) {
      row.submitted += 1;
      if (app.status === "Rejected") row.rejections += 1;
    }
    byUni.set(app.university, row);
  }
  for (const o of offers) {
    const app = allAppsRaw.find((a) => a.id === o.applicationId);
    if (!app || !matchDimensions(app, filters)) continue;
    if (!studentIds.has(o.studentId)) continue;
    const key = parseDateKey(o.offerDate);
    if (filters.timeframe !== "all" && (!key || !inRange(key, range.start, range.end))) continue;
    const row = byUni.get(app.university) ?? {
      university: app.university,
      submitted: 0,
      offersReceived: 0,
      rejections: 0,
      offerSuccessRate: null,
      offerSuccessDisplay: "—",
    };
    row.offersReceived += 1;
    byUni.set(app.university, row);
  }
  const universities = [...byUni.values()]
    .map((r) => {
      const rate = safeRate(r.offersReceived, r.submitted);
      return { ...r, offerSuccessRate: rate, offerSuccessDisplay: pctDisplay(rate) };
    })
    .filter((r) => r.submitted > 0 || r.offersReceived > 0)
    .sort((a, b) => b.submitted - a.submitted || a.university.localeCompare(b.university));

  const kpis: ReportKpi[] = [
    {
      key: "appsSubmitted",
      label: REPORT_METRIC_DEFINITIONS.appsSubmitted.label,
      value: appsSubmitted,
      display: String(appsSubmitted),
      footnote:
        momDelta == null
          ? priorSubmitted == null
            ? null
            : "No prior period"
          : `${momDelta >= 0 ? "+" : ""}${momDelta} vs prior period`,
    },
    {
      key: "offersReceived",
      label: REPORT_METRIC_DEFINITIONS.offersReceived.label,
      value: offersReceived,
      display: String(offersReceived),
      footnote: offerRate == null ? "Offer rate — (no submissions)" : `${pctDisplay(offerRate)} offer rate`,
    },
    {
      key: "docsVerified",
      label: REPORT_METRIC_DEFINITIONS.docsVerified.label,
      value: docsVerified,
      display: String(docsVerified),
      footnote:
        turnaroundDays.length > 0
          ? `${(turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length).toFixed(1)}d avg review (sample)`
          : "No paired review timestamps",
    },
    {
      key: "avgTurnaround",
      label: REPORT_METRIC_DEFINITIONS.avgTurnaround.label,
      value: avgTurnaround,
      display: avgTurnaround == null ? "—" : avgTurnaround.toFixed(1),
      footnote:
        avgTurnaround == null
          ? "Insufficient timestamps"
          : `Days/app from ${turnaroundDays.length} reviewed doc${turnaroundDays.length === 1 ? "" : "s"}`,
    },
  ];

  return {
    filters,
    filterOptions,
    range: { start: range.start, end: range.end, priorStart: range.priorStart, priorEnd: range.priorEnd },
    kpis,
    funnel,
    monthlyTrend,
    universities,
    definitions: REPORT_METRIC_DEFINITIONS,
    empty: started.length === 0 && appsSubmitted === 0 && offersReceived === 0,
    scopedStudentCount: students.length,
    scopedApplicationCount: allApps.length,
  };
}

export const portalGetReports = createServerFn({ method: "GET" })
  .validator((data: ReportsFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<ReportsPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        return await buildPayloadFromDb(session, data);
      }

      return buildPayload(session, data);
    } catch (error) {
      toError(error);
    }
  });

export const portalExportReports = createServerFn({ method: "POST" })
  .validator((data: ReportsFilters & { format: ReportExportFormat }) => data)
  .handler(async ({ data }): Promise<ReportsExportPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      const payload = usesSupabaseDataPlane(session)
        ? await buildPayloadFromDb(session, data)
        : buildPayload(session, data);
      const generatedAt = new Date().toISOString();
      const csvRows: (string | number | null)[][] = [
        ["Global Roots — Officer Performance Report"],
        ["Generated", generatedAt],
        [
          "Filters",
          `timeframe=${payload.filters.timeframe}`,
          `destination=${payload.filters.destination}`,
          `intake=${payload.filters.intake}`,
          `university=${payload.filters.university}`,
        ],
        [],
        ["KPI", "Value", "Footnote"],
        ...payload.kpis.map((k) => [k.label, k.display, k.footnote ?? ""]),
        [],
        ["Funnel step", "Count", "% of Started"],
        ...payload.funnel.map((f) => [
          f.label,
          f.count,
          f.rateOfStarted == null ? "—" : pctDisplay(f.rateOfStarted),
        ]),
        [],
        ["Month", "Submitted"],
        ...payload.monthlyTrend.map((m) => [m.label, m.submitted]),
        [],
        ["University", "Submitted", "Offers Received", "Rejections", "Offer Success Rate"],
        ...payload.universities.map((u) => [
          u.university,
          u.submitted,
          u.offersReceived,
          u.rejections,
          u.offerSuccessDisplay,
        ]),
        [],
        ["Metric definitions"],
        ...Object.values(REPORT_METRIC_DEFINITIONS).map((d) => [
          d.label,
          d.numerator,
          d.denominator,
        ]),
      ];
      const pdfLines = csvRows.map((r) => r.map((c) => (c == null ? "" : String(c))).join(" | "));
      const encoded = encodeExport(
        data.format,
        `officer-report-${payload.filters.timeframe}-${generatedAt.slice(0, 10)}`,
        csvRows,
        pdfLines,
        "Officer Performance Report",
      );
      return {
        format: data.format,
        filename: encoded.filename,
        mimeType: encoded.mimeType,
        contentBase64: encoded.contentBase64,
        generatedAt,
        filters: payload.filters,
      };
    } catch (error) {
      toError(error);
    }
  });