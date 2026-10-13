import type { ReportTimeframeKey } from "@/types/reports-ops";
import type { MetricCount, ReportSectionKey } from "@/lib/report-rules";

export type ModuleReportsFilters = {
  timeframe?: ReportTimeframeKey;
  startDate?: string;
  endDate?: string;
  journeyStage?: string;
  assignedStaffId?: string;
  campaignId?: string;
};

export type ModuleReportSectionAccess = Record<ReportSectionKey, boolean>;

export type JourneyReportsSection = {
  available: true;
  totalRegistered: number;
  byStage: Record<string, number>;
  registrationTrend: Array<{ date: string; count: number }>;
  counsellorWorkload: Array<{ assigneeId: string; count: number }>;
  /** Admission ownership from handovers when present; null list when unavailable. */
  admissionWorkload: Array<{ assigneeId: string; count: number }> | null;
  admissionWorkloadUnavailable: string | null;
};

export type AdmissionsReportsSection = {
  available: true;
  applicationsByStage: Record<string, number>;
  documentsPendingVerification: number;
  offersReceived: number;
  offersAccepted: number;
  offersAwaitingAction: number;
  visaPending: number;
  visaApproved: number;
};

export type FinanceReportsSection = {
  available: true;
  signupClaimedAwaiting: number;
  signupVerified: number;
  signupRejected: number;
  signupUnpaid: number;
  signupWaived: number;
  universityByKindStatus: Record<string, Record<string, number>>;
  note: string;
};

export type HrReportsSection = {
  available: true;
  attendanceByStatus: Record<string, number>;
  attendanceTrend: Array<{ date: string; count: number }>;
  leaveByStatus: Record<string, number>;
  employeeSummary: Array<{ status: string; count: number }> | null;
  employeeSummaryUnavailable: string | null;
};

export type MarketingReportsSection = {
  available: true;
  inquiriesByCampaign: Array<{
    campaignId: string | null;
    campaignName: string;
    inquiries: number;
    registeredStudents: MetricCount;
  }>;
  inquiriesBySource: Record<string, number>;
  conversionNote: string | null;
};

export type OperationsReportsSection = {
  available: true;
  purchasesByStatus: Record<string, number>;
  stockReceivedQuantity: number | null;
  stockReceivedUnavailable: string | null;
  opsSalesCount: number;
  opsSalesTotalAmount: number | null;
  expensesByStatus: Record<string, number> | null;
  expensesUnavailable: string | null;
  note: string;
};

export type UnavailableSection = {
  available: false;
  reason: string;
};

export type ModuleReportsPayload = {
  filters: Required<
    Pick<ModuleReportsFilters, "timeframe"> & {
      startDate: string | null;
      endDate: string | null;
      journeyStage: string | null;
      assignedStaffId: string | null;
      campaignId: string | null;
    }
  >;
  filterOptions: {
    staff: Array<{ id: string; label: string }>;
    campaigns: Array<{ id: string; name: string }>;
    journeyStages: string[];
  };
  sectionAccess: ModuleReportSectionAccess;
  canExport: boolean;
  journey: JourneyReportsSection | UnavailableSection;
  admissions: AdmissionsReportsSection | UnavailableSection;
  finance: FinanceReportsSection | UnavailableSection;
  hr: HrReportsSection | UnavailableSection;
  marketing: MarketingReportsSection | UnavailableSection;
  operations: OperationsReportsSection | UnavailableSection;
  dataPlane: "supabase" | "empty";
};

export type ModuleReportsExportPayload = {
  format: "csv" | "excel";
  filename: string;
  mimeType: string;
  contentBase64: string;
  generatedAt: string;
};
