import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ErrorState,
  PageHeader,
  Panel,
  PermissionDenied,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isFrontDeskBusinessRole } from "@/lib/staff-business-access";
import { assignCounsellor, intakeRegisterStudent, listCounsellorDesks } from "@/services";
import type { InquiryChannelDb } from "@/types/database";

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
  city: string;
  destination: string;
  program: string;
  studyLevel: string;
  inquirySource: string;
  inquiryChannel: InquiryChannelDb | "";
  intakeDate: string;
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
  city: "",
  destination: "",
  program: "",
  studyLevel: "",
  inquirySource: "",
  inquiryChannel: "",
  intakeDate: "",
  registrationNotes: "",
  assignedConsultantId: "",
  feeAmount: "",
  feeMethod: "",
  feeReceipt: "",
  feeNotes: "",
  markClaimed: true,
};

function FrontDeskRegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    caseId: string;
    name: string;
    email: string;
    assignmentStatus: string;
    counsellorId: string | null;
    feeStatus: string;
    warning?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const desksQ = useQuery({
    queryKey: ["front-desk", "counsellor-desks"],
    queryFn: listCounsellorDesks,
    staleTime: 60_000,
  });

  const registerM = useMutation({
    mutationFn: () => {
      const amount = form.feeAmount.trim() ? Number(form.feeAmount) : NaN;
      const payload: Parameters<typeof intakeRegisterStudent>[0] = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        destination: form.destination,
        program: form.program,
      };
      if (form.whatsapp.trim()) payload.whatsapp = form.whatsapp.trim();
      if (form.city.trim()) payload.city = form.city.trim();
      if (form.studyLevel.trim()) payload.studyLevel = form.studyLevel.trim();
      if (form.inquirySource.trim()) payload.inquirySource = form.inquirySource.trim();
      if (form.inquiryChannel) payload.inquiryChannel = form.inquiryChannel;
      if (form.intakeDate.trim()) payload.intakeDate = form.intakeDate.trim();
      if (form.registrationNotes.trim()) {
        payload.registrationNotes = form.registrationNotes.trim();
      }
      if (form.assignedConsultantId.trim()) {
        payload.assignedConsultantId = form.assignedConsultantId.trim();
      }
      if (Number.isFinite(amount) && amount >= 0) {
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
    if (submitting) return;
    setErr(null);
    setSuccess(null);
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setErr("Full name, email and phone are required.");
      return;
    }
    if (!form.destination.trim() || !form.program.trim()) {
      setErr("Preferred destination and intended programme are required.");
      return;
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
        caseId: result.student.caseId,
        name: result.student.name,
        email: result.student.email,
        assignmentStatus,
        counsellorId,
        feeStatus: result.student.signupFeeStatus,
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

  if (success) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader
          title="Registration complete"
          subtitle="Share the case reference with the team."
        />
        <Panel title="Confirmation">
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

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Register student"
        subtitle="Capture intake details. University applications and visa work happen after counsellor assignment."
      />

      {err ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}
      {desksQ.isError ? <ErrorState body={portalErrorMessage(desksQ.error)} /> : null}

      <form className="space-y-6" onSubmit={onSubmit}>
        <Panel title="1. Student & contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="fullName">Full name *</Label>
              <Input
                id="fullName"
                className="mt-1.5"
                value={form.fullName}
                onChange={set("fullName")}
                required
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
                onChange={set("email")}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone / WhatsApp *</Label>
              <Input
                id="phone"
                className="mt-1.5"
                value={form.phone}
                onChange={set("phone")}
                required
                autoComplete="tel"
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp (if different)</Label>
              <Input
                id="whatsapp"
                className="mt-1.5"
                value={form.whatsapp}
                onChange={set("whatsapp")}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input id="city" className="mt-1.5" value={form.city} onChange={set("city")} />
            </div>
          </div>
        </Panel>

        <Panel title="2. Study preferences">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="destination">Preferred destination *</Label>
              <Input
                id="destination"
                className="mt-1.5"
                value={form.destination}
                onChange={set("destination")}
                required
              />
            </div>
            <div>
              <Label htmlFor="program">Intended course / programme *</Label>
              <Input
                id="program"
                className="mt-1.5"
                value={form.program}
                onChange={set("program")}
                required
              />
            </div>
            <div>
              <Label htmlFor="studyLevel">Study level</Label>
              <Input
                id="studyLevel"
                className="mt-1.5"
                placeholder="e.g. Bachelor's, Master's"
                value={form.studyLevel}
                onChange={set("studyLevel")}
              />
            </div>
            <div>
              <Label htmlFor="intakeDate">Intended intake</Label>
              <Input
                id="intakeDate"
                type="date"
                className="mt-1.5"
                value={form.intakeDate}
                onChange={set("intakeDate")}
              />
            </div>
            <div>
              <Label htmlFor="inquiryChannel">Inquiry channel</Label>
              <select
                id="inquiryChannel"
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.inquiryChannel}
                onChange={set("inquiryChannel")}
              >
                <option value="">Select…</option>
                <option value="physical">Physical</option>
                <option value="online">Online</option>
              </select>
            </div>
            <div>
              <Label htmlFor="inquirySource">Inquiry source</Label>
              <Input
                id="inquirySource"
                className="mt-1.5"
                value={form.inquirySource}
                onChange={set("inquirySource")}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Registration notes</Label>
              <Textarea
                id="notes"
                className="mt-1.5"
                rows={3}
                value={form.registrationNotes}
                onChange={set("registrationNotes")}
              />
            </div>
          </div>
        </Panel>

        <Panel title="3. Signup fee (optional)">
          <p className="mb-3 text-xs text-muted-foreground">
            Recording a fee does not verify or approve finance. Verification is Accounts-only.
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
                onChange={set("feeAmount")}
              />
            </div>
            <div>
              <Label htmlFor="feeMethod">Payment method</Label>
              <Input
                id="feeMethod"
                className="mt-1.5"
                value={form.feeMethod}
                onChange={set("feeMethod")}
              />
            </div>
            <div>
              <Label htmlFor="feeReceipt">Receipt / reference</Label>
              <Input
                id="feeReceipt"
                className="mt-1.5"
                value={form.feeReceipt}
                onChange={set("feeReceipt")}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input
                id="markClaimed"
                type="checkbox"
                checked={form.markClaimed}
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
                onChange={set("feeNotes")}
              />
            </div>
          </div>
        </Panel>

        <Panel title="4. Counsellor assignment">
          <Label htmlFor="counsellor">Assign counsellor</Label>
          <select
            id="counsellor"
            className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.assignedConsultantId}
            onChange={set("assignedConsultantId")}
          >
            <option value="">Pending assignment…</option>
            {(desksQ.data?.options ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
                {d.department ? ` — ${d.department}` : ""}
              </option>
            ))}
          </select>
          {!desksQ.isLoading && (desksQ.data?.options?.length ?? 0) === 0 ? (
            <p className="mt-2 text-xs text-amber-800">
              No active Counsellor / Consultant desks found. You can still save with pending
              assignment.
            </p>
          ) : null}
        </Panel>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Register student"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/staff/front-desk">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
