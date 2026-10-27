import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { fmtDate } from "@/components/common";
import { intakeDateToSeasonYear } from "@/lib/front-desk-intake-manage";
import { describePersistedSignupFeeStatus, displayOrBlank } from "@/lib/registration-form-a4";
import type { FrontDeskIntakeRow } from "@/server/portal-front-desk";

const NAVY = "#17365D";
const BORDER = "#D8E0E8";
const WASH = "#F3F6FA";

function mark(checked: boolean): string {
  return checked ? "☑" : "☐";
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function destinationBucket(destination: string | null | undefined): string {
  const d = normalize(destination);
  if (!d) return "";
  if (/\buk\b|united kingdom|england|scotland|wales/.test(d)) return "uk";
  if (/\busa\b|united states|\bus\b/.test(d)) return "usa";
  if (/canada/.test(d)) return "canada";
  if (/australia/.test(d)) return "australia";
  if (
    /europe|france|germany|italy|spain|netherlands|ireland|sweden|finland|hungary|lithuania|austria|belgium|poland|portugal|denmark|czech/.test(
      d,
    )
  ) {
    return "europe";
  }
  return "other";
}

function studyLevelBucket(level: string | null | undefined): string {
  const v = normalize(level);
  if (!v) return "";
  if (/foundation|pathway|diploma/.test(v)) return "foundation";
  if (/bachelor|undergrad/.test(v)) return "bachelors";
  if (/master|mphil/.test(v)) return "masters";
  if (/phd|doctor/.test(v)) return "phd";
  return "other";
}

function inquiryChannelBucket(channel: string | null | undefined): string {
  const v = normalize(channel).replaceAll(" ", "_");
  if (!v) return "";
  if (v === "physical") return "physical";
  if (v === "online") return "online";
  if (v === "phone") return "phone";
  if (v === "whatsapp") return "whatsapp";
  if (v === "referral") return "referral";
  if (v === "education_expo") return "expo";
  if (v === "social_media") return "social";
  return "other";
}

function paymentMethodBucket(method: string | null | undefined): string {
  const v = normalize(method);
  if (!v) return "";
  if (/cash/.test(v)) return "cash";
  if (/bank|transfer/.test(v)) return "bank";
  if (/online|card|jazz|easypaisa/.test(v)) return "online";
  return "other";
}

function SectionBanner({ title }: { title: string }) {
  return (
    <div
      className="registration-a4-banner px-2.5 py-1 text-[10px] font-bold tracking-wide text-white"
      style={{ backgroundColor: NAVY }}
    >
      {title}
    </div>
  );
}

function FieldCell({
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
        full ? "registration-a4-cell col-span-2 px-2 py-1" : "registration-a4-cell px-2 py-1"
      }
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wide" style={{ color: NAVY }}>
        {label}
      </div>
      <div className="mt-0.5 min-h-[1rem] text-[11px] leading-snug text-slate-900">{children}</div>
    </div>
  );
}

function ChoiceRow({ options }: { options: { label: string; checked: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-slate-800">
      {options.map((o) => (
        <span key={o.label}>
          {mark(o.checked)} {o.label}
        </span>
      ))}
    </div>
  );
}

function ValueLine({ value }: { value: string | null | undefined }) {
  const v = value?.trim();
  return <span className="break-words font-medium">{v || "—"}</span>;
}

export function FrontDeskRegistrationFormA4({
  row,
  mode = "view",
}: {
  row: FrontDeskIntakeRow;
  mode?: "view" | "print";
}) {
  const whatsappSame =
    Boolean(row.phone?.trim()) &&
    Boolean(row.whatsapp?.trim()) &&
    normalize(row.phone) === normalize(row.whatsapp);
  const dest = destinationBucket(row.destination);
  const level = studyLevelBucket(row.studyLevel);
  const intake = intakeDateToSeasonYear(row.intakeDate);
  const channel = inquiryChannelBucket(row.inquiryChannel);
  const pay = paymentMethodBucket(row.signupFeeMethod);
  const feeDisplay = describePersistedSignupFeeStatus(row.signupFeeStatus);
  const feeAmount =
    row.signupFeeAmount != null && !Number.isNaN(Number(row.signupFeeAmount))
      ? `${row.signupFeeCurrency || "PKR"} ${Number(row.signupFeeAmount).toLocaleString()}`
      : null;

  return (
    <article
      className={
        mode === "print"
          ? "registration-a4 registration-a4--print mx-auto max-w-[210mm] bg-white text-slate-900"
          : "registration-a4 rounded-lg border border-border bg-white text-slate-900 shadow-sm"
      }
      style={{
        fontFamily: "Aptos, Calibri, 'Segoe UI', sans-serif",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      <header
        className="registration-a4-header flex items-start justify-between gap-3 border-b px-3 pb-2 pt-3"
        style={{ borderColor: BORDER }}
      >
        <div className="min-w-0">
          <LogoMark className="registration-a4-logo h-9 w-auto" />
          <p className="mt-0.5 text-[11px] font-semibold" style={{ color: NAVY }}>
            GlobalRoots Consultants
          </p>
          <h1 className="text-[15px] font-bold tracking-tight" style={{ color: NAVY }}>
            Student Registration Form
          </h1>
        </div>
        <div
          className="registration-a4-idbox shrink-0 rounded border px-2.5 py-1.5 text-right"
          style={{ borderColor: BORDER, backgroundColor: WASH }}
        >
          <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
            Case ID
          </div>
          <div className="text-[13px] font-bold" style={{ color: NAVY }}>
            {row.caseId}
          </div>
          <div className="text-[9px] text-slate-500">{fmtDate(row.createdAt)}</div>
        </div>
      </header>

      <div className="registration-a4-body space-y-1.5 p-3">
        <section>
          <SectionBanner title="1. STUDENT & CONTACT" />
          <div className="grid grid-cols-2">
            <FieldCell label="Full name *">
              <ValueLine value={row.fullName} />
            </FieldCell>
            <FieldCell label="Email *">
              <ValueLine value={row.email} />
            </FieldCell>
            <FieldCell label="Phone *">
              <ValueLine value={row.phone} />
            </FieldCell>
            <FieldCell label="WhatsApp same as phone">
              <ChoiceRow
                options={[
                  { label: "Yes", checked: whatsappSame },
                  { label: "No", checked: Boolean(row.whatsapp?.trim()) && !whatsappSame },
                ]}
              />
            </FieldCell>
            <FieldCell label="WhatsApp">
              <ValueLine value={row.whatsapp} />
            </FieldCell>
            <FieldCell label="City">
              <ValueLine value={row.city} />
            </FieldCell>
          </div>
        </section>

        <section>
          <SectionBanner title="2. STUDY PREFERENCES" />
          <div className="grid grid-cols-2">
            <FieldCell label="Preferred destination *">
              <ChoiceRow
                options={[
                  { label: "UK", checked: dest === "uk" },
                  { label: "USA", checked: dest === "usa" },
                  { label: "Canada", checked: dest === "canada" },
                  { label: "Australia", checked: dest === "australia" },
                  { label: "Europe", checked: dest === "europe" },
                  { label: "Other", checked: dest === "other" },
                ]}
              />
              {dest === "other" || dest === "europe" ? (
                <div className="mt-0.5 text-[10px] text-slate-700">
                  Recorded: <ValueLine value={row.destination} />
                </div>
              ) : null}
            </FieldCell>
            <FieldCell label="Course / programme *">
              <ValueLine value={row.program} />
            </FieldCell>
            <FieldCell label="Study level">
              <ChoiceRow
                options={[
                  { label: "Foundation", checked: level === "foundation" },
                  { label: "Bachelor's", checked: level === "bachelors" },
                  { label: "Master's", checked: level === "masters" },
                  { label: "PhD", checked: level === "phd" },
                  { label: "Other", checked: level === "other" },
                ]}
              />
            </FieldCell>
            <FieldCell label="Intake">
              <ChoiceRow
                options={[
                  { label: "Winter", checked: intake.season === "Winter" },
                  { label: "Summer", checked: intake.season === "Summer" },
                  { label: "Spring", checked: intake.season === "Spring" },
                  { label: "Autumn", checked: intake.season === "Autumn" },
                  { label: "Other", checked: intake.season === "Other" },
                ]}
              />
              <div className="mt-0.5">
                <ChoiceRow
                  options={["2026", "2027", "2028", "2029"].map((y) => ({
                    label: y,
                    checked: intake.year === y,
                  }))}
                />
              </div>
            </FieldCell>
            <FieldCell label="Inquiry channel">
              <ChoiceRow
                options={[
                  { label: "Visit", checked: channel === "physical" },
                  { label: "Online", checked: channel === "online" },
                  { label: "Phone", checked: channel === "phone" },
                  { label: "WhatsApp", checked: channel === "whatsapp" },
                  { label: "Referral", checked: channel === "referral" },
                  { label: "Expo", checked: channel === "expo" },
                  { label: "Social", checked: channel === "social" },
                  { label: "Other", checked: channel === "other" },
                ]}
              />
            </FieldCell>
            <FieldCell label="Inquiry source">
              <ValueLine value={row.inquirySource} />
            </FieldCell>
            {row.registrationNotes?.trim() ? (
              <FieldCell label="Registration notes" full>
                <p className="whitespace-pre-wrap text-[10px] leading-snug">
                  {row.registrationNotes.trim()}
                </p>
              </FieldCell>
            ) : null}
          </div>
        </section>

        <section>
          <SectionBanner title="3. SIGNUP FEE — Claimed ≠ Verified" />
          <div className="grid grid-cols-2">
            <FieldCell label="Amount">
              <ValueLine value={feeAmount} />
            </FieldCell>
            <FieldCell label="Payment method">
              <ChoiceRow
                options={[
                  { label: "Cash", checked: pay === "cash" },
                  { label: "Bank", checked: pay === "bank" },
                  { label: "Online", checked: pay === "online" },
                  { label: "Other", checked: pay === "other" },
                ]}
              />
            </FieldCell>
            <FieldCell label="Receipt / reference">
              <ValueLine value={row.signupFeeReference} />
            </FieldCell>
            <FieldCell label="Fee status">
              <div className="font-semibold" style={{ color: NAVY }}>
                {feeDisplay.label}
              </div>
              <ChoiceRow
                options={[
                  {
                    label: "Not claimed",
                    checked:
                      feeDisplay.label === "Not claimed" ||
                      feeDisplay.label === "Voucher unpaid / not claimed",
                  },
                  {
                    label: "Claimed — awaiting Finance",
                    checked: feeDisplay.isClaimedAwaitingFinance,
                  },
                  { label: "Verified / Waived", checked: feeDisplay.isAuthorized },
                  {
                    label: "Rejected",
                    checked: normalize(row.signupFeeStatus) === "rejected",
                  },
                ]}
              />
            </FieldCell>
          </div>
        </section>

        <section>
          <SectionBanner title="4. COUNSELLOR ASSIGNMENT" />
          <div className="grid grid-cols-2">
            <FieldCell label="Assigned counsellor">
              <ChoiceRow
                options={[
                  {
                    label: "Pending",
                    checked: row.assignmentStatus === "pending",
                  },
                  {
                    label: row.counsellorName || "Counsellor assigned",
                    checked: row.assignmentStatus === "assigned",
                  },
                ]}
              />
            </FieldCell>
            <FieldCell label="Last updated">
              <ValueLine
                value={row.assignmentStatus === "assigned" ? fmtDate(row.updatedAt) : null}
              />
            </FieldCell>
            <FieldCell label="Registered by">
              <ValueLine value={displayOrBlank(row.registrarName, "") || null} />
            </FieldCell>
            <FieldCell label="Workflow stage">
              <ValueLine value={row.journeyStage?.replaceAll("_", " ") || null} />
            </FieldCell>
          </div>
        </section>

        <section>
          <SectionBanner title="5. OFFICE USE" />
          <div className="grid grid-cols-2">
            <FieldCell label="Case ID">
              <ValueLine value={row.caseId} />
            </FieldCell>
            <FieldCell label="Registration date">
              <ValueLine value={fmtDate(row.createdAt)} />
            </FieldCell>
            <FieldCell label="Created by">
              <ValueLine value={row.registrarName || row.registeredBy} />
            </FieldCell>
            <FieldCell label="Next follow-up">
              <ValueLine
                value={row.nextFollowUpAt ? fmtDate(row.nextFollowUpAt.slice(0, 10)) : null}
              />
            </FieldCell>
          </div>
        </section>

        <p
          className="registration-a4-note rounded px-2 py-1 text-[9px] leading-snug"
          style={{ backgroundColor: WASH, color: NAVY }}
        >
          Intake only. Claimed fees await Accounts verification. Applications begin after counsellor
          assignment.
        </p>
      </div>

      <style>{`
        .registration-a4 {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        .registration-a4 *,
        .registration-a4 *::before,
        .registration-a4 *::after {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        .registration-a4-banner {
          background-color: ${NAVY} !important;
          color: #fff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .registration-a4-idbox {
          background-color: ${WASH} !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .registration-a4-note {
          background-color: ${WASH} !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .registration-a4-cell {
          border-color: ${BORDER} !important;
        }
        .registration-a4-logo {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          .registration-a4 {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }
          .registration-a4-header {
            padding: 0 0 6px 0 !important;
          }
          .registration-a4-body {
            padding: 6px 0 0 0 !important;
            gap: 4px !important;
          }
          .registration-a4-body.space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 4px !important;
          }
          .registration-a4-cell {
            padding: 3px 6px !important;
          }
          .registration-a4-banner {
            padding: 3px 8px !important;
            font-size: 9px !important;
          }
        }
      `}</style>
    </article>
  );
}
