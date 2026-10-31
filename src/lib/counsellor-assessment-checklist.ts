/**
 * Counsellor assessment checklist — maps existing assessment fields to
 * organizational sections. Does not invent mandatory questions or scores.
 */
import type { AssessmentSaveInput } from "@/types/student-profile";
import { isEligibilityOutcome } from "@/lib/counsellor-handover-rules";

export type AssessmentSectionStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "needs_review"
  | "optional";

export type AssessmentChecklistSectionId =
  | "student_info"
  | "academic"
  | "study_preferences"
  | "career_programme"
  | "destination_university"
  | "english"
  | "financial"
  | "eligibility_score"
  | "consent"
  | "counsellor_summary"
  | "next_steps";

export type AssessmentChecklistSection = {
  id: AssessmentChecklistSectionId;
  title: string;
  status: AssessmentSectionStatus;
  hint: string;
  /** Anchor id for click-to-scroll */
  anchor: string;
};

export type AssessmentChecklistInput = {
  form: AssessmentSaveInput;
  /** Student profile fields shown as read-only context. */
  studentName: string;
  studentCaseId: string;
  studentDestination: string;
  studentProgram: string;
  shortlistCount: number;
  hasConsent: boolean;
  hasSavedAssessment: boolean;
  handoverStatus: string | null | undefined;
  assessmentDirty: boolean;
};

function filled(value: string | number | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  return Boolean((value ?? "").toString().trim());
}

function academicStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  const fields = [
    form.lastQualification,
    form.marksCgpa,
    form.educationGap,
    form.workExperience,
  ];
  const n = fields.filter((f) => filled(f)).length;
  if (n === 0) return "not_started";
  if (n >= 2) return "completed";
  return "in_progress";
}

function studyPreferencesStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  const n = [form.preferredLevel, form.targetIntake].filter((f) => filled(f)).length;
  if (n === 0) return "not_started";
  if (n === 2) return "completed";
  return "in_progress";
}

function careerStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  const n = [form.studyPlan, form.immediateNextStep].filter((f) => filled(f)).length;
  if (n === 0) return "not_started";
  if (n === 2) return "completed";
  return "in_progress";
}

function destinationStatus(
  form: AssessmentSaveInput,
  shortlistCount: number,
): AssessmentSectionStatus {
  const dest = filled(form.targetCountries);
  const intake = filled(form.targetIntake);
  if (!dest && !intake && shortlistCount === 0) return "not_started";
  if (dest && (intake || shortlistCount > 0)) return "completed";
  return "in_progress";
}

function englishStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  if (!filled(form.languageTest)) return "not_started";
  if (form.languageTest === "Not taken yet") return "completed";
  if (filled(form.languageScore)) return "completed";
  return "in_progress";
}

function financialStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  const n = [form.annualBudget, form.fundingSource].filter((f) => filled(f)).length;
  if (n === 0) return "not_started";
  if (n === 2) return "completed";
  return "in_progress";
}

function eligibilityStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  const raw = (form.eligibility ?? "").trim();
  if (!raw) return "not_started";
  if (!isEligibilityOutcome(raw)) return "needs_review";
  if (raw === "Pending Review") return "in_progress";
  return "completed";
}

function summaryStatus(form: AssessmentSaveInput): AssessmentSectionStatus {
  const n = [form.studyPlan, form.immediateNextStep].filter((f) => filled(f)).length;
  if (n === 0) return "optional";
  if (n === 2) return "completed";
  return "in_progress";
}

function nextStepsStatus(input: AssessmentChecklistInput): AssessmentSectionStatus {
  const hand = (input.handoverStatus ?? "").trim().toLowerCase();
  if (hand === "accepted" || hand === "submitted") return "completed";
  if (hand === "returned") return "needs_review";
  if (input.hasSavedAssessment && input.hasConsent) return "in_progress";
  if (input.hasSavedAssessment) return "in_progress";
  return "not_started";
}

export function buildCounsellorAssessmentChecklist(
  input: AssessmentChecklistInput,
): AssessmentChecklistSection[] {
  const studentOk =
    filled(input.studentName) && filled(input.studentCaseId) ? "completed" : "not_started";

  return [
    {
      id: "student_info",
      title: "Student Information",
      status: studentOk,
      hint: "Case identity from the student record",
      anchor: "assess-section-student",
    },
    {
      id: "academic",
      title: "Academic Background",
      status: academicStatus(input.form),
      hint: "Qualification, marks, gap, experience",
      anchor: "assess-section-academic",
    },
    {
      id: "study_preferences",
      title: "Study Preferences",
      status: studyPreferencesStatus(input.form),
      hint: "Study level and intake",
      anchor: "assess-section-study",
    },
    {
      id: "career_programme",
      title: "Career & Programme Assessment",
      status: careerStatus(input.form),
      hint: "Study plan and immediate next step",
      anchor: "assess-section-career",
    },
    {
      id: "destination_university",
      title: "Destination & University Preferences",
      status: destinationStatus(input.form, input.shortlistCount),
      hint: "Destination, intake, shortlist count",
      anchor: "assess-section-destination",
    },
    {
      id: "english",
      title: "English Language Proficiency",
      status: englishStatus(input.form),
      hint: "Test type and score",
      anchor: "assess-section-english",
    },
    {
      id: "financial",
      title: "Financial Readiness",
      status: financialStatus(input.form),
      hint: "Budget and funding source",
      anchor: "assess-section-financial",
    },
    {
      id: "eligibility_score",
      title: "Counselling Assessment & Outcome",
      status: eligibilityStatus(input.form),
      hint: "Manual eligibility outcome (not an algorithmic score)",
      anchor: "assess-section-eligibility",
    },
    {
      id: "consent",
      title: "Student Consent",
      status: input.hasConsent ? "completed" : "not_started",
      hint: input.hasConsent
        ? "Persisted counselling agreement on file"
        : "Consent is recorded only after an explicit action",
      anchor: "assess-section-consent",
    },
    {
      id: "counsellor_summary",
      title: "Counsellor Summary",
      status: summaryStatus(input.form),
      hint: "Notes and recommendations",
      anchor: "assess-section-summary",
    },
    {
      id: "next_steps",
      title: "Next Steps & Handover",
      status: nextStepsStatus(input),
      hint: input.assessmentDirty
        ? "Unsaved assessment changes"
        : "Fee verification and Admission handover",
      anchor: "wb-lifecycle-panel",
    },
  ];
}

export function assessmentChecklistProgress(sections: AssessmentChecklistSection[]): {
  completed: number;
  tracked: number;
  percent: number;
} {
  const tracked = sections.filter((s) => s.status !== "optional");
  const completed = tracked.filter((s) => s.status === "completed").length;
  const percent = tracked.length ? Math.round((completed / tracked.length) * 100) : 0;
  return { completed, tracked: tracked.length, percent };
}

export function assessmentStatusLabel(status: AssessmentSectionStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "needs_review":
      return "Needs review";
    case "optional":
      return "Optional";
    default:
      return "Not started";
  }
}
