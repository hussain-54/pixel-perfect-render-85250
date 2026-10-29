import { useMemo, useState } from "react";
import { Panel } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { intakeDateToSeasonYear } from "@/lib/front-desk-intake-manage";
import {
  INTAKE_DESTINATIONS,
  INTAKE_INQUIRY_CHANNELS,
  INTAKE_INQUIRY_SOURCES,
  INTAKE_PAKISTAN_CITIES,
  INTAKE_PROGRAMMES,
  INTAKE_SEASONS,
  INTAKE_STUDY_LEVELS,
  intakeSeasonYearToDate,
  intakeYearOptions,
  type IntakeSeason,
} from "@/lib/intake-form-options";
import type { FrontDeskIntakeRow } from "@/server/portal-front-desk";
import type { updateFrontDeskIntake } from "@/services";

export type FrontDeskEditRegistrationPayload = Parameters<typeof updateFrontDeskIntake>[0];

export function FrontDeskEditRegistrationPanel({
  row,
  pending,
  onCancel,
  onSave,
}: {
  row: FrontDeskIntakeRow;
  pending: boolean;
  onCancel: () => void;
  onSave: (payload: FrontDeskEditRegistrationPayload) => void;
}) {
  const parsed = intakeDateToSeasonYear(row.intakeDate);
  const years = useMemo(() => intakeYearOptions(), []);
  const [fullName, setFullName] = useState(row.fullName);
  const [email, setEmail] = useState(row.email);
  const [phone, setPhone] = useState(row.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(row.whatsapp ?? "");
  const [city, setCity] = useState(row.city ?? "");
  const [destination, setDestination] = useState(row.destination ?? "");
  const [program, setProgram] = useState(row.program ?? "");
  const [studyLevel, setStudyLevel] = useState(row.studyLevel ?? "");
  const [inquirySource, setInquirySource] = useState(row.inquirySource ?? "");
  const [inquiryChannel, setInquiryChannel] = useState(row.inquiryChannel ?? "");
  const [intakeSeason, setIntakeSeason] = useState<IntakeSeason | "">(parsed.season);
  const [intakeYear, setIntakeYear] = useState(parsed.year);
  const [registrationNotes, setRegistrationNotes] = useState(row.registrationNotes ?? "");
  const [nextFollowUpAt, setNextFollowUpAt] = useState(row.nextFollowUpAt ?? "");
  const [localErr, setLocalErr] = useState<string | null>(null);

  return (
    <Panel title={`Edit registration — ${row.caseId}`}>
      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 text-xs text-muted-foreground">
          Fee verification, portal activation, counsellor assignment, and case ID stay protected.
          {row.profileId ? " Email is locked because a portal account is linked." : null}
        </div>
        <div>
          <Label>Full name *</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>Email *</Label>
          <Input
            value={email}
            readOnly={Boolean(row.profileId)}
            className={row.profileId ? "bg-muted/40" : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </div>
        <div>
          <Label>City</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={INTAKE_PAKISTAN_CITIES.includes(city as never) ? city : city ? "Other" : ""}
            onChange={(e) => setCity(e.target.value === "Other" ? city || "Other" : e.target.value)}
          >
            <option value="">Select…</option>
            {INTAKE_PAKISTAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Destination</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={
              INTAKE_DESTINATIONS.includes(destination as never)
                ? destination
                : destination
                  ? "Other"
                  : ""
            }
            onChange={(e) =>
              setDestination(e.target.value === "Other" ? destination || "Other" : e.target.value)
            }
          >
            <option value="">Select…</option>
            {INTAKE_DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Programme</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={INTAKE_PROGRAMMES.includes(program as never) ? program : program ? "Other" : ""}
            onChange={(e) =>
              setProgram(e.target.value === "Other" ? program || "Other" : e.target.value)
            }
          >
            <option value="">Select…</option>
            {INTAKE_PROGRAMMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Study level</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={studyLevel}
            onChange={(e) => setStudyLevel(e.target.value)}
          >
            <option value="">Select…</option>
            {INTAKE_STUDY_LEVELS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Intake season</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={intakeSeason}
            onChange={(e) => setIntakeSeason(e.target.value as IntakeSeason | "")}
          >
            <option value="">Select…</option>
            {INTAKE_SEASONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Intake year</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={intakeYear}
            onChange={(e) => setIntakeYear(e.target.value)}
          >
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Inquiry channel</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={inquiryChannel}
            onChange={(e) => setInquiryChannel(e.target.value)}
          >
            <option value="">Select…</option>
            {INTAKE_INQUIRY_CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Inquiry source</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={inquirySource}
            onChange={(e) => setInquirySource(e.target.value)}
          >
            <option value="">Select…</option>
            {INTAKE_INQUIRY_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Next follow-up</Label>
          <Input
            type="date"
            value={nextFollowUpAt || ""}
            onChange={(e) => setNextFollowUpAt(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Registration notes</Label>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={registrationNotes}
            onChange={(e) => setRegistrationNotes(e.target.value)}
          />
        </div>
        {localErr ? <p className="sm:col-span-2 text-xs text-destructive">{localErr}</p> : null}
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="navy"
            disabled={pending}
            onClick={() => {
              if (!fullName.trim() || !email.trim()) {
                setLocalErr("Name and email are required.");
                return;
              }
              setLocalErr(null);
              onSave({
                studentId: row.id,
                expectedUpdatedAt: row.updatedAt,
                fullName,
                email,
                phone,
                whatsapp,
                city,
                destination,
                program,
                studyLevel,
                inquirySource,
                inquiryChannel: inquiryChannel || null,
                intakeDate: intakeSeasonYearToDate(
                  intakeSeason,
                  intakeYear ? Number(intakeYear) : "",
                ),
                registrationNotes,
                nextFollowUpAt: nextFollowUpAt || null,
              });
            }}
          >
            {pending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Panel>
  );
}
