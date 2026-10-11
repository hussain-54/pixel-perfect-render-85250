/** Officer Reports — Performance & Conversion Analytics (wireframe page 9). */

export const REPORT_TIMEFRAMES = [
  { key: "7d", label: "Last 7 Days", days: 7 },
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "ytd", label: "Year to Date", days: null },
  { key: "all", label: "All Time", days: null },
] as const;

export type ReportTimeframeKey = (typeof REPORT_TIMEFRAMES)[number]["key"];

export type ReportsFilters = {
  timeframe?: ReportTimeframeKey;
  destination?: string;
  intake?: string;
  university?: string;
};

export type ReportExportFormat = "csv" | "excel" | "pdf";

/**
 * Metric definitions (numerator / denominator).
 * Implementations must follow these exactly and never invent wireframe sample numbers.
 */
export const REPORT_METRIC_DEFINITIONS = {
  appsSubmitted: {
    label: "Apps Submitted",
    numerator:
      "Applications with a parseable appliedOn date inside the selected timeframe (and dimension filters).",
    denominator: "N/A (absolute count). MoM delta compares the prior equal-length period.",
  },
  offersReceived: {
    label: "Offers Received",
    numerator:
      "Offer records whose offerDate falls in the timeframe, linked to in-scope applications.",
    denominator:
      "Apps Submitted (same filters). Offer rate = offers ÷ apps submitted; blank when denominator is 0.",
  },
  docsVerified: {
    label: "Docs Verified",
    numerator:
      "Documents currently Approved whose uploaded date falls in the timeframe (scoped students).",
    denominator:
      "N/A (absolute count). Secondary note: mean days from upload→first approval when both timestamps exist.",
  },
  avgTurnaround: {
    label: "Avg Turnaround",
    numerator:
      "Sum of (first approval/rejection review at − document uploaded at) in days, for docs with both timestamps.",
    denominator:
      "Count of docs with reliable upload + review timestamps. Shows — when denominator is 0.",
  },
  funnelStarted: {
    label: "Started Files",
    numerator:
      "In-scope applications (dimension filters). Timeframe uses appliedOn when parseable; undated apps included only for All Time.",
    denominator: "Funnel base (same set).",
  },
  funnelSubmitted: {
    label: "Submitted Apps",
    numerator:
      "Started files that are submitted or later (status Submitted / Offer Received / Rejected / Withdrawn, or parseable appliedOn).",
    denominator: "Started Files.",
  },
  funnelOffersIssued: {
    label: "Offers Issued",
    numerator: "Distinct applications among Started that have an offer record (any status).",
    denominator: "Started Files.",
  },
  funnelOffersAccepted: {
    label: "Offers Accepted",
    numerator: "Distinct applications among Started with an offer status = accepted.",
    denominator: "Started Files.",
  },
  funnelVisaGranted: {
    label: "Visa Granted",
    numerator: "Distinct applications among Started with visa decision = approved.",
    denominator: "Started Files.",
  },
  universityOfferSuccess: {
    label: "Offer Success Rate",
    numerator: "Offers received for that university (offer records linked to submitted apps).",
    denominator: "Submitted applications for that university. Rate blank when submitted = 0.",
  },
} as const;

export type ReportKpi = {
  key: keyof typeof REPORT_METRIC_DEFINITIONS;
  label: string;
  value: number | null;
  display: string;
  footnote: string | null;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  rateOfStarted: number | null;
};

export type MonthlyTrendPoint = {
  monthKey: string;
  label: string;
  submitted: number;
};

export type UniversityReportRow = {
  university: string;
  submitted: number;
  offersReceived: number;
  rejections: number;
  offerSuccessRate: number | null;
  offerSuccessDisplay: string;
};

export type ReportsPayload = {
  filters: Required<ReportsFilters>;
  filterOptions: {
    destinations: string[];
    intakes: string[];
    universities: string[];
  };
  range: { start: string | null; end: string; priorStart: string | null; priorEnd: string | null };
  kpis: ReportKpi[];
  funnel: FunnelStep[];
  monthlyTrend: MonthlyTrendPoint[];
  universities: UniversityReportRow[];
  definitions: typeof REPORT_METRIC_DEFINITIONS;
  empty: boolean;
  scopedStudentCount: number;
  scopedApplicationCount: number;
};

export type ReportsExportPayload = {
  format: ReportExportFormat;
  filename: string;
  mimeType: string;
  contentBase64: string;
  generatedAt: string;
  filters: Required<ReportsFilters>;
};