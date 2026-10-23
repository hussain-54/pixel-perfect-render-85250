import type { Application, DocumentStatus, StageKey, Student } from "@/types";

export type OfficerDashboardMetrics = {
  assignedStudents: number;
  appsInProgress: number;
  docsToReview: number;
  deadlinesThisWeek: number;
  /** Assigned students with counselling_agreements.consented = true. */
  counsellingCompleted: number;
  /** Open/in_progress tasks due today or earlier. */
  followUpsDue: number;
  /** Distinct students awaiting Admission handover and/or FD fee response. */
  awaitingResponse: number;
  /** Distinct students needing counsellor action (lifecycle / task / docs). */
  actionRequired: number;
};

export type OfficerDashboardTask = {
  id: string;
  title: string;
  studentId: string | null;
  studentName: string | null;
  dueAt: string;
  priority: "overdue" | "due_today" | "upcoming" | "normal";
  reminderRef?: string;
};

export type OfficerDashboardStudent = {
  id: string;
  name: string;
  destination: string;
  stage: StageKey;
  stageLabel: string;
  caseId?: string;
  lastActivity?: string;
  nextActionLabel?: string;
};

export type OfficerDashboardAttentionItem = {
  id: string;
  studentId: string;
  caseId: string;
  fullName: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
};

export type OfficerDashboardDoc = {
  id: string;
  studentId: string;
  studentName: string;
  category: string;
  uploaded: string;
  status: DocumentStatus;
};

export type OfficerDashboardDeadline = {
  id: string;
  kind: "application" | "offer";
  label: string;
  studentId: string;
  studentName: string;
  deadline: string;
  daysLeft: number;
};

/** Admission Team KPIs — distinct from counsellor student-lifecycle metrics. */
export type AdmissionDashboardMetrics = {
  assignedToMe: number;
  awaitingInitialReview: number;
  documentsMissing: number;
  inProgress: number;
  returnedForCorrection: number;
  submittedToUniversity: number;
  offersDecisionsReceived: number;
  actionRequired: number;
  upcomingDeadlines: number;
};

export type OfficerDashboardPayload = {
  greetingName: string;
  deskLabel: string;
  /** Counsellor vs Admission Team workbench presentation. */
  workbenchKind?: "counsellor" | "admission";
  metrics: OfficerDashboardMetrics;
  /** Populated when workbenchKind === "admission". */
  admissionMetrics?: AdmissionDashboardMetrics;
  todaysTasks: OfficerDashboardTask[];
  assignedOverview: OfficerDashboardStudent[];
  docsWaiting: OfficerDashboardDoc[];
  upcomingDeadlines: OfficerDashboardDeadline[];
  /** Prioritized actionable items (not a full student table). */
  needsAttention: OfficerDashboardAttentionItem[];
  /** Recent assigned-student activity with next-action labels. */
  recentActivity: OfficerDashboardStudent[];
  fetchedAt: string;
};

export type StudentDirectoryRow = {
  id: string;
  caseId: string;
  name: string;
  destination: string;
  intake: string;
  consultantId: string;
  consultantName: string;
  appsSubmitted: number;
  appsTotal: number;
  stage: StageKey;
  stageLabel: string;
  archived: boolean;
  lastActivity: string;
  nextActionLabel?: string;
  hasConsent?: boolean;
  followUpDue?: boolean;
};

export type StudentDirectoryFilters = {
  q?: string;
  country?: string;
  intake?: string;
  stage?: string;
  consultantId?: string;
  dateFrom?: string;
  dateTo?: string;
  archived?: boolean;
  page?: number;
  pageSize?: number;
};

export type StudentDirectoryResult = {
  rows: StudentDirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  filterOptions: {
    countries: string[];
    intakes: string[];
    stages: { key: string; label: string }[];
    consultants: { id: string; name: string }[];
    canFilterByConsultant: boolean;
    canRegister: boolean;
    canExport: boolean;
  };
};

export type StudentSearchHit = {
  id: string;
  caseId: string;
  name: string;
  phone: string;
  destination: string;
};

export type StudentDirectoryStudent = Student & {
  apps: Application[];
  consultantName: string;
};
