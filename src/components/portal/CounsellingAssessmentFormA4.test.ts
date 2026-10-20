import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CounsellingAssessmentFormA4 } from "./CounsellingAssessmentFormA4";
import type { StudentAssessmentRecord } from "@/types/student-profile";

const sample: StudentAssessmentRecord = {
  studentId: "s1",
  eligibility: "Good Fit",
  languageTest: "IELTS",
  languageScore: "6.5",
  annualBudget: "PKR 4M",
  fundingSource: "Family",
  applicationTarget: 3,
  lastQualification: "Bachelor",
  marksCgpa: "3.2",
  educationGap: "None",
  workExperience: "1",
  preferredLevel: "Masters",
  targetCountries: "UK",
  targetIntake: "Fall 2027",
  studyPlan: "Apply to three UK programmes.",
  immediateNextStep: "Collect transcripts",
  assessedById: "c1",
  assessedByName: "A. Counsellor",
  assessedAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
};

describe("CounsellingAssessmentFormA4", () => {
  it("renders branded A4 content from saved assessment fields", () => {
    const html = renderToStaticMarkup(
      createElement(CounsellingAssessmentFormA4, {
        studentName: "Test Student",
        caseId: "GR-1001",
        assessment: sample,
      }),
    );
    expect(html).toContain("COUNSELLING ASSESSMENT");
    expect(html).toContain("GR-1001");
    expect(html).toContain("Test Student");
    expect(html).toContain("Good Fit");
    expect(html).toContain("Apply to three UK programmes.");
    expect(html).toContain("CONFIDENTIAL");
    expect(html).toContain("@page");
    expect(html).toContain("A4");
  });
});
