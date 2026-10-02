import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, ErrorState, LoadingRows } from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { useData } from "@/lib/useData";
import { getCurrentStudent, lookupConsultant, stageLabel } from "@/services";

export const Route = createFileRoute("/student/profile")({
  component: StudentProfile,
});

function StudentProfile() {
  const studentQ = useData(["student", "current"], getCurrentStudent);

  if (studentQ.isLoading) return <LoadingRows rows={5} />;
  if (studentQ.isError || !studentQ.data) return <ErrorState />;

  const s = studentQ.data;
  const consultant = lookupConsultant(s.consultantId);

  const fields: [string, string][] = [
    ["Case ID", s.caseId],
    ["Email", s.email],
    ["Phone", s.phone],
    ["WhatsApp", s.whatsapp],
    ["City", s.city],
    ["Date of birth", s.dob],
    ["Destination", s.destination],
    ["Program", s.program],
    ["Study level", s.studyLevel],
    ["Qualification", s.qualification],
    ["Institution", s.institution],
    ["Grades", s.grade],
    ["English test", s.englishTest],
    ["Journey stage", stageLabel(s.stage)],
    ["Consultant", consultant?.name ?? "—"],
  ];

  return (
    <div>
      <PageHeader title="Profile" subtitle="Demo profile — edits are not saved." />
      <Panel title={s.name}>
        <div className="mb-4">
          <StatusBadge status={stageLabel(s.stage)} className="text-xs" />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {fields.map(([label, value]) => (
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
