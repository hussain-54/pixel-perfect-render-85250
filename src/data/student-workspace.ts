/**
 * In-memory student workspace stores aligned with foundation tables
 * (student_assessments, student_academic_profiles, shortlist_items, internal_notes, offers).
 * Used until the migration is applied; no duplicate table definitions.
 */
import type {
  InternalNoteRecord,
  OfferVisaRecord,
  ShortlistItemRecord,
  StudentAssessmentRecord,
} from "@/types/student-profile";

function emptyAssessment(studentId: string): StudentAssessmentRecord {
  return {
    studentId,
    eligibility: "Pending Review",
    languageTest: "",
    languageScore: "",
    annualBudget: "",
    fundingSource: "",
    applicationTarget: 5,
    lastQualification: "",
    marksCgpa: "",
    educationGap: "",
    workExperience: "",
    preferredLevel: "",
    targetCountries: "",
    targetIntake: "",
    studyPlan: "",
    immediateNextStep: "",
    assessedById: null,
    assessedByName: "",
    assessedAt: null,
    updatedAt: null,
  };
}

/** Seeded assessments keyed by student id (authorized mock records). */
export const studentAssessments: Record<string, StudentAssessmentRecord> = {
  s1: {
    studentId: "s1",
    eligibility: "Good Fit",
    languageTest: "IELTS",
    languageScore: "6.5 Overall",
    annualBudget: "GBP 15,000 / yr",
    fundingSource: "Self-Funded + Scholarship",
    applicationTarget: 5,
    lastQualification: "BS Computer Science",
    marksCgpa: "3.2 / 4.0 (78%)",
    educationGap: "1 Year (Explained)",
    workExperience: "2 Years (Software Dev)",
    preferredLevel: "Master's Degree",
    targetCountries: "UK, Germany",
    targetIntake: "January 2027",
    studyPlan: "Progress to a UK/EU STEM master's with scholarship top-up.",
    immediateNextStep: "Shortlist Universities",
    assessedById: "c1",
    assessedByName: "Ayesha Khan",
    assessedAt: "2026-10-02T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
  },
  s4: {
    studentId: "s4",
    eligibility: "Borderline",
    languageTest: "IELTS",
    languageScore: "6.0 Overall",
    annualBudget: "EUR 12,000 / yr",
    fundingSource: "Self-Funded",
    applicationTarget: 3,
    lastQualification: "BSc Mechanical Engineering",
    marksCgpa: "2.9 / 4.0",
    educationGap: "None",
    workExperience: "1 Year (Intern)",
    preferredLevel: "Master's Degree",
    targetCountries: "Germany",
    targetIntake: "April 2027",
    studyPlan: "Raise IELTS to 7.0 then submit TU Munich pack.",
    immediateNextStep: "Retake IELTS",
    assessedById: "c1",
    assessedByName: "Ayesha Khan",
    assessedAt: "2026-09-28T09:00:00.000Z",
    updatedAt: "2026-09-28T09:00:00.000Z",
  },
  s8: {
    studentId: "s8",
    eligibility: "Good Fit",
    languageTest: "IELTS",
    languageScore: "7.0 Overall",
    annualBudget: "EUR 14,000 / yr",
    fundingSource: "Family + Scholarship",
    applicationTarget: 2,
    lastQualification: "BA Fine Arts",
    marksCgpa: "3.5 / 4.0",
    educationGap: "None",
    workExperience: "Freelance design (18 months)",
    preferredLevel: "Master's Degree",
    targetCountries: "Italy",
    targetIntake: "September 2026",
    studyPlan: "Complete portfolio corrections and submit Bologna file.",
    immediateNextStep: "Portfolio revision",
    assessedById: "c1",
    assessedByName: "Ayesha Khan",
    assessedAt: "2026-09-20T11:00:00.000Z",
    updatedAt: "2026-09-20T11:00:00.000Z",
  },
};

export const shortlistItems: ShortlistItemRecord[] = [
  {
    id: "sl1",
    studentId: "s1",
    universityName: "University of Leeds",
    programName: "MSc Data Science",
    country: "UK",
    suitabilityNote: "Strong Match - grades and budget align; submit Ready app.",
    sortOrder: 1,
  },
  {
    id: "sl2",
    studentId: "s1",
    universityName: "University of Essex",
    programName: "MSc Analytics",
    country: "UK",
    suitabilityNote: "Good Match - confirm scholarship eligibility first.",
    sortOrder: 2,
  },
  {
    id: "sl3",
    studentId: "s1",
    universityName: "TU Munich",
    programName: "MSc Informatics",
    country: "Germany",
    suitabilityNote: "Needs IELTS 7.0 before submission.",
    sortOrder: 3,
  },
];

export const internalNotes: InternalNoteRecord[] = [
  {
    id: "n1",
    studentId: "s1",
    authorId: "c1",
    authorName: "Ayesha Khan",
    body: "Student confirmed UK preference. Follow up on bank statement reissue.",
    pinned: true,
    createdAt: "2026-10-01T14:20:00.000Z",
  },
];

export const offerVisaRecords: OfferVisaRecord[] = [
  {
    id: "ov1",
    studentId: "s8",
    university: "University of Bologna",
    offerType: "Unconditional",
    status: "Awaiting Student Reply",
    conditionsSummary: "None (Clear)",
    acceptDeadline: "2026-10-20",
    depositStatus: "Due",
    casI20Status: "Pending",
    visaStage: "Doc Prep",
  },
];

export function getOrCreateAssessment(studentId: string): StudentAssessmentRecord {
  const existing = studentAssessments[studentId];
  if (existing) return existing;
  const created = emptyAssessment(studentId);
  studentAssessments[studentId] = created;
  return created;
}

export function upsertAssessment(row: StudentAssessmentRecord): StudentAssessmentRecord {
  studentAssessments[row.studentId] = row;
  return row;
}
