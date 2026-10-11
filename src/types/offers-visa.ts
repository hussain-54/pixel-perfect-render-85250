import type { CasI20Status, CasI20Type, DepositStatus, OfferStatus, OfferType, VisaDecision, VisaStage } from "@/types/database";

/** Metric tabs (wireframe page 7). */
export const OFFERS_METRIC_TABS = [
  { key: "offers_received", label: "Offers Received" },
  { key: "conditions_pending", label: "Conditions Pending" },
  { key: "deposits_due", label: "Deposits Due" },
  { key: "visa_in_progress", label: "Visa In Progress" },
] as const;

export type OffersMetricTab = (typeof OFFERS_METRIC_TABS)[number]["key"];

/** Phase sub-views. */
export const OFFERS_PHASE_TABS = [
  { key: "offers", label: "Offers" },
  { key: "deposits", label: "Deposits" },
  { key: "cas_i20", label: "CAS / I-20" },
  { key: "visa", label: "Visa Filing" },
] as const;

export type OffersPhaseTab = (typeof OFFERS_PHASE_TABS)[number]["key"];

export const VISA_STAGE_ORDER: readonly VisaStage[] = ["doc_prep", "filed", "biometrics", "decision"] as const;

export const VISA_STAGE_LABELS: Record<VisaStage, string> = {
  doc_prep: "Document Preparation",
  filed: "Visa Filed",
  biometrics: "Biometrics",
  decision: "Final Decision",
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  awaiting_student: "Awaiting Student Reply",
  conditions_pending: "Conditions Pending",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export const DEPOSIT_STATUS_LABELS: Record<DepositStatus, string> = {
  due: "Due",
  paid: "Paid",
  waived: "Waived",
  overdue: "Overdue",
};

export const CAS_I20_STATUS_LABELS: Record<CasI20Status, string> = {
  pending: "Pending",
  requested: "Requested",
  issued: "Issued",
  expired: "Expired",
};

/** Deadline alert window (calendar days). */
export const OFFER_DEADLINE_ALERT_DAYS = 14;

/** Destination → CAS / I-20 applicability. Others return null. */
export function casI20TypeForCountry(country: string): CasI20Type | null {
  const key = country.trim().toLowerCase();
  if (key === "uk" || key === "united kingdom") return "CAS";
  if (key === "usa" || key === "us" || key === "united states") return "I-20";
  return null;
}

export function nextVisaStage(stage: VisaStage): VisaStage | null {
  const idx = VISA_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= VISA_STAGE_ORDER.length - 1) return null;
  return VISA_STAGE_ORDER[idx + 1]!;
}

export function nextCasI20Status(status: CasI20Status): CasI20Status | null {
  if (status === "pending") return "requested";
  if (status === "requested") return "issued";
  return null;
}

export type OfferConditionRecord = {
  id: string;
  offerId: string;
  description: string;
  met: boolean;
  metAt: string | null;
  sortOrder: number;
};

export type DepositRecord = {
  id: string;
  offerId: string;
  studentId: string;
  amount: number;
  currency: string;
  status: DepositStatus;
  dueDate: string | null;
  paidAt: string | null;
  reference: string | null;
  notes: string | null;
};

export type CasI20Record = {
  id: string;
  studentId: string;
  applicationId: string | null;
  offerId: string | null;
  recordType: CasI20Type;
  status: CasI20Status;
  referenceNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
};

export type VisaMilestoneRecord = {
  id: string;
  studentId: string;
  applicationId: string | null;
  casI20Id: string | null;
  stage: VisaStage;
  decision: VisaDecision;
  filedAt: string | null;
  biometricsAt: string | null;
  decisionAt: string | null;
  notes: string | null;
};

export type OfferRecord = {
  id: string;
  applicationId: string;
  studentId: string;
  offerType: OfferType;
  status: OfferStatus;
  offerDate: string | null;
  responseDeadline: string | null;
  tuitionFee: string | null;
  scholarshipNote: string | null;
};

export type OfferRowView = {
  id: string;
  applicationId: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  university: string;
  program: string;
  country: string;
  offerType: OfferType;
  offerTypeLabel: string;
  status: OfferStatus;
  /** Derived pipeline label for the table (distinct from offer.status). */
  currentStatusLabel: string;
  conditionsTotal: number;
  conditionsMet: number;
  conditionsLabel: string;
  responseDeadline: string | null;
  deadlineAlert: boolean;
  deadlineOverdue: boolean;
  daysToDeadline: number | null;
  depositId: string | null;
  depositStatus: DepositStatus | null;
  depositSummary: string | null;
  canAccept: boolean;
};

export type DepositRowView = {
  id: string;
  offerId: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  university: string;
  applicationId: string;
  amount: number;
  currency: string;
  amountLabel: string;
  status: DepositStatus;
  statusLabel: string;
  dueDate: string | null;
  deadlineAlert: boolean;
  paidAt: string | null;
  reference: string | null;
};

export type CasI20RowView = {
  id: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  university: string;
  country: string;
  applicationId: string | null;
  offerId: string | null;
  recordType: CasI20Type;
  status: CasI20Status;
  statusLabel: string;
  referenceNumber: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  nextStatus: CasI20Status | null;
};

export type VisaRowView = {
  id: string;
  studentId: string;
  studentName: string;
  studentCaseId: string;
  university: string;
  country: string;
  applicationId: string | null;
  stage: VisaStage;
  stageLabel: string;
  decision: VisaDecision;
  decisionLabel: string;
  filedAt: string | null;
  biometricsAt: string | null;
  decisionAt: string | null;
  nextStage: VisaStage | null;
  casI20Id: string | null;
};

export type OffersVisaFilters = {
  metric?: OffersMetricTab;
  phase?: OffersPhaseTab;
  q?: string;
};

export type OffersVisaPayload = {
  metricCounts: Record<OffersMetricTab, number>;
  phaseCounts: Record<OffersPhaseTab, number>;
  offers: OfferRowView[];
  deposits: DepositRowView[];
  casI20: CasI20RowView[];
  visas: VisaRowView[];
  applicationsEligible: { id: string; studentId: string; studentName: string; university: string; country: string }[];
};

export type OfferDetailPayload = {
  offer: OfferRowView;
  conditions: OfferConditionRecord[];
  deposit: DepositRecord | null;
  casI20: CasI20Record | null;
  visa: VisaMilestoneRecord | null;
  history: { id: string; at: string; actorName: string; action: string; note: string | null }[];
};

export type NewOfferInput = {
  applicationId: string;
  offerType: OfferType;
  responseDeadline?: string;
  offerDate?: string;
  conditions?: string[];
  tuitionFee?: string;
  idempotencyKey?: string;
};

export type SetConditionMetInput = {
  conditionId: string;
  met: boolean;
};

export type AcceptOfferInput = {
  offerId: string;
};

export type DeclineOfferInput = {
  offerId: string;
  note?: string;
};

export type RecordDepositPaidInput = {
  depositId: string;
  reference: string;
  paidAt?: string;
};

export type AdvanceCasI20Input = {
  recordId: string;
  /** Required when advancing to issued. */
  referenceNumber?: string;
  issuedAt?: string;
  expiresAt?: string;
};

export type AdvanceVisaInput = {
  milestoneId: string;
  /** Only when advancing into or within Final Decision — never invented. */
  decision?: VisaDecision;
  note?: string;
};

export type ExportSummaryPayload = {
  generatedAt: string;
  csv: string;
  rowCount: number;
};