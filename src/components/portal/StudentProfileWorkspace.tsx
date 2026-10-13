import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EmptyState,
  ErrorState,
  Panel,
  StatCard,
  TableWrap,
  fmtDate,
  portalErrorMessage,
} from "@/components/common";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addStudentNote,
  createStudentApplication,
  getSignupFeeStatus,
  getStudentJourneyTimeline,
  handoverToAdmission,
  recordCounsellingAgreement,
  saveShortlistItem,
  saveStudentAssessment,
  verifySignupFee,
} from "@/services";
import type { StudentProfileWorkspace } from "@/types/student-profile";
import {
  STUDENT_PROFILE_TABS,
  type AssessmentSaveInput,
  type ProfileTabId,
} from "@/types/student-profile";
import { cn } from "@/lib/utils";

const ELIGIBILITY_OPTIONS = ["Good Fit", "Borderline", "Not Ready", "Pending Review"] as const;

type Props = {
  workspace: StudentProfileWorkspace;
  tab: ProfileTabId;
  onTabChange: (tab: ProfileTabId) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function StudentProfileWorkspaceView({ workspace, tab, onTabChange }: Props) {
  const queryClient = useQueryClient();
  const s = workspace.student;
  const [form, setForm] = useState<AssessmentSaveInput>(() => toForm(workspace.assessment));
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [appOpen, setAppOpen] = useState(false);
  const [shortOpen, setShortOpen] = useState(false);
  const [appForm, setAppForm] = useState({
    university: "",
    country: s.destination,
    program: "",
    intake: s.intake === "-" ? "" : s.intake,
    deadline: "",
  });
  const [handoverSummary, setHandoverSummary] = useState("");
  const [lifecycleMsg, setLifecycleMsg] = useState<string | null>(null);
  const feeQ = useQuery({
    queryKey: ["officer", "signup-fee", s.id],
    queryFn: () => getSignupFeeStatus(s.id),
    staleTime: 30_000,
  });
  const [shortForm, setShortForm] = useState({
    universityName: "",
    programName: "",
    country: s.destination,
    suitabilityNote: "",
  });

  useEffect(() => {
    setForm(toForm(workspace.assessment));
  }, [workspace.assessment]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["officer", "student-profile", s.id] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "students-directory"] });
    await queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const saveM = useMutation({
    mutationFn: () => saveStudentAssessment(s.id, form),
    onSuccess: async () => {
      setSaveMsg("Assessment saved.");
      await invalidate();
    },
    onError: (err) => setSaveMsg(portalErrorMessage(err, "Could not save assessment.")),
  });

  const noteM = useMutation({
    mutationFn: () => addStudentNote(s.id, noteBody),
    onSuccess: async () => {
      setNoteOpen(false);
      setNoteBody("");
      await invalidate();
    },
  });

  const appM = useMutation({
    mutationFn: () =>
      createStudentApplication({
        studentId: s.id,
        university: appForm.university,
        country: appForm.country,
        program: appForm.program,
        intake: appForm.intake,
        deadline: appForm.deadline,
      }),
    onSuccess: async () => {
      setAppOpen(false);
      setAppForm({
        university: "",
        country: s.destination,
        program: "",
        intake: s.intake === "-" ? "" : s.intake,
        deadline: "",
      });
      await invalidate();
      onTabChange("applications");
    },
  });

  const shortM = useMutation({
    mutationFn: () =>
      saveShortlistItem({
        studentId: s.id,
        ...shortForm,
      }),
    onSuccess: async () => {
      setShortOpen(false);
      setShortForm({
        universityName: "",
        programName: "",
        country: s.destination,
        suitabilityNote: "",
      });
      await invalidate();
    },
  });

  const docsLabel = useMemo(() => {
    if (!workspace.docsTotalCount) return "No documents";
    return `Docs ${workspace.docsApprovedCount}/${workspace.docsTotalCount} approved`;
  }, [workspace.docsApprovedCount, workspace.docsTotalCount]);

  const setField = <K extends keyof AssessmentSaveInput>(key: K, value: AssessmentSaveInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Student profile
          </p>
          <h1 className="font-display text-2xl font-semibold text-navy md:text-[1.75rem]">
            {s.name} <span className="text-lg font-medium text-muted-foreground">({s.caseId})</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={s.stageLabel} />
            <span className="text-xs text-muted-foreground">{docsLabel}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Destination: {s.destination} Â· Intake: {s.intake} Â· Assigned consultant:{" "}
            {s.consultantName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/staff/students">Directory</Link>
          </Button>
          {workspace.canAddNote ? (
            <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
              + Add note
            </Button>
          ) : null}
          {workspace.canCreateApplication ? (
            <Button size="sm" variant="navy" onClick={() => setAppOpen(true)}>
              + New application
            </Button>
          ) : null}
        </div>
      </div>

      <Panel title="Lifecycle — fee, agreement, admission handover">
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Signup fee:{" "}
            <span className="font-medium text-navy">{feeQ.data?.fee?.status ?? "loading…"}</span>
            {feeQ.data?.fee?.portalActivatedAt ? " · Portal activated" : " · Portal not activated"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!workspace.canEdit}
              onClick={async () => {
                try {
                  setLifecycleMsg(null);
                  await recordCounsellingAgreement({
                    studentId: s.id,
                    consented: true,
                    summary: "Counselling session consent recorded in portal.",
                    outcome: "Proceed to assessment / handover",
                  });
                  setLifecycleMsg("Counselling agreement recorded.");
                  await queryClient.invalidateQueries({
                    queryKey: ["officer", "student-profile", s.id],
                  });
                } catch (e) {
                  setLifecycleMsg(portalErrorMessage(e, "Could not record agreement."));
                }
              }}
            >
              Record counselling consent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  setLifecycleMsg(null);
                  await verifySignupFee({
                    studentId: s.id,
                    action: "verify",
                    activatePortal: true,
                  });
                  setLifecycleMsg("Signup fee verified and portal activated (if authorized).");
                  await feeQ.refetch();
                } catch (e) {
                  setLifecycleMsg(portalErrorMessage(e, "Fee verification denied or failed."));
                }
              }}
            >
              Verify signup fee (Accounts/Admin)
            </Button>
          </div>
          <Textarea
            placeholder="Admission handover summary (required, min 10 chars)"
            value={handoverSummary}
            disabled={!workspace.canEdit}
            onChange={(e) => setHandoverSummary(e.target.value)}
          />
          <Button
            size="sm"
            variant="navy"
            disabled={!workspace.canEdit || handoverSummary.trim().length < 10}
            onClick={async () => {
              try {
                setLifecycleMsg(null);
                await handoverToAdmission({
                  studentId: s.id,
                  summary: handoverSummary,
                  checklist: { assessmentComplete: true, agreementRecorded: true },
                });
                setLifecycleMsg("Handed over to Admission Team queue.");
                setHandoverSummary("");
                await queryClient.invalidateQueries({
                  queryKey: ["officer", "student-profile", s.id],
                });
                await queryClient.invalidateQueries({
                  queryKey: ["officer", "students-directory"],
                });
              } catch (e) {
                setLifecycleMsg(
                  portalErrorMessage(e, "Handover blocked — check assessment/agreement."),
                );
              }
            }}
          >
            Hand over to Admission
          </Button>
          {lifecycleMsg ? <p className="text-xs text-navy">{lifecycleMsg}</p> : null}
        </div>
      </Panel>

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as ProfileTabId)} className="space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
          {STUDENT_PROFILE_TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-royal data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {t.label}
              {t.id === "applications" ? (
                <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-[0.65rem] font-semibold text-royal">
                  {workspace.appsSubmittedCount} submitted
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="assessment" className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Eligibility" value={form.eligibility || "â€”"} />
            <StatCard
              label="IELTS / Language"
              value={form.languageScore || form.languageTest || "â€”"}
            />
            <StatCard label="Annual budget" value={form.annualBudget || "â€”"} />
            <StatCard
              label="Apps submitted"
              value={`${workspace.appsSubmittedCount} of ${form.applicationTarget || 0} target`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Profile and academic assessment">
              <div className="grid gap-3">
                <Field label="Last qualification">
                  <Input
                    value={form.lastQualification}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("lastQualification", e.target.value)}
                  />
                </Field>
                <Field label="Marks / CGPA">
                  <Input
                    value={form.marksCgpa}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("marksCgpa", e.target.value)}
                  />
                </Field>
                <Field label="Education gap">
                  <Input
                    value={form.educationGap}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("educationGap", e.target.value)}
                  />
                </Field>
                <Field label="Work experience">
                  <Input
                    value={form.workExperience}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("workExperience", e.target.value)}
                  />
                </Field>
                <Field label="Preferred level">
                  <Input
                    value={form.preferredLevel}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("preferredLevel", e.target.value)}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Study plan and strategy">
              <div className="grid gap-3">
                <Field label="Eligibility assessment">
                  <select
                    className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                    value={form.eligibility}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("eligibility", e.target.value)}
                  >
                    {ELIGIBILITY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Language test">
                    <Input
                      value={form.languageTest}
                      disabled={!workspace.canEdit}
                      onChange={(e) => setField("languageTest", e.target.value)}
                    />
                  </Field>
                  <Field label="Language score">
                    <Input
                      value={form.languageScore}
                      disabled={!workspace.canEdit}
                      onChange={(e) => setField("languageScore", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Annual budget">
                  <Input
                    value={form.annualBudget}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("annualBudget", e.target.value)}
                  />
                </Field>
                <Field label="Funding source">
                  <Input
                    value={form.fundingSource}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("fundingSource", e.target.value)}
                  />
                </Field>
                <Field label="Application target count">
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={form.applicationTarget}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("applicationTarget", Number(e.target.value) || 0)}
                  />
                </Field>
                <Field label="Target countries">
                  <Input
                    value={form.targetCountries}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("targetCountries", e.target.value)}
                  />
                </Field>
                <Field label="Target intake">
                  <Input
                    value={form.targetIntake}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("targetIntake", e.target.value)}
                  />
                </Field>
                <Field label="Study plan">
                  <Textarea
                    value={form.studyPlan}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("studyPlan", e.target.value)}
                  />
                </Field>
                <Field label="Immediate next step">
                  <Input
                    value={form.immediateNextStep}
                    disabled={!workspace.canEdit}
                    onChange={(e) => setField("immediateNextStep", e.target.value)}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Assessed by:{" "}
                  <span className="font-medium text-navy">
                    {workspace.assessment.assessedByName || "â€”"}
                  </span>
                  {workspace.assessment.assessedAt
                    ? ` (${fmtDate(workspace.assessment.assessedAt.slice(0, 10))})`
                    : ""}
                </p>
              </div>
            </Panel>
          </div>

          {workspace.canEdit ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="navy"
                disabled={saveM.isPending}
                onClick={() => {
                  setSaveMsg(null);
                  saveM.mutate();
                }}
              >
                {saveM.isPending ? "Saving..." : "Save assessment"}
              </Button>
              {saveMsg ? (
                <p
                  className={cn("text-sm", saveM.isError ? "text-danger" : "text-muted-foreground")}
                >
                  {saveMsg}
                </p>
              ) : null}
              {saveM.isError ? <ErrorState body={portalErrorMessage(saveM.error)} /> : null}
            </div>
          ) : null}

          <Panel
            title="Counsellor shortlist"
            action={
              workspace.canEdit ? (
                <Button size="sm" variant="outline" onClick={() => setShortOpen(true)}>
                  Add shortlist item
                </Button>
              ) : null
            }
          >
            {!workspace.shortlist.length ? (
              <EmptyState
                title="No shortlist items"
                body="Document university/program options and suitability notes here. Notes are counsellor-authored, not auto-scored."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {workspace.shortlist.map((item) => (
                  <div key={item.id} className="border-b border-border pb-3">
                    <p className="font-semibold text-navy">{item.universityName}</p>
                    <p className="text-sm text-muted-foreground">{item.programName}</p>
                    <p className="mt-2 text-xs text-navy">{item.suitabilityNote || "â€”"}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="overview">
          <Panel title="Overview">
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <OverviewItem label="Email" value={s.email} />
              <OverviewItem label="Phone" value={s.phone} />
              <OverviewItem label="City" value={s.city} />
              <OverviewItem label="Program interest" value={s.program} />
              <OverviewItem label="Destination" value={s.destination} />
              <OverviewItem label="Intake" value={s.intake} />
              <OverviewItem label="Stage" value={s.stageLabel} />
              <OverviewItem label="Consultant" value={s.consultantName} />
              <OverviewItem label="Last activity" value={fmtDate(s.lastActivity)} />
              <OverviewItem
                label="Next step"
                value={workspace.assessment.immediateNextStep || "—"}
              />
            </dl>
          </Panel>
          <StaffJourneyTimeline studentId={s.id} />
        </TabsContent>

        <TabsContent value="academic">
          <Panel title="Academic profile">
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <OverviewItem
                label="Last qualification"
                value={workspace.assessment.lastQualification || s.qualification}
              />
              <OverviewItem label="Institution" value={s.institution} />
              <OverviewItem
                label="Marks / CGPA"
                value={workspace.assessment.marksCgpa || s.grade}
              />
              <OverviewItem
                label="Education gap"
                value={workspace.assessment.educationGap || "â€”"}
              />
              <OverviewItem
                label="Work experience"
                value={workspace.assessment.workExperience || "â€”"}
              />
              <OverviewItem
                label="Preferred level"
                value={workspace.assessment.preferredLevel || s.studyLevel}
              />
              <OverviewItem
                label="Language"
                value={workspace.assessment.languageScore || s.englishTest}
              />
              <OverviewItem label="Funding" value={workspace.assessment.fundingSource || "â€”"} />
            </dl>
          </Panel>
        </TabsContent>

        <TabsContent value="documents">
          <Panel title="Documents">
            {!workspace.documents.length ? (
              <EmptyState title="No documents uploaded" />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.documents.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium text-navy">{d.name}</td>
                      <td>{d.category}</td>
                      <td>{fmtDate(d.uploaded)}</td>
                      <td>
                        <StatusBadge status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="applications">
          <Panel title="Applications">
            {!workspace.applications.length ? (
              <EmptyState
                title="No applications yet"
                body="Use New application to create a draft."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>University</th>
                    <th>Program</th>
                    <th>Intake</th>
                    <th>Deadline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.applications.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td className="font-medium text-navy">{a.university}</td>
                      <td>{a.program}</td>
                      <td>{a.intake}</td>
                      <td>{fmtDate(a.deadline)}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="offers-visa">
          <Panel title="Offers and visa">
            {!workspace.offersVisa.length ? (
              <EmptyState
                title="No offer or visa records"
                body="Offer/CAS/visa tracking appears here when records exist for this student."
              />
            ) : (
              <TableWrap>
                <thead>
                  <tr>
                    <th>University</th>
                    <th>Offer type</th>
                    <th>Conditions</th>
                    <th>Status</th>
                    <th>Deadline</th>
                    <th>Deposit</th>
                    <th>CAS/I-20</th>
                    <th>Visa</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.offersVisa.map((o) => (
                    <tr key={o.id}>
                      <td className="font-medium text-navy">{o.university}</td>
                      <td>{o.offerType}</td>
                      <td>{o.conditionsSummary}</td>
                      <td>{o.status}</td>
                      <td>{fmtDate(o.acceptDeadline)}</td>
                      <td>{o.depositStatus}</td>
                      <td>{o.casI20Status}</td>
                      <td>{o.visaStage}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="notes">
          <Panel
            title="Internal notes"
            action={
              workspace.canAddNote ? (
                <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}>
                  + Add note
                </Button>
              ) : null
            }
          >
            {!workspace.notes.length ? (
              <EmptyState title="No notes yet" />
            ) : (
              <ul className="space-y-4">
                {workspace.notes.map((n) => (
                  <li
                    key={n.id}
                    className="border-t border-border/70 pt-3 first:border-0 first:pt-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {n.authorName} Â· {fmtDate(n.createdAt.slice(0, 10))}
                        {n.pinned ? " Â· Pinned" : ""}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-navy whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Internal note (staff only)"
          />
          {noteM.isError ? <ErrorState body={portalErrorMessage(noteM.error)} /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={noteM.isPending || noteBody.trim().length < 2}
              onClick={() => noteM.mutate()}
            >
              {noteM.isPending ? "Saving..." : "Save note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={appOpen} onOpenChange={setAppOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New application</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {(
              [
                ["university", "University"],
                ["program", "Program"],
                ["country", "Country"],
                ["intake", "Intake"],
                ["deadline", "Deadline (YYYY-MM-DD)"],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                placeholder={label}
                aria-label={label}
                value={appForm[key]}
                onChange={(e) => setAppForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            ))}
            {appM.isError ? <ErrorState body={portalErrorMessage(appM.error)} /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={
                appM.isPending ||
                !appForm.university.trim() ||
                !appForm.program.trim() ||
                !appForm.country.trim() ||
                !appForm.intake.trim()
              }
              onClick={() => appM.mutate()}
            >
              {appM.isPending ? "Creating..." : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shortOpen} onOpenChange={setShortOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shortlist item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="University"
              value={shortForm.universityName}
              onChange={(e) => setShortForm((f) => ({ ...f, universityName: e.target.value }))}
            />
            <Input
              placeholder="Program"
              value={shortForm.programName}
              onChange={(e) => setShortForm((f) => ({ ...f, programName: e.target.value }))}
            />
            <Input
              placeholder="Country"
              value={shortForm.country}
              onChange={(e) => setShortForm((f) => ({ ...f, country: e.target.value }))}
            />
            <Textarea
              placeholder="Suitability note (counsellor-authored)"
              value={shortForm.suitabilityNote}
              onChange={(e) => setShortForm((f) => ({ ...f, suitabilityNote: e.target.value }))}
            />
            {shortM.isError ? <ErrorState body={portalErrorMessage(shortM.error)} /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="navy"
              disabled={
                shortM.isPending ||
                !shortForm.universityName.trim() ||
                !shortForm.programName.trim()
              }
              onClick={() => shortM.mutate()}
            >
              {shortM.isPending ? "Saving..." : "Add to shortlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffJourneyTimeline({ studentId }: { studentId: string }) {
  const timelineQ = useQuery({
    queryKey: ["officer", "student-timeline", studentId],
    queryFn: () => getStudentJourneyTimeline(studentId),
    staleTime: 20_000,
  });

  return (
    <Panel title="Journey timeline" className="mt-4">
      {timelineQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      ) : timelineQ.isError ? (
        <p className="text-sm text-muted-foreground">
          {portalErrorMessage(timelineQ.error, "Timeline unavailable.")}
        </p>
      ) : !timelineQ.data?.items.length ? (
        <p className="text-sm text-muted-foreground">
          No persisted journey events yet for this student.
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {timelineQ.data.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-2 border-t border-border/70 pt-2 first:border-0 first:pt-0"
            >
              <div>
                <p className="font-medium text-navy">{item.title}</p>
                {item.detail ? (
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                ) : null}
                {item.pendingAction ? (
                  <p className="text-xs text-royal">{item.pendingAction}</p>
                ) : null}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="font-semibold uppercase tracking-wide text-navy">{item.status}</p>
                <p>{item.at ? fmtDate(item.at) : "—"}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium text-navy">{value || "—"}</dd>
    </div>
  );
}

function toForm(a: StudentProfileWorkspace["assessment"]): AssessmentSaveInput {
  return {
    eligibility: a.eligibility,
    languageTest: a.languageTest,
    languageScore: a.languageScore,
    annualBudget: a.annualBudget,
    fundingSource: a.fundingSource,
    applicationTarget: a.applicationTarget,
    lastQualification: a.lastQualification,
    marksCgpa: a.marksCgpa,
    educationGap: a.educationGap,
    workExperience: a.workExperience,
    preferredLevel: a.preferredLevel,
    targetCountries: a.targetCountries,
    targetIntake: a.targetIntake,
    studyPlan: a.studyPlan,
    immediateNextStep: a.immediateNextStep,
  };
}
