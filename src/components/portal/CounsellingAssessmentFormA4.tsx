import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { fmtDate } from "@/components/common";
import type { StudentAssessmentRecord } from "@/types/student-profile";

const NAVY = "#17365D";
const BORDER = "#D8E0E8";
const WASH = "#F3F6FA";

function Banner({ title }: { title: string }) {
  return (
    <div className="px-3 py-1.5 text-[11px] font-bold tracking-wide text-white" style={{ backgroundColor: NAVY }}>
      {title}
    </div>
  );
}

function Cell({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2 px-3 py-2" : "px-3 py-2"} style={{ border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
        {label}
      </div>
      <div className="mt-1 min-h-[1.15rem] whitespace-pre-wrap text-[12px] text-slate-900">
        {children || "—"}
      </div>
    </div>
  );
}

export function CounsellingAssessmentFormA4({
  studentName,
  caseId,
  assessment,
}: {
  studentName: string;
  caseId: string;
  assessment: StudentAssessmentRecord;
}) {
  return (
    <article
      id="counselling-assessment-print-root"
      className="assessment-a4 mx-auto max-w-[210mm] bg-white text-slate-900"
      style={{ fontFamily: "Aptos, Calibri, 'Segoe UI', sans-serif" }}
    >
      <header className="flex items-start justify-between gap-4 border-b px-4 pb-3 pt-4" style={{ borderColor: BORDER }}>
        <div>
          <LogoMark className="h-11 w-auto" />
          <h1 className="mt-2 text-[18px] font-bold tracking-tight" style={{ color: NAVY }}>
            COUNSELLING ASSESSMENT
          </h1>
          <p className="text-[11px] text-slate-600">
            Academic eligibility · Study plan · Recommendations
          </p>
        </div>
        <div className="min-w-[9rem] rounded border px-3 py-2 text-right" style={{ borderColor: BORDER, backgroundColor: WASH }}>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
            Student / CRM ID
          </div>
          <div className="text-[15px] font-bold" style={{ color: NAVY }}>
            {caseId}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-800">{studentName}</div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        <section>
          <Banner title="1.  ASSESSMENT META" />
          <div className="grid grid-cols-2">
            <Cell label="Assessed by">{assessment.assessedByName || "—"}</Cell>
            <Cell label="Assessment date">
              {assessment.assessedAt ? fmtDate(assessment.assessedAt.slice(0, 10)) : "—"}
            </Cell>
            <Cell label="Last saved">
              {assessment.updatedAt ? fmtDate(assessment.updatedAt.slice(0, 10)) : "—"}
            </Cell>
            <Cell label="Eligibility outcome">{assessment.eligibility || "—"}</Cell>
          </div>
        </section>

        <section>
          <Banner title="2.  ACADEMIC BACKGROUND" />
          <div className="grid grid-cols-2">
            <Cell label="Last qualification">{assessment.lastQualification}</Cell>
            <Cell label="Marks / CGPA">{assessment.marksCgpa}</Cell>
            <Cell label="Education gap">{assessment.educationGap}</Cell>
            <Cell label="Work experience">{assessment.workExperience}</Cell>
            <Cell label="Preferred study level">{assessment.preferredLevel}</Cell>
            <Cell label="Application target">{String(assessment.applicationTarget ?? "—")}</Cell>
          </div>
        </section>

        <section>
          <Banner title="3.  ENGLISH PROFICIENCY" />
          <div className="grid grid-cols-2">
            <Cell label="English test">{assessment.languageTest}</Cell>
            <Cell label="Score">{assessment.languageScore}</Cell>
          </div>
        </section>

        <section>
          <Banner title="4.  BUDGET & FUNDING" />
          <div className="grid grid-cols-2">
            <Cell label="Annual budget">{assessment.annualBudget}</Cell>
            <Cell label="Funding source">{assessment.fundingSource}</Cell>
          </div>
        </section>

        <section>
          <Banner title="5.  DESTINATION & INTAKE" />
          <div className="grid grid-cols-2">
            <Cell label="Preferred destination">{assessment.targetCountries}</Cell>
            <Cell label="Intended intake">{assessment.targetIntake}</Cell>
          </div>
        </section>

        <section>
          <Banner title="6.  STUDY PLAN & NEXT STEPS" />
          <div className="grid grid-cols-2">
            <Cell label="Counsellor notes / study plan" full>
              {assessment.studyPlan}
            </Cell>
            <Cell label="Immediate next step" full>
              {assessment.immediateNextStep}
            </Cell>
          </div>
        </section>

        <div className="rounded px-3 py-2 text-[10px] leading-relaxed" style={{ backgroundColor: WASH, color: NAVY }}>
          <strong>CONFIDENTIAL</strong> — For Global Roots Consultants authorised staff use. This
          document reflects the saved counselling assessment. Internal staff notes and private audit
          logs are not included. Signup-fee claims are verified separately by Accounts.
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .assessment-a4 { box-shadow: none !important; max-width: none !important; }
        }
      `}</style>
    </article>
  );
}
