export type StageKey =
  | "profile_submitted"
  | "consultation_completed"
  | "documents_submitted"
  | "documents_under_review"
  | "university_shortlisting"
  | "application_submitted"
  | "offer_received"
  | "visa_preparation"
  | "visa_submitted"
  | "visa_approved"
  | "travel_preparation"
  | "completed";

export interface Stage {
  key: StageKey;
  label: string;
  nextAction: string;
}

export interface Consultant {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
  metrics: {
    students: number;
    appointmentsCompleted: number;
    applicationsSubmitted: number;
    offers: number;
    visaCases: number;
    completedCases: number;
  };
}

export interface Student {
  id: string;
  caseId: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  dob: string;
  destination: string;
  program: string;
  studyLevel: string;
  stage: StageKey;
  consultantId: string;
  lastActivity: string;
  qualification: string;
  institution: string;
  grade: string;
  englishTest: string;
  /** Soft-archive flag — excluded from active directory by default. */
  archived?: boolean;
}

export type OfficerTaskPriority = "overdue" | "due_today" | "upcoming" | "normal";
export type OfficerTaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface OfficerTask {
  id: string;
  studentId: string | null;
  title: string;
  dueAt: string;
  priority: OfficerTaskPriority;
  status: OfficerTaskStatus;
  assigneeId: string;
  reminderRef?: string;
}

export type AppointmentStatus =
  "Requested" | "Confirmed" | "Rescheduled" | "Completed" | "Cancelled" | "No Show";
export type AppointmentType =
  | "Free Consultation"
  | "University Counseling"
  | "Scholarship Consultation"
  | "Visa Consultation"
  | "Application Review";

export interface Appointment {
  id: string;
  studentId: string;
  /** DB has no type column; live rows may use the neutral "—" placeholder. */
  type: AppointmentType | "—";
  date: string;
  time: string;
  consultantId: string;
  destination: string;
  studyLevel: string;
  status: AppointmentStatus;
  notes?: string;
  /** Server-enriched display name (live plane); mock UI may still use lookupStudent. */
  studentName?: string;
  /** Server-enriched display name (live plane); mock UI may still use lookupConsultant. */
  consultantName?: string;
}

export type DocumentStatus = "Pending Review" | "Approved" | "Rejected" | "Needs Correction";
export interface StudentDocument {
  id: string;
  studentId: string;
  name: string;
  category: string;
  uploaded: string;
  status: DocumentStatus;
  comment?: string;
  reviewer?: string;
  /** Passport or certificate expiry. Absent when the document type has none. */
  expiresOn?: string;
  /** File version. Greater than 1 means the student re-uploaded. */
  version?: number;
  linkedApplicationId?: string;
  uploadedBy?: string;
  /** Officer requested the file; the student has not uploaded it yet. */
  awaitingUpload?: boolean;
  /** Private storage metadata — never a public URL. */
  storageBucket?: string;
  storagePath?: string | null;
  mimeType?: string;
  fileSizeBytes?: number;
  currentVersionId?: string | null;
}

export type ApplicationStatus =
  | "Docs Pending"
  | "Under Review"
  | "Ready to Submit"
  | "Submitted"
  | "Offer Received"
  | "Rejected"
  | "Withdrawn";
export interface Application {
  id: string;
  studentId: string;
  university: string;
  country: string;
  program: string;
  intake: string;
  appliedOn: string;
  deadline: string;
  status: ApplicationStatus;
  officerId: string;
}

export type LeadStatus =
  "New" | "Contacted" | "Consultation Booked" | "Qualified" | "Converted" | "Lost";
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  program: string;
  source: string;
  consultantId: string | null;
  status: LeadStatus;
  created: string;
}

export interface University {
  id: string;
  name: string;
  country: string;
  city: string;
  levels: string[];
  programs: string[];
  scholarship: boolean;
  ranking: string;
}

export type FundingType = "Fully Funded" | "Partial Funding" | "Tuition Waiver";
export interface Scholarship {
  id: string;
  name: string;
  country: string;
  level: string;
  funding: FundingType;
  field: string;
  eligibility: string;
  deadline: string;
}

export interface Notification {
  id: string;
  audience: "student" | "staff" | "admin";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

export interface ActivityItem {
  date: string;
  title: string;
  by?: string;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  date: string;
  time: string;
}
