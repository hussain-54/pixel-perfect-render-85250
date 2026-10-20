import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { fmtDate } from "@/components/common";
import { intakeDateToSeasonYear } from "@/lib/front-desk-intake-manage";
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
      className="px-3 py-1.5 text-[11px] font-bold tracking-wide text-white"
      style={{ backgroundColor: NAVY }}
    >
      {title}
    </div>
  );
}

function FieldCell({
  label,
  hint,
  children,
  full = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={full ? "col-span-2 px-3 py-2" : "px-3 py-2"}
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div className="text-[11px] font-bold" style={{ color: NAVY }}>
        {label}
      </div>
      {hint ? <div className="text-[10px] text-slate-500">{hint}</div> : null}
      <div className="mt-1 min-h-[1.25rem] text-[12px] leading-snug text-slate-900">{children}</div>
    </div>
  );
}

function ChoiceRow({ options }: { options: { label: string; checked: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-800">
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
  return <span className="font-medium">{v || "_______________________________"}</span>;
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
  const feeClaimed = ["claimed", "verified", "waived"].includes(
    normalize(row.signupFeeStatus),
  );
  const feeAmount =
    row.signupFeeAmount != null
      ? `${row.signupFeeCurrency || "PKR"} ${row.signupFeeAmount}`
      : null;

  return (
    <article
      className={
        mode === "print"
          ? "registration-a4 mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none"
          : "registration-a4 rounded-lg border border-border bg-white text-slate-900 shadow-sm"
      }
      style={{ fontFamily: "Aptos, Calibri, 'Segoe UI', sans-serif" }}
    >
      <header className="flex items-start justify-between gap-4 border-b px-4 pb-3 pt-4" style={{ borderColor: BORDER }}>
        <div>
          <LogoMark className="h-11 w-auto" />
          <h1 className="mt-2 text-[18px] font-bold tracking-tight" style={{ color: NAVY }}>
            STUDENT REGISTRATION FORM
          </h1>
          <p className="text-[11px] text-slate-600">
            Initial intake details · Counsellor assignment · Signup fee record
          </p>
        </div>
        <div className="min-w-[9rem] rounded border px-3 py-2 text-right" style={{ borderColor: BORDER, backgroundColor: WASH }}>
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: NAVY }}>
            Student / CRM ID
          </div>
          <div className="text-[15px] font-bold" style={{ color: NAVY }}>
            {row.caseId}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Registered {fmtDate(row.createdAt)}</div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        <section>
          <SectionBanner title="1.  STUDENT & CONTACT" />
          <div className="grid grid-cols-2">
            <FieldCell label="Full name *" hint="As per passport / official ID">
              <ValueLine value={row.fullName} />
            </FieldCell>
            <FieldCell label="Email *">
              <ValueLine value={row.email} />
            </FieldCell>
            <FieldCell label="Phone number *" hint="+ country code">
              <ValueLine value={row.phone} />
            </FieldCell>
            <FieldCell label="WhatsApp same as phone number">
              <ChoiceRow
                options={[
                  { label: "Yes", checked: whatsappSame },
                  { label: "No", checked: Boolean(row.whatsapp?.trim()) && !whatsappSame },
                ]}
              />
            </FieldCell>
            <FieldCell label="WhatsApp number" hint="+ country code">
              <ValueLine value={row.whatsapp} />
            </FieldCell>
            <FieldCell label="City">
              <ValueLine value={row.city} />
            </FieldCell>
          </div>
        </section>

        <section>
          <SectionBanner title="2.  STUDY PREFERENCES" />
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
                <div className="mt-1 text-[11px] text-slate-700">
                  Recorded: <ValueLine value={row.destination} />
                </div>
              ) : null}
            </FieldCell>
            <FieldCell label="Intended course / programme *">
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
              {row.studyLevel?.trim() ? (
                <div className="mt-1 text-[11px] text-slate-700">
                  Recorded: <ValueLine value={row.studyLevel} />
                </div>
              ) : null}
            </FieldCell>
            <FieldCell label="Intake season">
              <ChoiceRow
                options={[
                  { label: "Winter", checked: intake.season === "Winter" },
                  { label: "Summer", checked: intake.season === "Summer" },
                  { label: "Spring", checked: intake.season === "Spring" },
                  { label: "Autumn", checked: intake.season === "Autumn" },
                  { label: "Other", checked: intake.season === "Other" },
                ]}
              />
            </FieldCell>
            <FieldCell label="Intake year">
              <ChoiceRow
                options={["2026", "2027", "2028", "2029"].map((y) => ({
                  label: y,
                  checked: intake.year === y,
                }))}
              />
              {intake.year && !["2026", "2027", "2028", "2029"].includes(intake.year) ? (
                <div className="mt-1 text-[11px] text-slate-700">
                  Recorded: <ValueLine value={intake.year} />
                </div>
              ) : null}
            </FieldCell>
            <FieldCell label="Inquiry channel">
              <ChoiceRow
                options={[
                  { label: "Physical visit", checked: channel === "physical" },
                  { label: "Online", checked: channel === "online" },
                  { label: "Phone", checked: channel === "phone" },
                  { label: "WhatsApp", checked: channel === "whatsapp" },
                  { label: "Referral", checked: channel === "referral" },
                  { label: "Education expo", checked: channel === "expo" },
                  { label: "Social media", checked: channel === "social" },
                  { label: "Other", checked: channel === "other" },
                ]}
              />
            </FieldCell>
            <FieldCell label="Inquiry source" hint="How did the student hear about us?" full>
              <ValueLine value={row.inquirySource} />
            </FieldCell>
            <FieldCell label="Registration notes" full>
              <p className="min-h-[2.5rem] whitespace-pre-wrap">
                {row.registrationNotes?.trim() || "_______________________________"}
              </p>
            </FieldCell>
          </div>
        </section>

        <section>
          <SectionBanner title="3.  SIGNUP FEE (OPTIONAL)  |  Claimed is not Accounts-verified" />
          <div className="grid grid-cols-2">
            <FieldCell label="Amount (PKR)">
              <ValueLine value={feeAmount} />
            </FieldCell>
            <FieldCell label="Payment method">
              <ChoiceRow
                options={[
                  { label: "Cash", checked: pay === "cash" },
                  { label: "Bank transfer", checked: pay === "bank" },
                  { label: "Online", checked: pay === "online" },
                  { label: "Other", checked: pay === "other" },
                ]}
              />
              {row.signupFeeMethod?.trim() ? (
                <div className="mt-1 text-[11px] text-slate-700">
                  Recorded: <ValueLine value={row.signupFeeMethod} />
                </div>
              ) : null}
            </FieldCell>
            <FieldCell label="Receipt / reference">
              <ValueLine value={row.signupFeeReference} />
            </FieldCell>
            <FieldCell label="Mark as claimed (not verified)">
              <ChoiceRow
                options={[
                  {
                    label: "Yes — student/payment reported as claimed",
                    checked: feeClaimed,
                  },
                ]}
              />
              {row.signupFeeStatus ? (
                <div className="mt-1 text-[11px] text-slate-700">
                  Status: {row.signupFeeStatus.replaceAll("_", " ")}
                </div>
              ) : null}
            </FieldCell>
            <FieldCell label="Fee notes" full>
              <p className="text-[11px] text-slate-600">
                Claimed receipts are not verified payments. Accounts verification is separate and
                restricted to Accounts staff.
              </p>
            </FieldCell>
          </div>
        </section>

        <section>
          <SectionBanner title="4.  COUNSELLOR ASSIGNMENT" />
          <div className="grid grid-cols-2">
            <FieldCell label="Assigned counsellor">
              <ChoiceRow
                options={[
                  {
                    label: "Pending assignment",
                    checked: row.assignmentStatus === "pending",
                  },
                  {
                    label: row.counsellorName
                      ? `${row.counsellorName} — Counselling`
                      : "Assigned counsellor",
                    checked: row.assignmentStatus === "assigned",
                  },
                ]}
              />
            </FieldCell>
            <FieldCell label="Assignment date">
              <ValueLine
                value={
                  row.assignmentStatus === "assigned" ? fmtDate(row.updatedAt) : null
                }
              />
            </FieldCell>
            <FieldCell label="Assigned by">
              <ValueLine value={row.registrarName} />
            </FieldCell>
            <FieldCell label="Internal handover notes">
              <ValueLine value={null} />
            </FieldCell>
          </div>
        </section>

        <div
          className="rounded px-3 py-2 text-[10px] leading-relaxed"
          style={{ backgroundColor: WASH, color: NAVY }}
        >
          <strong>WORKFLOW NOTE</strong> | This form captures initial intake details only. University
          applications and visa work begin after counsellor assignment. Signup fee claims are
          recorded only as reported; Accounts verification is separate and restricted to Accounts
          staff.
        </div>

        <section>
          <SectionBanner title="5.  OFFICE USE ONLY" />
          <div className="grid grid-cols-2">
            <FieldCell label="Student / CRM ID">
              <ValueLine value={row.caseId} />
            </FieldCell>
            <FieldCell label="Registration date">
              <ValueLine value={fmtDate(row.createdAt)} />
            </FieldCell>
            <FieldCell label="Record created by">
              <ValueLine value={row.registrarName || row.registeredBy} />
            </FieldCell>
            <FieldCell label="Next follow-up date">
              <ValueLine value={row.nextFollowUpAt} />
            </FieldCell>
          </div>
        </section>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .registration-a4 {
            box-shadow: none !important;
            border: none !important;
            max-width: none !important;
          }
        }
      `}</style>
    </article>
  );
}
