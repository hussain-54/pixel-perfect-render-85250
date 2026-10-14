import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PageHeader,
  Panel,
  ErrorState,
  LoadingRows,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/lib/useData";
import {
  getCurrentStudent,
  lookupConsultant,
  stageLabel,
  updateOwnStudentContact,
} from "@/services";

export const Route = createFileRoute("/student/profile")({
  component: StudentProfile,
});

type ContactForm = {
  phone: string;
  whatsapp: string;
  city: string;
  dob: string;
  destination: string;
  program: string;
  studyLevel: string;
};

function StudentProfile() {
  const queryClient = useQueryClient();
  const studentQ = useData(["student", "current"], getCurrentStudent);
  const [form, setForm] = useState<ContactForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!studentQ.data) return;
    const s = studentQ.data;
    setForm({
      phone: s.phone,
      whatsapp: s.whatsapp,
      city: s.city,
      dob: s.dob,
      destination: s.destination,
      program: s.program,
      studyLevel: s.studyLevel,
    });
  }, [studentQ.data]);

  const saveM = useMutation({
    mutationFn: async (values: ContactForm) => updateOwnStudentContact(values),
    onSuccess: async (result) => {
      setMessage("Contact details saved.");
      if (result?.student) {
        queryClient.setQueryData(["student", "current"], result.student);
      }
      await queryClient.invalidateQueries({ queryKey: ["student", "current"] });
    },
    onError: (err) => {
      setMessage(portalErrorMessage(err, "Could not save contact details."));
    },
  });

  if (studentQ.isLoading) return <LoadingRows rows={5} />;
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const s = studentQ.data;
  const consultant = lookupConsultant(s.consultantId);
  const values = form ?? {
    phone: s.phone,
    whatsapp: s.whatsapp,
    city: s.city,
    dob: s.dob,
    destination: s.destination,
    program: s.program,
    studyLevel: s.studyLevel,
  };

  const readOnly: [string, string][] = [
    ["Case ID", s.caseId],
    ["Email", s.email],
    ["Qualification", s.qualification || "—"],
    ["Institution", s.institution || "—"],
    ["Grades", s.grade || "—"],
    ["English test", s.englishTest || "—"],
    ["Journey stage", stageLabel(s.stage)],
    ["Consultant", consultant?.name ?? "—"],
  ];

  const editable: { key: keyof ContactForm; label: string; type?: string }[] = [
    { key: "phone", label: "Phone" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "city", label: "City" },
    { key: "dob", label: "Date of birth", type: "date" },
    { key: "destination", label: "Destination" },
    { key: "program", label: "Program" },
    { key: "studyLevel", label: "Study level" },
  ];

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Update your contact and study preferences. Name, email, and case details are managed by staff."
      />
      <Panel title={s.name}>
        <div className="mb-4">
          <StatusBadge status={stageLabel(s.stage)} className="text-xs" />
        </div>

        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            saveM.mutate(values);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {editable.map(({ key, label, type }) => (
              <div key={key} className="space-y-1.5">
                <Label
                  htmlFor={`profile-${key}`}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {label}
                </Label>
                <Input
                  id={`profile-${key}`}
                  type={type ?? "text"}
                  value={values[key]}
                  onChange={(ev) => setForm({ ...values, [key]: ev.target.value })}
                  disabled={saveM.isPending}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saveM.isPending}>
              {saveM.isPending ? "Saving…" : "Save contact details"}
            </Button>
            {message ? (
              <p
                className={
                  saveM.isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                }
                role="status"
              >
                {message}
              </p>
            ) : null}
          </div>
        </form>

        <dl className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
          {readOnly.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 text-sm font-medium text-navy">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
