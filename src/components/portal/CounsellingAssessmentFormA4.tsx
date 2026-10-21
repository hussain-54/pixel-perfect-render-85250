import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { fmtDate } from "@/components/common";
import { displayOrBlank } from "@/lib/registration-form-a4";
import type { StudentAssessmentRecord } from "@/types/student-profile";

const NAVY = "#17365D";
const BORDER = "#D8E0E8";
const WASH = "#F3F6FA";

function Banner({ title }: { title: string }) {
  return (
    <div
      className="assessment-a4-banner px-2.5 py-1 text-[10px] font-bold tracking-wide text-white"
      style={{ backgroundColor: NAVY }}
    >
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
    <div
      className={
        full ? "assessment-a4-cell col-span-2 px-2 py-1" : "assessment-a4-cell px-2 py-1"
      }
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
        {label}
      </div>
      <div className="mt-0.5 min-h-[1rem] whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-900">
        {children || "—"}
      </div>
    </div>
  );
}

function val(value: string | null | undefined): string {
  return displayOrBlank(value, "—");
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
      style={{
        fontFamily: "Aptos, Calibri, 'Segoe UI', sans-serif",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <header
        className="assessment-a4-header flex items-start justify-between gap-3 border-b px-3 pb-2 pt-3"
        style={{ borderColor: BORDER }}
      >
        <div className="min-w-0">
          <LogoMark className="assessment-a4-logo h-9 w-auto" />
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color: NAVY }}>
            GlobalRoots Consultants
          </p>
          <h1 className="text-[15px] font-bold tracking-tight" style={{ color: NAVY }}>
            Counselling Assessment
          </h1>
        </div>
        <div
          className="assessment-a4-idbox shrink-0 rounded border px-2.5 py-1.5 text-right"
          style={{ borderColor: BORDER, backgroundColor: WASH }}
        >
          <div
            className="text-[9px] font-semibold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            Case ID
          </div>
          <div className="text-[13px] font-bold" style={{ color: NAVY }}>
            {caseId}
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-slate-800">{studentName}</div>
        </div>
      </header>

      <div className="assessment-a4-body space-y-1.5 p-3">
        <section>
          <Banner title="1. ASSESSMENT META" />
          <div className="grid grid-cols-2">
            <Cell label="Assessed by">{val(assessment.assessedByName)}</Cell>
            <Cell label="Assessment date">
              {assessment.assessedAt ? fmtDate(assessment.assessedAt.slice(0, 10)) : "—"}
            </Cell>
            <Cell label="Last saved">
              {assessment.updatedAt ? fmtDate(assessment.updatedAt.slice(0, 10)) : "—"}
            </Cell>
            <Cell label="Eligibility outcome">{val(assessment.eligibility)}</Cell>
          </div>
        </section>

        <section>
          <Banner title="2. ACADEMIC BACKGROUND" />
          <div className="grid grid-cols-2">
            <Cell label="Last qualification">{val(assessment.lastQualification)}</Cell>
            <Cell label="Marks / CGPA">{val(assessment.marksCgpa)}</Cell>
            <Cell label="Education gap">{val(assessment.educationGap)}</Cell>
            <Cell label="Work experience">{val(assessment.workExperience)}</Cell>
            <Cell label="Preferred study level">{val(assessment.preferredLevel)}</Cell>
            <Cell label="Application target">
              {typeof assessment.applicationTarget === "number"
                ? String(assessment.applicationTarget)
                : "—"}
            </Cell>
          </div>
        </section>

        <section>
          <Banner title="3. ENGLISH PROFICIENCY" />
          <div className="grid grid-cols-2">
            <Cell label="English test">{val(assessment.languageTest)}</Cell>
            <Cell label="Score">{val(assessment.languageScore)}</Cell>
          </div>
        </section>

        <section>
          <Banner title="4. BUDGET & FUNDING" />
          <div className="grid grid-cols-2">
            <Cell label="Annual budget">{val(assessment.annualBudget)}</Cell>
            <Cell label="Funding source">{val(assessment.fundingSource)}</Cell>
          </div>
        </section>

        <section>
          <Banner title="5. DESTINATION & INTAKE" />
          <div className="grid grid-cols-2">
            <Cell label="Preferred destination">{val(assessment.targetCountries)}</Cell>
            <Cell label="Intended intake">{val(assessment.targetIntake)}</Cell>
          </div>
        </section>

        <section>
          <Banner title="6. STUDY PLAN & NEXT STEPS" />
          <div className="grid grid-cols-2">
            <Cell label="Counsellor notes / study plan" full>
              {val(assessment.studyPlan)}
            </Cell>
            <Cell label="Immediate next step" full>
              {val(assessment.immediateNextStep)}
            </Cell>
          </div>
        </section>

        <p
          className="assessment-a4-note rounded px-2 py-1 text-[9px] leading-snug"
          style={{ backgroundColor: WASH, color: NAVY }}
        >
          CONFIDENTIAL — Authorised GlobalRoots staff only. Reflects the saved assessment. Signup-fee
          verification is handled separately by Accounts.
        </p>
      </div>

      <style>{`
        .assessment-a4 {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .assessment-a4 *,
        .assessment-a4 *::before,
        .assessment-a4 *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        .assessment-a4-banner {
          background-color: ${NAVY} !important;
          color: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .assessment-a4-idbox,
        .assessment-a4-note {
          background-color: ${WASH} !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .assessment-a4-cell {
          border-color: ${BORDER} !important;
        }
        .assessment-a4-logo {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          .assessment-a4 {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .assessment-a4-header {
            padding: 0 0 6px 0 !important;
          }
          .assessment-a4-body {
            padding: 6px 0 0 0 !important;
          }
          .assessment-a4-cell {
            padding: 3px 6px !important;
          }
          .assessment-a4-banner {
            padding: 3px 8px !important;
            font-size: 9px !important;
          }
        }
      `}</style>
    </article>
  );
}
