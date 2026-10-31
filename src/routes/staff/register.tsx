import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, CircleDashed, ChevronDown } from "lucide-react";
import {
  ErrorState,
  LoadingRows,
  PageHeader,
  PageLoadState,
  Panel,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { SearchableSelect } from "@/components/portal/SearchableSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  INTAKE_DESTINATIONS,
  INTAKE_FEE_PAYMENT_METHODS,
  INTAKE_INQUIRY_CHANNELS,
  INTAKE_INQUIRY_SOURCES,
  INTAKE_PAKISTAN_CITIES,
  INTAKE_PROGRAMMES,
  INTAKE_SEASONS,
  INTAKE_STUDY_LEVELS,
  formatIntakeLabel,
  intakeSeasonYearToDate,
  intakeYearOptions,
  isValidIntakeEmail,
  isValidIntakePhone,
  resolveCatalogOrOther,
  type IntakeInquiryChannelValue,
  type IntakeSeason,
} from "@/lib/intake-form-options";
import {
  buildRegisterChecklist,
  countRequiredRemaining,
  registerFormCanSubmit,
  type RegisterChecklistSectionId,
  type RegisterChecklistStatus,
} from "@/lib/front-desk-register-checklist";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import { cn } from "@/lib/utils";
import { assignCounsellor, intakeRegisterStudent, listCounsellorDesks } from "@/services";

export const Route = createFileRoute("/staff/register")({
  beforeLoad: ({ context }) => {
    const auth = (context as { auth?: { businessRole?: string | null; role?: string } }).auth;
    if (auth?.role === "consultant" && !isFrontDeskBusinessRole(auth.businessRole as never)) {
      throw redirect({ to: "/staff/students" });
    }
  },
  component: FrontDeskRegisterPage,
});

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  whatsappSameAsPhone: boolean;
  city: string;
  cityOther: string;
  destination: string;
  destinationOther: string;
  program: string;
  programOther: string;
  studyLevel: string;
  studyLevelOther: string;
  inquirySource: string;
  inquirySourceOther: string;
  inquiryChannel: IntakeInquiryChannelValue | "";
  intakeSeason: IntakeSeason | "";
  intakeYear: string;
  registrationNotes: string;
  assignedConsultantId: string;
  feeAmount: string;
  feeMethod: string;
  feeReceipt: string;
  feeNotes: string;
  markClaimed: boolean;
};

const emptyForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  whatsapp: "",
  whatsappSameAsPhone: true,
  city: "",
  cityOther: "",
  destination: "",
  destinationOther: "",
  program: "",
  programOther: "",
  studyLevel: "",
  studyLevelOther: "",
  inquirySource: "",
  inquirySourceOther: "",
  inquiryChannel: "",
  intakeSeason: "",
  intakeYear: "",
  registrationNotes: "",
  assignedConsultantId: "",
  feeAmount: "",
  feeMethod: "",
  feeReceipt: "",
  feeNotes: "",
  markClaimed: true,
};

const SECTION_ANCHORS: Record<RegisterChecklistSectionId, string> = {
  contact: "register-section-contact",
  preferences: "register-section-preferences",
  signup_fee: "register-section-fee",
  counsellor: "register-section-counsellor",
  final: "register-section-actions",
};

function statusIcon(status: RegisterChecklistStatus) {
  if (status === "complete") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />;
  }
  if (status === "optional") {
    return <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />;
}

function statusLabel(status: RegisterChecklistStatus) {
  if (status === "complete") return "Complete";
  if (status === "optional") return "Optional";
  return "Pending";
}

function scrollToSection(id: RegisterChecklistSectionId) {
  const el = document.getElementById(SECTION_ANCHORS[id]);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function FrontDeskRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    studentId: string;
    caseId: string;
    name: string;
    email: string;
    assignmentStatus: string;
    counsellorId: string | null;
    feeStatus: string;
    intakeLabel?: string;
    warning?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const years = useMemo(() => intakeYearOptions(), []);

  const desksQ = useQuery({
    queryKey: ["front-desk", "counsellor-desks"],
    queryFn: listCounsellorDesks,
    staleTime: 60_000,
  });

  const intakeLabel = formatIntakeLabel(
    form.intakeSeason,
    form.intakeYear ? Number(form.intakeYear) : "",
  );

  const checklist = useMemo(() => buildRegisterChecklist(form), [form]);
  const canSubmit = registerFormCanSubmit(form);
  const remainingRequired = countRequiredRemaining(form);
  const requiredSectionsDone = checklist.filter(
    (s) => s.requiredTotal > 0 && s.status === "complete",
  ).length;
  const requiredSectionsTotal = checklist.filter((s) => s.requiredTotal > 0).length;
  const progressPct =
    requiredSectionsTotal === 0
      ? 0
      : Math.round((requiredSectionsDone / requiredSectionsTotal) * 100);

  const counsellorOptions = useMemo(() => {
    const desks = desksQ.data?.options ?? [];
    return [
      { value: "", label: "Assign later" },
      ...desks.map((d) => ({
        value: d.id,
        label: d.department ? `${d.fullName} — ${d.department}` : d.fullName,
      })),
    ];
  }, [desksQ.data?.options]);

  const channelOptions = useMemo(
    () => INTAKE_INQUIRY_CHANNELS.map((c) => ({ value: c.value, label: c.label })),
    [],
  );

  const yearOptions = useMemo(
    () => years.map((y) => ({ value: String(y), label: String(y) })),
    [years],
  );

  const registerM = useMutation({
    mutationFn: () => {
      const cityR = resolveCatalogOrOther(form.city, form.cityOther);
      if (!cityR.ok && form.city) throw new Error(cityR.error);
      const destR = resolveCatalogOrOther(form.destination, form.destinationOther);
      if (!destR.ok) throw new Error(destR.error || "Preferred destination is required.");
      const progR = resolveCatalogOrOther(form.program, form.programOther);
      if (!progR.ok) throw new Error(progR.error || "Intended programme is required.");
      let studyLevel = "";
      if (form.studyLevel) {
        const lvl = resolveCatalogOrOther(form.studyLevel, form.studyLevelOther);
        if (!lvl.ok) throw new Error(lvl.error);
        studyLevel = lvl.value;
      }
      let inquirySource = "";
      if (form.inquirySource) {
        const src = resolveCatalogOrOther(form.inquirySource, form.inquirySourceOther);
        if (!src.ok) throw new Error(src.error);
        inquirySource = src.value;
      }

      const amount = form.feeAmount.trim() ? Number(form.feeAmount) : NaN;
      const whatsapp = form.whatsappSameAsPhone
        ? form.phone.trim()
        : form.whatsapp.trim() || form.phone.trim();
      const intakeDate = intakeSeasonYearToDate(
        form.intakeSeason,
        form.intakeYear ? Number(form.intakeYear) : "",
      );
      const notesParts = [
        form.registrationNotes.trim(),
        intakeLabel ? `Intended intake: ${intakeLabel}` : "",
      ].filter(Boolean);

      const payload: Parameters<typeof intakeRegisterStudent>[0] = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        destination: destR.value,
        program: progR.value,
        whatsapp,
      };
      if (cityR.ok) payload.city = cityR.value;
      if (studyLevel) payload.studyLevel = studyLevel;
      if (inquirySource) payload.inquirySource = inquirySource;
      if (form.inquiryChannel) payload.inquiryChannel = form.inquiryChannel;
      if (intakeDate) payload.intakeDate = intakeDate;
      if (notesParts.length) payload.registrationNotes = notesParts.join("\n");
      if (form.assignedConsultantId.trim()) {
        payload.assignedConsultantId = form.assignedConsultantId.trim();
      }
      if (Number.isFinite(amount) && amount > 0) {
        payload.signupFee = {
          amount,
          currency: "PKR",
          markClaimed: form.markClaimed,
        };
        if (form.feeMethod.trim()) payload.signupFee.paymentMethod = form.feeMethod.trim();
        if (form.feeReceipt.trim()) payload.signupFee.referenceReceipt = form.feeReceipt.trim();
        if (form.feeNotes.trim()) payload.signupFee.notes = form.feeNotes.trim();
      }
      return intakeRegisterStudent(payload);
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canSubmit) return;
    setErr(null);
    setSuccess(null);

    if (!form.fullName.trim()) {
      setErr("Full name is required.");
      return;
    }
    if (!isValidIntakeEmail(form.email)) {
      setErr("Enter a valid email address.");
      return;
    }
    if (!isValidIntakePhone(form.phone)) {
      setErr("Enter a valid phone / WhatsApp number.");
      return;
    }
    if (!form.whatsappSameAsPhone && form.whatsapp.trim() && !isValidIntakePhone(form.whatsapp)) {
      setErr("Enter a valid WhatsApp number, or mark it same as phone.");
      return;
    }
    if (!form.destination.trim()) {
      setErr("Preferred destination is required.");
      return;
    }
    if (!form.program.trim()) {
      setErr("Intended course / programme is required.");
      return;
    }
    if (form.feeAmount.trim()) {
      const amount = Number(form.feeAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setErr("Signup fee amount must be a positive number, or leave it blank.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await registerM.mutateAsync();
      let assignmentStatus = result.student.assignmentStatus ?? "pending";
      let counsellorId = result.student.consultantId;
      let warning =
        "warning" in result && typeof result.warning === "string" ? result.warning : undefined;

      if (result.student.id && form.assignedConsultantId && assignmentStatus === "pending") {
        try {
          const assigned = await assignCounsellor({
            studentId: result.student.id,
            consultantId: form.assignedConsultantId,
          });
          counsellorId = assigned.student.consultantId;
          assignmentStatus = "assigned";
        } catch (assignErr) {
          warning = portalErrorMessage(
            assignErr,
            "Student saved; counsellor assignment failed — assign from Intake list.",
          );
        }
      }

      setSuccess({
        studentId: result.student.id,
        caseId: result.student.caseId,
        name: result.student.name,
        email: result.student.email,
        assignmentStatus,
        counsellorId,
        feeStatus: result.student.signupFeeStatus,
        ...(intakeLabel ? { intakeLabel } : {}),
        ...(warning ? { warning } : {}),
      });
      setForm(emptyForm);
    } catch (error) {
      setErr(portalErrorMessage(error, "Could not register student."));
    } finally {
      setSubmitting(false);
    }
  };

  if (desksQ.isError) {
    const msg = portalErrorMessage(desksQ.error);
    if (/403|permission/i.test(msg)) return <PermissionDenied body={msg} />;
  }

  if (desksQ.isLoading && !desksQ.data) {
    return (
      <PageLoadState
        title="Register student"
        subtitle="Required fields marked *. Fee claims are not Accounts-verified."
      >
        <LoadingRows rows={6} />
      </PageLoadState>
    );
  }

  if (success) {
    const needsAssign = success.assignmentStatus === "pending";
    return (
      <div className="mx-auto max-w-xl space-y-4 md:space-y-5">
        <PageHeader
          compact
          title="Registration complete"
          subtitle="Share the case reference with the team."
        />
        <Panel compact title="Confirmation">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Case / reference</dt>
              <dd className="font-semibold text-navy">{success.caseId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Student</dt>
              <dd>{success.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{success.email}</dd>
            </div>
            {success.intakeLabel ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Intake</dt>
                <dd>{success.intakeLabel}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Assignment</dt>
              <dd className="capitalize">{success.assignmentStatus}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Signup fee</dt>
              <dd className="capitalize">{success.feeStatus.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          {success.warning ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {success.warning}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2">
            {needsAssign && success.studentId ? (
              <Button type="button" variant="navy" asChild>
                <Link
                  to="/staff/intake/$studentId"
                  params={{ studentId: success.studentId }}
                  search={{ focus: "assign" }}
                >
                  Assign counsellor
                </Link>
              </Button>
            ) : success.studentId ? (
              <Button type="button" variant="navy" asChild>
                <Link to="/staff/intake/$studentId" params={{ studentId: success.studentId }}>
                  Open record
                </Link>
              </Button>
            ) : null}
            <Button type="button" onClick={() => setSuccess(null)}>
              Register another
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/staff/intake">Intake list</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate({ to: "/staff/front-desk" })}
            >
              Dashboard
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const checklistPanel = (
    <div className="space-y-4">
      <div>
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Registration progress
        </p>
        <p className="mt-1 text-sm text-navy">
          {requiredSectionsDone} of {requiredSectionsTotal} required sections ·{" "}
          {remainingRequired === 0
            ? "Ready to register"
            : `${remainingRequired} required field${remainingRequired === 1 ? "" : "s"} left`}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-royal transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
            aria-hidden
          />
        </div>
      </div>
      <ul className="space-y-2">
        {checklist.map((section) => (
          <li key={section.id}>
            <button
              type="button"
              onClick={() => {
                scrollToSection(section.id);
                setChecklistOpen(false);
              }}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors",
                section.status === "complete"
                  ? "border-success/30 bg-success-soft/30"
                  : section.status === "pending"
                    ? "border-amber-200/80 bg-amber-50/50 hover:border-amber-300"
                    : "border-border bg-white hover:border-royal/30",
              )}
            >
              {statusIcon(section.status)}
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-navy">{section.title}</span>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {statusLabel(section.status)}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{section.hint}</span>
                {section.requiredTotal > 0 ? (
                  <span className="mt-1 block text-[0.7rem] tabular-nums text-muted-foreground">
                    {section.requiredComplete}/{section.requiredTotal} required
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Signup fee and counsellor assignment are optional and do not block registration. Claimed
        fees are not Finance-verified.
      </p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 md:space-y-5">
      <PageHeader
        compact
        title="Register student"
        subtitle="Live checklist on the left · Required fields marked * · Fee claims are not Accounts-verified."
      />

      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}
      {desksQ.isError ? <ErrorState body={portalErrorMessage(desksQ.error)} /> : null}

      {/* Mobile checklist */}
      <div className="lg:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2.5 text-sm font-medium text-navy"
          onClick={() => setChecklistOpen((v) => !v)}
          aria-expanded={checklistOpen}
        >
          <span>
            Checklist · {progressPct}% · {remainingRequired} required left
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", checklistOpen && "rotate-180")}
          />
        </button>
        {checklistOpen ? (
          <div className="mt-2 rounded-md border border-border bg-white p-4 shadow-sm">
            {checklistPanel}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-md border border-border bg-white p-4 shadow-sm">
            {checklistPanel}
          </div>
        </aside>

        <form className="space-y-4 md:space-y-5" onSubmit={onSubmit} noValidate>
          <div id={SECTION_ANCHORS.contact} className="scroll-mt-6">
            <Panel title="1. Student & contact">
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="fullName">Full name *</Label>
                  <Input
                    id="fullName"
                    className="mt-1.5"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    required
                    disabled={submitting}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    className="mt-1.5"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    disabled={submitting}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone / WhatsApp *</Label>
                  <Input
                    id="phone"
                    className="mt-1.5"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                    disabled={submitting}
                    autoComplete="tel"
                    placeholder="+92 3XX XXXXXXX"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <input
                    id="whatsappSame"
                    type="checkbox"
                    checked={form.whatsappSameAsPhone}
                    disabled={submitting}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, whatsappSameAsPhone: e.target.checked }))
                    }
                  />
                  <Label htmlFor="whatsappSame">WhatsApp same as phone number</Label>
                </div>
                {!form.whatsappSameAsPhone ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
                    <Input
                      id="whatsapp"
                      className="mt-1.5"
                      value={form.whatsapp}
                      onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="city">City</Label>
                  <SearchableSelect
                    id="city"
                    value={form.city}
                    options={INTAKE_PAKISTAN_CITIES}
                    onChange={(city) => setForm((f) => ({ ...f, city, cityOther: "" }))}
                    placeholder="Select city…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                {form.city === "Other" ? (
                  <div>
                    <Label htmlFor="cityOther">City name *</Label>
                    <Input
                      id="cityOther"
                      className="mt-1.5"
                      value={form.cityOther}
                      onChange={(e) => setForm((f) => ({ ...f, cityOther: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                ) : null}
              </div>
            </Panel>
          </div>

          <div id={SECTION_ANCHORS.preferences} className="scroll-mt-6">
            <Panel title="2. Study preferences">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="destination">Preferred destination *</Label>
                  <SearchableSelect
                    id="destination"
                    value={form.destination}
                    options={INTAKE_DESTINATIONS}
                    onChange={(destination) =>
                      setForm((f) => ({ ...f, destination, destinationOther: "" }))
                    }
                    placeholder="Select destination…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                {form.destination === "Other" ? (
                  <div>
                    <Label htmlFor="destinationOther">Destination name *</Label>
                    <Input
                      id="destinationOther"
                      className="mt-1.5"
                      value={form.destinationOther}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, destinationOther: e.target.value }))
                      }
                      disabled={submitting}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="program">Intended course / programme *</Label>
                  <SearchableSelect
                    id="program"
                    value={form.program}
                    options={INTAKE_PROGRAMMES}
                    onChange={(program) =>
                      setForm((f) => ({ ...f, program, programOther: "" }))
                    }
                    placeholder="Select programme…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                {form.program === "Other" ? (
                  <div>
                    <Label htmlFor="programOther">Programme name *</Label>
                    <Input
                      id="programOther"
                      className="mt-1.5"
                      value={form.programOther}
                      onChange={(e) => setForm((f) => ({ ...f, programOther: e.target.value }))}
                      disabled={submitting}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="studyLevel">Study level</Label>
                  <SearchableSelect
                    id="studyLevel"
                    value={form.studyLevel}
                    options={INTAKE_STUDY_LEVELS}
                    onChange={(studyLevel) =>
                      setForm((f) => ({ ...f, studyLevel, studyLevelOther: "" }))
                    }
                    placeholder="Select level…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                {form.studyLevel === "Other" ? (
                  <div>
                    <Label htmlFor="studyLevelOther">Study level *</Label>
                    <Input
                      id="studyLevelOther"
                      className="mt-1.5"
                      value={form.studyLevelOther}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, studyLevelOther: e.target.value }))
                      }
                      disabled={submitting}
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="intakeSeason">Intake season</Label>
                  <SearchableSelect
                    id="intakeSeason"
                    value={form.intakeSeason}
                    options={INTAKE_SEASONS}
                    onChange={(intakeSeason) =>
                      setForm((f) => ({
                        ...f,
                        intakeSeason: intakeSeason as IntakeSeason | "",
                      }))
                    }
                    placeholder="Select season…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                <div>
                  <Label htmlFor="intakeYear">Intake year</Label>
                  <SearchableSelect
                    id="intakeYear"
                    value={form.intakeYear}
                    options={yearOptions}
                    onChange={(intakeYear) => setForm((f) => ({ ...f, intakeYear }))}
                    placeholder="Select year…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                {intakeLabel ? (
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Selected intake: <span className="font-medium text-navy">{intakeLabel}</span>
                  </p>
                ) : null}
                <div>
                  <Label htmlFor="inquiryChannel">Inquiry channel</Label>
                  <SearchableSelect
                    id="inquiryChannel"
                    value={form.inquiryChannel}
                    options={channelOptions}
                    onChange={(inquiryChannel) =>
                      setForm((f) => ({
                        ...f,
                        inquiryChannel: inquiryChannel as IntakeInquiryChannelValue | "",
                      }))
                    }
                    placeholder="Select channel…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                <div>
                  <Label htmlFor="inquirySource">How did they hear about us?</Label>
                  <SearchableSelect
                    id="inquirySource"
                    value={form.inquirySource}
                    options={INTAKE_INQUIRY_SOURCES}
                    onChange={(inquirySource) =>
                      setForm((f) => ({ ...f, inquirySource, inquirySourceOther: "" }))
                    }
                    placeholder="Select source…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                {form.inquirySource === "Other" ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor="inquirySourceOther">Source details *</Label>
                    <Input
                      id="inquirySourceOther"
                      className="mt-1.5"
                      value={form.inquirySourceOther}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, inquirySourceOther: e.target.value }))
                      }
                      disabled={submitting}
                    />
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <Label htmlFor="notes">Registration notes</Label>
                  <Textarea
                    id="notes"
                    className="mt-1.5"
                    rows={3}
                    value={form.registrationNotes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, registrationNotes: e.target.value }))
                    }
                    disabled={submitting}
                  />
                </div>
              </div>
            </Panel>
          </div>

          <div id={SECTION_ANCHORS.signup_fee} className="scroll-mt-6">
            <Panel title="3. Signup fee (optional)">
              <p className="mb-3 text-xs text-muted-foreground">
                Fee is optional. Marking claimed only records that payment was reported — it is{" "}
                <strong>not</strong> finance-verified. Verification is Accounts-only.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="feeAmount">Amount (PKR)</Label>
                  <Input
                    id="feeAmount"
                    type="number"
                    min={0}
                    step="0.01"
                    className="mt-1.5"
                    value={form.feeAmount}
                    onChange={(e) => setForm((f) => ({ ...f, feeAmount: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <Label htmlFor="feeMethod">Payment method</Label>
                  <SearchableSelect
                    id="feeMethod"
                    value={form.feeMethod}
                    options={INTAKE_FEE_PAYMENT_METHODS}
                    onChange={(feeMethod) => setForm((f) => ({ ...f, feeMethod }))}
                    placeholder="Select method…"
                    disabled={submitting}
                    allowClear
                  />
                </div>
                <div>
                  <Label htmlFor="feeReceipt">Receipt / reference</Label>
                  <Input
                    id="feeReceipt"
                    className="mt-1.5"
                    value={form.feeReceipt}
                    onChange={(e) => setForm((f) => ({ ...f, feeReceipt: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <input
                    id="markClaimed"
                    type="checkbox"
                    checked={form.markClaimed}
                    disabled={submitting}
                    onChange={(e) => setForm((f) => ({ ...f, markClaimed: e.target.checked }))}
                  />
                  <Label htmlFor="markClaimed">Mark as claimed (not verified)</Label>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="feeNotes">Fee notes</Label>
                  <Input
                    id="feeNotes"
                    className="mt-1.5"
                    value={form.feeNotes}
                    onChange={(e) => setForm((f) => ({ ...f, feeNotes: e.target.value }))}
                    disabled={submitting}
                  />
                </div>
              </div>
            </Panel>
          </div>

          <div id={SECTION_ANCHORS.counsellor} className="scroll-mt-6">
            <Panel title="4. Counsellor assignment">
              <Label htmlFor="counsellor">Assign counsellor</Label>
              <SearchableSelect
                id="counsellor"
                value={form.assignedConsultantId}
                options={counsellorOptions}
                onChange={(assignedConsultantId) =>
                  setForm((f) => ({ ...f, assignedConsultantId }))
                }
                placeholder="Assign later…"
                disabled={submitting}
                allowClear
                emptyText="No matching counsellor desks."
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Eligible active Counsellor / Consultant desks from the staff directory. Assign later
                keeps the case pending for Intake.
              </p>
              {!desksQ.isLoading && (desksQ.data?.options?.length ?? 0) === 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  No active Counsellor / Consultant desks found. You can still save with pending
                  assignment.
                </p>
              ) : null}
            </Panel>
          </div>

          <div
            id={SECTION_ANCHORS.final}
            className="flex flex-wrap items-center gap-2 border-t border-border pt-4 scroll-mt-6"
          >
            <Button
              type="submit"
              variant="navy"
              disabled={submitting || registerM.isPending || !canSubmit}
            >
              {submitting ? "Saving…" : "Register student"}
            </Button>
            <Button type="button" variant="outline" asChild disabled={submitting}>
              <Link to="/staff/front-desk">Cancel</Link>
            </Button>
            {!canSubmit ? (
              <span className="text-xs text-muted-foreground">
                Complete required contact and study fields to enable Register.
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
