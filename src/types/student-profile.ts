import type { Application, Student, StudentDocument } from "@/types";

/** Manual eligibility label entered by the assessor - not algorithmically computed. */
export type EligibilityLabel = "Good Fit" | "Borderline" | "Not Ready" | "Pending Review" | "";

export type StudentAssessmentRecord = {
  studentId: string;
  eligibility: EligibilityLabel | string;
  languageTest: string;
  languageScore: string;
  annualBudget: string;
  fundingSource: string;
  /** Officer-set target application count (denominator for apps badge). */
  applicationTarget: number;
  lastQualification: string;
  marksCgpa: string;
  educationGap: string;
  workExperience: string;
  preferredLevel: string;
  targetCountries: string;
  targetIntake: string;
  studyPlan: string;
  immediateNextStep: string;
  assessedById: string | null;
  assessedByName: string;
  assessedAt: string | null;
  updatedAt: string | null;
};

export type ShortlistItemRecord = {
  id: string;
  studentId: string;
  universityName: string;
  programName: string;
  country: string;
  /** Free-text suitability note documented by the counsellor. */
  suitabilityNote: string;
  sortOrder: number;
};

export type InternalNoteRecord = {
  id: string;
  studentId: string;
  authorId: string | null;
  authorName: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type OfferVisaRecord = {
  id: string;
  studentId: string;
  university: string;
  offerType: "Conditional" | "Unconditional";
  status: string;
  conditionsSummary: string;
  acceptDeadline: string;
  depositStatus: string;
  casI20Status: string;
  visaStage: string;
};

export type StudentProfileWorkspace = {
  student: Student & {
    consultantName: string;
    intake: string;
    stageLabel: string;
  };
  assessment: StudentAssessmentRecord;
  shortlist: ShortlistItemRecord[];
  documents: StudentDocument[];
  applications: Application[];
  appsSubmittedCount: number;
  docsApprovedCount: number;
  docsTotalCount: number;
  notes: InternalNoteRecord[];
  offersVisa: OfferVisaRecord[];
  canEdit: boolean;
  canAddNote: boolean;
  canCreateApplication: boolean;
  /** Admission Team may Accept/Return counsellor handovers on this file. */
  canManageAdmissionHandover?: boolean;
  /** Counsellor vs Admission presentation for lifecycle chrome. */
  workbenchKind?: "counsellor" | "admission";
};

export type AssessmentSaveInput = Omit<
  StudentAssessmentRecord,
  "studentId" | "assessedById" | "assessedByName" | "assessedAt" | "updatedAt"
>;

export type NewApplicationInput = {
  studentId: string;
  university: string;
  country: string;
  program: string;
  intake: string;
  deadline: string;
};

export type ProfileTabId =
  | "assessment"
  | "overview"
  | "academic"
  | "documents"
  | "applications"
  | "offers-visa"
  | "notes";

/** Named profile tabs from wireframe page 4 (7 total). */
export const STUDENT_PROFILE_TABS: { id: ProfileTabId; label: string }[] = [
  { id: "assessment", label: "Assessment" },
  { id: "overview", label: "Overview" },
  { id: "academic", label: "Academic" },
  { id: "documents", label: "Documents" },
  { id: "applications", label: "Applications" },
  { id: "offers-visa", label: "Offers & Visa" },
  { id: "notes", label: "Notes" },
];
