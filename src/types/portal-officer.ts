import type { Application, DocumentStatus, StageKey, Student } from "@/types";

export type OfficerDashboardMetrics = {
  assignedStudents: number;
  appsInProgress: number;
  docsToReview: number;
  deadlinesThisWeek: number;
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

export type OfficerDashboardPayload = {
  greetingName: string;
  deskLabel: string;
  metrics: OfficerDashboardMetrics;
  todaysTasks: OfficerDashboardTask[];
  assignedOverview: OfficerDashboardStudent[];
  docsWaiting: OfficerDashboardDoc[];
  upcomingDeadlines: OfficerDashboardDeadline[];
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
