import { LogoMark } from "@/components/Logo";
import type { FrontDeskIntakeRow } from "@/server/portal-front-desk";
import { fmtDate } from "@/components/common";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="border-b border-slate-200 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value?.trim() ? value : "—"}</div>
    </div>
  );
}

export function FrontDeskRegistrationFormA4({
  row,
  mode = "view",
}: {
  row: FrontDeskIntakeRow;
  mode?: "view" | "print";
}) {
  const feeClaim =
    row.signupFeeStatus || row.signupFeeAmount != null
      ? [
          row.signupFeeStatus ? `Status: ${row.signupFeeStatus.replaceAll("_", " ")}` : null,
          row.signupFeeAmount != null
            ? `Claimed amount: ${row.signupFeeAmount} ${row.signupFeeCurrency || ""}`.trim()
            : null,
          row.signupFeeMethod ? `Method: ${row.signupFeeMethod}` : null,
          row.signupFeeReference ? `Reference: ${row.signupFeeReference}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "No signup fee claim recorded";

  return (
    <article
      className={
        mode === "print"
          ? "mx-auto max-w-[210mm] bg-white p-8 text-slate-900 print:max-w-none print:p-0"
          : "rounded-lg border border-border bg-card p-6 text-foreground"
      }
    >
      <header className="mb-6 flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
        <div>
          <LogoMark className="h-10 w-auto" />
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            Global Roots Consultants
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Student Registration Form</h1>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold text-navy">CRM / Student ID</div>
          <div className="text-lg font-bold">{row.caseId}</div>
          <div className="mt-1 text-xs text-slate-500">Registered {fmtDate(row.createdAt)}</div>
        </div>
      </header>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          1. Student &amp; contact
        </h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field label="Full name" value={row.fullName} />
          <Field label="Email" value={row.email} />
          <Field label="Phone" value={row.phone} />
          <Field label="WhatsApp" value={row.whatsapp} />
          <Field label="City" value={row.city} />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          2. Study preferences &amp; intake
        </h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field label="Preferred destination" value={row.destination} />
          <Field label="Programme / course" value={row.program} />
          <Field label="Study level" value={row.studyLevel} />
          <Field label="Intended intake date" value={row.intakeDate} />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          3. Inquiry channel &amp; source
        </h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field label="Inquiry channel" value={row.inquiryChannel?.replaceAll("_", " ")} />
          <Field label="Inquiry source" value={row.inquirySource} />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          4. Registration notes
        </h2>
        <p className="min-h-[3rem] whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          {row.registrationNotes?.trim() || "—"}
        </p>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          5. Signup fee claim (not verified payment)
        </h2>
        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {feeClaim}. Claimed receipts are not verified payments. Accounts verification is required
          before portal CRM activation.
        </p>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          6. Counsellor assignment &amp; handover
        </h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field
            label="Assigned counsellor"
            value={row.counsellorName || (row.assignmentStatus === "assigned" ? "Assigned" : "Pending")}
          />
          <Field label="Journey stage" value={row.journeyStage?.replaceAll("_", " ")} />
          <Field label="Next follow-up" value={row.nextFollowUpAt} />
          <Field label="Last updated" value={fmtDate(row.updatedAt)} />
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
          7. Registrar &amp; signatures
        </h2>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Field label="Registered by" value={row.registrarName || row.registeredBy} />
          <Field label="Registration date" value={fmtDate(row.createdAt)} />
        </div>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="h-12 border-b border-slate-400" />
            <div className="mt-1 text-xs text-slate-500">Student / guardian signature</div>
          </div>
          <div>
            <div className="h-12 border-b border-slate-400" />
            <div className="mt-1 text-xs text-slate-500">Front Desk registrar signature</div>
          </div>
        </div>
      </section>

      <footer className="mt-8 border-t border-slate-300 pt-3 text-[10px] leading-relaxed text-slate-500">
        Confidential — for Global Roots Consultants internal workflow use. Do not treat a claimed
        fee receipt as verified payment. Portal CRM access requires authorised fee verification or
        waiver. Linked documents, applications, and audit history remain with the student case
        record.
      </footer>
    </article>
  );
}
