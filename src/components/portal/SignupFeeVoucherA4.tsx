import { LogoMark } from "@/components/Logo";
import { fmtDate } from "@/components/common";
import { siteContact } from "@/data/contact";
import {
  SIGNUP_FEE_CATEGORY_LABEL,
  SIGNUP_FEE_VOUCHER_TITLE,
  buildSignupFeePaymentInstructions,
  describeSignupFeeOperationalStatus,
  formatSignupFeeAmount,
  signupFeeVoucherNumber,
} from "@/lib/signup-fee-voucher";
import { displayOrBlank } from "@/lib/registration-form-a4";

const NAVY = "#17365D";
const BORDER = "#D8E0E8";
const WASH = "#F3F6FA";

export type SignupFeeVoucherA4Props = {
  feeId: string;
  caseId: string;
  studentName: string;
  amount: number;
  currency: string;
  status: string | null | undefined;
  issuedAt?: string | null;
  consultancyName?: string;
  supportEmail?: string;
};

/**
 * Print-ready A4 fee voucher. Unpaid / claimed copies never show a Verified seal.
 * Re-printing uses the same feeId → same voucher number (no new obligation).
 */
export function SignupFeeVoucherA4({
  feeId,
  caseId,
  studentName,
  amount,
  currency,
  status,
  issuedAt,
  consultancyName = "Global Roots Consultants",
  supportEmail = siteContact.email.display,
}: SignupFeeVoucherA4Props) {
  const voucherNo = signupFeeVoucherNumber(feeId);
  const ops = describeSignupFeeOperationalStatus(status);
  const showVerifiedSeal = ops.tone === "verified" || ops.tone === "waived";
  const instructions = buildSignupFeePaymentInstructions({
    supportEmail,
    officeDisplay: siteContact.location.fullDisplay,
    phoneDisplay: siteContact.phone.display,
    phonePlaceholder: siteContact.phone.placeholder,
  });
  const amountLabel = formatSignupFeeAmount(amount, currency);
  const issueDate = issuedAt
    ? fmtDate(issuedAt.slice(0, 10))
    : fmtDate(new Date().toISOString().slice(0, 10));

  return (
    <article
      className="signup-fee-voucher-a4 mx-auto bg-white text-navy shadow-sm print:shadow-none"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "14mm 16mm",
        boxSizing: "border-box",
        color: NAVY,
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <header
        className="flex items-start justify-between gap-4 border-b pb-4"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-start gap-3">
          <LogoMark className="h-14 w-14 shrink-0" />
          <div>
            <p className="text-lg font-bold leading-tight" style={{ color: NAVY }}>
              {consultancyName}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-navy/70">
              {siteContact.location.fullDisplay}
            </p>
            <p className="text-[11px] text-navy/70">{supportEmail}</p>
            {siteContact.registration ? (
              <p className="text-[10px] text-navy/55">{siteContact.registration}</p>
            ) : null}
          </div>
        </div>
        <div className="text-right text-[11px]">
          <p className="font-semibold uppercase tracking-wide text-navy/60">Document</p>
          <p className="mt-0.5 font-mono text-xs font-semibold">{voucherNo || "—"}</p>
          <p className="mt-2 text-navy/65">Issued {issueDate}</p>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: NAVY }}>
            {SIGNUP_FEE_VOUCHER_TITLE}
          </h1>
          <p className="mt-1 max-w-md text-sm text-navy/70">
            Signup / intake fee only — separate from university or application fees.
          </p>
        </div>
        <div
          className="rounded border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
          style={{
            borderColor: showVerifiedSeal ? "#166534" : BORDER,
            background: showVerifiedSeal ? "#ecfdf5" : WASH,
            color: showVerifiedSeal ? "#166534" : NAVY,
          }}
        >
          {ops.voucherBadge}
        </div>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded border p-3" style={{ borderColor: BORDER, background: WASH }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-navy/55">Student</p>
          <p className="mt-1 font-semibold">{displayOrBlank(studentName)}</p>
          <p className="mt-1 text-xs text-navy/65">Case {displayOrBlank(caseId)}</p>
        </div>
        <div className="rounded border p-3" style={{ borderColor: BORDER, background: WASH }}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-navy/55">Fee category</p>
          <p className="mt-1 font-semibold">{SIGNUP_FEE_CATEGORY_LABEL}</p>
          <p className="mt-1 text-xs text-navy/65">One current signup-fee obligation per student</p>
        </div>
      </section>

      <section className="mt-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: NAVY, color: "#fff" }}>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-3 py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b" style={{ borderColor: BORDER }}>
              <td className="px-3 py-2.5">{SIGNUP_FEE_CATEGORY_LABEL}</td>
              <td className="px-3 py-2.5 text-right font-medium">{amountLabel}</td>
            </tr>
            <tr style={{ background: WASH }}>
              <td className="px-3 py-2.5 font-bold">Total payable</td>
              <td className="px-3 py-2.5 text-right text-base font-bold">{amountLabel}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-5 rounded border p-3 text-sm" style={{ borderColor: BORDER }}>
        <p className="text-[10px] font-bold uppercase tracking-wide text-navy/55">
          Payment instructions
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12px] leading-snug text-navy/80">
          {instructions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] font-medium text-navy">
          Quote voucher reference <span className="font-mono">{voucherNo}</span> when submitting
          proof to Front Desk.
        </p>
      </section>

      {!showVerifiedSeal ? (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950">
          This document is a payment voucher, not a verified receipt. A screenshot or bank slip
          alone does not confirm payment until Finance / Accounts verifies the claim.
        </p>
      ) : (
        <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-950">
          Finance has recorded a {ops.tone} decision for this signup fee. University fees remain a
          separate ledger.
        </p>
      )}

      <footer
        className="mt-8 border-t pt-3 text-[10px] text-navy/55"
        style={{ borderColor: BORDER }}
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p>
            {consultancyName} · Generated from authorized signup fee record · Ref {voucherNo || "—"}
          </p>
          <p>Page 1 of 1 · A4</p>
        </div>
      </footer>
    </article>
  );
}
