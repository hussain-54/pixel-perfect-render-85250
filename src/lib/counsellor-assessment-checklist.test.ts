import { describe, expect, it } from "vitest";
import {
  assessmentChecklistProgress,
  buildCounsellorAssessmentChecklist,
} from "./counsellor-assessment-checklist";
import type { AssessmentSaveInput } from "@/types/student-profile";

const emptyForm: AssessmentSaveInput = {
  eligibility: "",
  languageTest: "",
  languageScore: "",
  annualBudget: "",
  fundingSource: "",
  applicationTarget: 0,
  lastQualification: "",
  marksCgpa: "",
  educationGap: "",
  workExperience: "",
  preferredLevel: "",
  targetCountries: "",
  targetIntake: "",
  studyPlan: "",
  immediateNextStep: "",
};

describe("counsellor assessment checklist", () => {
  it("maps empty assessment to not_started / optional without inventing completion", () => {
    const sections = buildCounsellorAssessmentChecklist({
      form: emptyForm,
      studentName: "Sara Khan",
      studentCaseId: "GR-1",
      studentDestination: "UK",
      studentProgram: "CS",
      shortlistCount: 0,
      hasConsent: false,
      hasSavedAssessment: false,
      handoverStatus: null,
      assessmentDirty: false,
    });
    expect(sections.find((s) => s.id === "student_info")?.status).toBe("completed");
    expect(sections.find((s) => s.id === "academic")?.status).toBe("not_started");
    expect(sections.find((s) => s.id === "consent")?.status).toBe("not_started");
    expect(sections.find((s) => s.id === "eligibility_score")?.status).toBe("not_started");
    const progress = assessmentChecklistProgress(sections);
    expect(progress.completed).toBeGreaterThanOrEqual(1);
    expect(progress.percent).toBeLessThan(100);
  });

  it("marks english complete for Not taken yet and eligibility for real outcomes", () => {
    const form: AssessmentSaveInput = {
      ...emptyForm,
      languageTest: "Not taken yet",
      eligibility: "Good Fit",
      lastQualification: "Bachelor's degree",
      marksCgpa: "3.2",
      preferredLevel: "Master's",
      targetIntake: "Winter 2027",
      targetCountries: "United Kingdom",
      annualBudget: "PKR 4m",
      fundingSource: "Self / family",
      studyPlan: "Apply to 3 UK universities",
      immediateNextStep: "Collect IELTS booking",
      applicationTarget: 3,
    };
    const sections = buildCounsellorAssessmentChecklist({
      form,
      studentName: "Sara Khan",
      studentCaseId: "GR-1",
      studentDestination: "UK",
      studentProgram: "CS",
      shortlistCount: 2,
      hasConsent: true,
      hasSavedAssessment: true,
      handoverStatus: "submitted",
      assessmentDirty: false,
    });
    expect(sections.find((s) => s.id === "english")?.status).toBe("completed");
    expect(sections.find((s) => s.id === "eligibility_score")?.status).toBe("completed");
    expect(sections.find((s) => s.id === "consent")?.status).toBe("completed");
    expect(sections.find((s) => s.id === "next_steps")?.status).toBe("completed");
    expect(assessmentChecklistProgress(sections).percent).toBe(100);
  });
});
