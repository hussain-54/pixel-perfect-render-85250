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
  requestFeeVerification,
  saveShortlistItem,
  saveStudentAssessment,
} from "@/services";
import type { StudentProfileWorkspace } from "@/types/student-profile";
import {
  STUDENT_PROFILE_TABS,
  type AssessmentSaveInput,
  type ProfileTabId,
} from "@/types/student-profile";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "@/components/portal/SearchableSelect";
import { CounsellingAssessmentFormA4 } from "@/components/portal/CounsellingAssessmentFormA4";
import { validateAssessmentForSave } from "@/lib/counsellor-handover-rules";
import {
  counsellorLifecycleProgressSteps,
  DEFAULT_ADMISSION_HANDOVER_SUMMARY,
  DEFAULT_FEE_VERIFICATION_SUMMARY,
  normalizeOptionalActionSummary,
  resolveCounsellorLifecycleNext,
} from "@/lib/counsellor-lifecycle-next";
import {
  COUNSELLOR_DESTINATIONS,
  COUNSELLOR_ELIGIBILITY,
  COUNSELLOR_FUNDING_SOURCES,
  COUNSELLOR_LANGUAGE_TESTS,
  COUNSELLOR_QUALIFICATIONS,
  COUNSELLOR_SEASONS,
  COUNSELLOR_STUDY_LEVELS,
  formatIntakeLabel,
  intakeYearOptions,
  parseIntakeSeasonYear,
  type IntakeSeason,
} from "@/lib/counsellor-form-options";
import { resolveCatalogOrOther } from "@/lib/intake-form-options";

type Props = {
  workspace: StudentProfileWorkspace;
  tab: ProfileTabId;
  onTabChange: (tab: ProfileTabId) => void;
};

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string | null | undefined;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
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
  const [feeRequestSummary, setFeeRequestSummary] = useState("");
  const [showFeeNote, setShowFeeNote] = useState(false);
  const [showHandoverNote, setShowHandoverNote] = useState(false);
  const [lifecycleMsg, setLifecycleMsg] = useState<string | null>(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(
    () => workspace.canEdit && !workspace.assessment.assessedAt,
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof AssessmentSaveInput, string>>
  >({});
  const [showPrintAssessment, setShowPrintAssessment] = useState(false);
  const parsedIntake = parseIntakeSeasonYear(workspace.assessment.targetIntake);
  const [intakeSeason, setIntakeSeason] = useState<IntakeSeason | "">(parsedIntake.season);
  const [intakeYear, setIntakeYear] = useState<number | "">(parsedIntake.year);
  const [qualificationOther, setQualificationOther] = useState("");
  const [levelOther, setLevelOther] = useState("");
  const [countryOther, setCountryOther] = useState("");
  const [langOther, setLangOther] = useState("");
  const [fundingOther, setFundingOther] = useState("");
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

  const baselineForm = useMemo(() => toForm(workspace.assessment), [workspace.assessment]);
  const assessmentDirty = useMemo(() => {
    if (!editingAssessment) return false;
    const intakeLabel = formatIntakeLabel(intakeSeason, intakeYear) || form.targetIntake;
    return (
      JSON.stringify({ ...form, targetIntake: intakeLabel }) !==
      JSON.stringify({ ...baselineForm, targetIntake: workspace.assessment.targetIntake })
    );
  }, [
    editingAssessment,
    form,
    intakeSeason,
    intakeYear,
    baselineForm,
    workspace.assessment.targetIntake,
  ]);

  useEffect(() => {
    setForm(toForm(workspace.assessment));
    const parsed = parseIntakeSeasonYear(workspace.assessment.targetIntake);
    setIntakeSeason(parsed.season);
    setIntakeYear(parsed.year);
    setFieldErrors({});
  }, [workspace.assessment]);

  useEffect(() => {
    if (!assessmentDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [assessmentDirty]);

  const invalidateProfile = async () => {
    await queryClient.invalidateQueries({ queryKey: ["officer", "student-profile", s.id] });
  };

  const invalidate = async () => {
    await invalidateProfile();
    await queryClient.invalidateQueries({ queryKey: ["officer", "dashboard"] });
    await queryClient.invalidateQueries({ queryKey: ["officer", "students-directory"] });
    await queryClient.invalidateQueries({ queryKey: ["applications"] });
  };

  const buildAssessmentPayload = (): AssessmentSaveInput | null => {
    const qual = catalogOrKeep(
      form.lastQualification,
      qualificationOther,
      COUNSELLOR_QUALIFICATIONS,
    );
    const level = catalogOrKeep(form.preferredLevel, levelOther, COUNSELLOR_STUDY_LEVELS);
    const country = catalogOrKeep(form.targetCountries, countryOther, COUNSELLOR_DESTINATIONS);
    const lang = catalogOrKeep(form.languageTest, langOther, COUNSELLOR_LANGUAGE_TESTS);
    const funding = catalogOrKeep(form.fundingSource, fundingOther, COUNSELLOR_FUNDING_SOURCES);
    if (!qual.ok) {
      setSaveMsg(qual.error);
      return null;
    }
    if (!level.ok) {
      setSaveMsg(level.error);
      return null;
    }
    if (!country.ok) {
      setSaveMsg(country.error);
      return null;
    }
    if (!lang.ok) {
      setSaveMsg(lang.error);
      return null;
    }
    if (!funding.ok) {
      setSaveMsg(funding.error);
      return null;
    }
    const intakeLabel = formatIntakeLabel(intakeSeason, intakeYear) || form.targetIntake.trim();
    return {
      ...form,
      lastQualification: qual.value,
      preferredLevel: level.value,
      targetCountries: country.value,
      languageTest: lang.value,
      fundingSource: funding.value,
      targetIntake: intakeLabel,
    };
  };

  const saveM = useMutation({
    mutationFn: (payload: AssessmentSaveInput) =>
      saveStudentAssessment(s.id, payload, workspace.assessment.updatedAt),
    onSuccess: async () => {
      setSaveMsg("Assessment saved.");
      setEditingAssessment(false);
      setFieldErrors({});
      await invalidateProfile();
    },
    onError: (err) => setSaveMsg(portalErrorMessage(err, "Could not save assessment.")),
  });

  const feeStatus = feeQ.data?.fee?.status ?? null;
  const hasSavedAssessment = Boolean(workspace.assessment.assessedAt);
  const lifecycleSnap = feeQ.data?.lifecycle;
  const openFeeRequestStatus =
    lifecycleSnap?.feeRequest && ["open", "in_progress"].includes(lifecycleSnap.feeRequest.status)
      ? lifecycleSnap.feeRequest.status
      : null;
  const lifecycleInput = {
    hasSavedAssessment,
    hasConsent: Boolean(lifecycleSnap?.hasConsent),
    signupFeeStatus: feeStatus,
    openFeeRequestStatus,
    handoverStatus: lifecycleSnap?.handover?.status ?? null,
  };
  const nextStep = resolveCounsellorLifecycleNext(lifecycleInput);
  const progressSteps = counsellorLifecycleProgressSteps(lifecycleInput);
  const fieldsEditable = workspace.canEdit && editingAssessment;

  const printAssessment = () => {
    if (!hasSavedAssessment) {
      setSaveMsg("Save the assessment before printing or downloading.");
      return;
    }
    setShowPrintAssessment(true);
    window.setTimeout(() => window.print(), 80);
  };

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
    <>
      <div className="student-profile-no-print">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Student profile
            </p>
            <h1 className="font-display text-2xl font-semibold text-navy md:text-[1.75rem]">
              {s.name}{" "}
              <span className="text-lg font-medium text-muted-foreground">({s.caseId})</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={s.stageLabel} />
              <span className="text-xs text-muted-foreground">{docsLabel}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Destination: {s.destination} · Intake: {s.intake} · Assigned consultant:{" "}
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
              <Button size="sm" variant="outline" onClick={() => setAppOpen(true)}>
                + Application
              </Button>
            ) : null}
          </div>
        </div>

        <Panel title="Next step">
          <div className="space-y-4 text-sm">
            <ol className="flex flex-wrap gap-2">
              {progressSteps.map((step) => (
                <li
                  key={step.id}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium",
                    step.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : step.current
                        ? "border-navy/30 bg-navy/5 text-navy"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {step.done ? "✓ " : step.current ? "→ " : ""}
                  {step.label}
                </li>
              ))}
            </ol>

            <div className="rounded-md border border-border bg-white px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {nextStep.feeStatusLabel}
                {feeQ.isLoading ? " · Loading…" : null}
                {feeQ.data?.fee?.portalActivatedAt ? " · Portal activated" : null}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-navy">
                {nextStep.title}
              </h2>
              <p className="mt-1 text-muted-foreground">{nextStep.body}</p>

              {nextStep.primaryAction === "go_assessment" ? (
                <Button
                  className="mt-3"
                  size="sm"
                  variant="navy"
                  onClick={() => onTabChange("assessment")}
                >
                  {nextStep.primaryLabel}
                </Button>
              ) : null}

              {nextStep.primaryAction === "record_consent" ? (
                <Button
                  className="mt-3"
                  size="sm"
                  variant="navy"
                  disabled={!workspace.canEdit || lifecycleBusy}
                  onClick={async () => {
                    try {
                      setLifecycleBusy(true);
                      setLifecycleMsg(null);
                      await recordCounsellingAgreement({
                        studentId: s.id,
                        consented: true,
                        summary: "Counselling session consent recorded in portal.",
                        outcome: "Proceed to assessment and fee verification",
                      });
                      setLifecycleMsg("Counselling consent recorded.");
                      await invalidateProfile();
                      await feeQ.refetch();
                    } catch (e) {
                      setLifecycleMsg(portalErrorMessage(e, "Could not record consent."));
                    } finally {
                      setLifecycleBusy(false);
                    }
                  }}
                >
                  {lifecycleBusy ? "Saving…" : nextStep.primaryLabel}
                </Button>
              ) : null}

              {nextStep.primaryAction === "request_fee_verification" ? (
                <div className="mt-3 space-y-2">
                  {!workspace.canEdit ? (
                    <p className="text-xs text-muted-foreground">
                      Only the assigned counsellor can request fee verification.
                    </p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 text-xs text-muted-foreground"
                        onClick={() => setShowFeeNote((v) => !v)}
                      >
                        {showFeeNote ? "Hide optional note" : "Add optional note for Front Desk"}
                      </Button>
                      {showFeeNote ? (
                        <Textarea
                          placeholder="Optional note (leave blank if not needed)"
                          value={feeRequestSummary}
                          disabled={lifecycleBusy}
                          onChange={(e) => setFeeRequestSummary(e.target.value)}
                        />
                      ) : null}
                      <Button
                        size="sm"
                        variant="navy"
                        disabled={lifecycleBusy}
                        onClick={async () => {
                          try {
                            setLifecycleBusy(true);
                            setLifecycleMsg(null);
                            const result = await requestFeeVerification({
                              studentId: s.id,
                              summary: normalizeOptionalActionSummary(
                                feeRequestSummary,
                                DEFAULT_FEE_VERIFICATION_SUMMARY,
                              ),
                            });
                            if (!result?.ok || !result?.requestId) {
                              setLifecycleMsg(
                                "Request was not saved. Confirm assessment and consent first.",
                              );
                              return;
                            }
                            setLifecycleMsg(
                              result.message || "Sent to Front Desk for fee verification.",
                            );
                            setFeeRequestSummary("");
                            setShowFeeNote(false);
                            await feeQ.refetch();
                            await queryClient.invalidateQueries({
                              queryKey: ["front-desk", "fee-verification-requests"],
                            });
                          } catch (e) {
                            setLifecycleMsg(
                              portalErrorMessage(
                                e,
                                "Could not request fee verification. Save assessment and consent first.",
                              ),
                            );
                          } finally {
                            setLifecycleBusy(false);
                          }
                        }}
                      >
                        {lifecycleBusy ? "Sending…" : nextStep.primaryLabel}
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              {nextStep.primaryAction === "forward_admission" ? (
                <div className="mt-3 space-y-2">
                  {!workspace.canEdit ? (
                    <p className="text-xs text-muted-foreground">
                      Only the assigned counsellor can forward to Admission.
                    </p>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-auto px-0 text-xs text-muted-foreground"
                        onClick={() => setShowHandoverNote((v) => !v)}
                      >
                        {showHandoverNote
                          ? "Hide optional note"
                          : "Add optional note for Admission"}
                      </Button>
                      {showHandoverNote ? (
                        <Textarea
                          placeholder="Optional note (leave blank if not needed)"
                          value={handoverSummary}
                          disabled={lifecycleBusy}
                          onChange={(e) => setHandoverSummary(e.target.value)}
                        />
                      ) : null}
                      <Button
                        size="sm"
                        variant="navy"
                        disabled={lifecycleBusy}
                        onClick={async () => {
                          try {
                            setLifecycleBusy(true);
                            setLifecycleMsg(null);
                            const result = await handoverToAdmission({
                              studentId: s.id,
                              summary: normalizeOptionalActionSummary(
                                handoverSummary,
                                DEFAULT_ADMISSION_HANDOVER_SUMMARY,
                              ),
                              checklist: {
                                assessmentComplete: true,
                                agreementRecorded: true,
                              },
                            });
                            if (result && "alreadySubmitted" in result && result.alreadySubmitted) {
                              setLifecycleMsg(
                                result.message ??
                                  "This student is already in the Admission Team queue.",
                              );
                            } else {
                              setLifecycleMsg("Forwarded to the Admission Team.");
                              setHandoverSummary("");
                              setShowHandoverNote(false);
                            }
                            await invalidateProfile();
                            await feeQ.refetch();
                            await queryClient.invalidateQueries({
                              queryKey: ["officer", "students-directory"],
                            });
                            await queryClient.invalidateQueries({
                              queryKey: ["officer", "admission-handovers"],
                            });
                          } catch (e) {
                            setLifecycleMsg(
                              portalErrorMessage(
                                e,
                                "Handover blocked. Confirm fee is verified/waived, assessment, and consent.",
                              ),
                            );
                          } finally {
                            setLifecycleBusy(false);
                          }
                        }}
                      >
                        {lifecycleBusy ? "Sending…" : nextStep.primaryLabel}
                      </Button>
                    </>
                  )}
                </div>
              ) : null}

              {lifecycleSnap?.handover ? (
                <details className="mt-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-navy">
                    Handover status: {lifecycleSnap.handover.status}
                  </summary>
                  <p className="mt-1">
                    Last update{" "}
                    {lifecycleSnap.handover.handedOverAt
                      ? fmtDate(lifecycleSnap.handover.handedOverAt.slice(0, 10))
                      : "—"}
                    . Admission Team owns the next decision.
                  </p>
                </details>
              ) : null}

              {lifecycleSnap?.feeRequest &&
              !["open", "in_progress"].includes(lifecycleSnap.feeRequest.status) ? (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-navy">
                    Last fee request: {lifecycleSnap.feeRequest.status.replaceAll("_", " ")}
                  </summary>
                  <p className="mt-1">{lifecycleSnap.feeRequest.summary || "—"}</p>
                </details>
              ) : null}
            </div>

            {lifecycleMsg ? <p className="text-xs text-navy">{lifecycleMsg}</p> : null}
            {feeQ.isError ? (
              <p className="text-xs text-danger">
                Could not load fee status: {portalErrorMessage(feeQ.error)}. Retry refresh.
              </p>
            ) : null}
          </div>
        </Panel>

        <Tabs
          value={tab}
          onValueChange={(v) => onTabChange(v as ProfileTabId)}
          className="space-y-5"
        >
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
              <StatCard label="Eligibility" value={form.eligibility || "—"} />
              <StatCard label="Language" value={form.languageScore || form.languageTest || "—"} />
              <StatCard label="Annual budget" value={form.annualBudget || "—"} />
              <StatCard
                label="Apps submitted"
                value={`${workspace.appsSubmittedCount} of ${form.applicationTarget || 0} target`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Academic background">
                <div className="grid gap-3">
                  <Field label="Last qualification">
                    <CatalogOrCustom
                      value={form.lastQualification}
                      other={qualificationOther}
                      options={COUNSELLOR_QUALIFICATIONS}
                      disabled={!fieldsEditable}
                      onValue={(v) => setField("lastQualification", v)}
                      onOther={setQualificationOther}
                    />
                  </Field>
                  <Field label="Marks / CGPA">
                    <Input
                      value={form.marksCgpa}
                      disabled={!fieldsEditable}
                      onChange={(e) => setField("marksCgpa", e.target.value)}
                    />
                  </Field>
                  <Field label="Education gap">
                    <Input
                      value={form.educationGap}
                      disabled={!fieldsEditable}
                      placeholder="e.g. 1 year"
                      onChange={(e) => setField("educationGap", e.target.value)}
                    />
                  </Field>
                  <Field label="Work experience (years)">
                    <Input
                      value={form.workExperience}
                      disabled={!fieldsEditable}
                      onChange={(e) => setField("workExperience", e.target.value)}
                    />
                  </Field>
                  <Field label="Study level">
                    <CatalogOrCustom
                      value={form.preferredLevel}
                      other={levelOther}
                      options={COUNSELLOR_STUDY_LEVELS}
                      disabled={!fieldsEditable}
                      onValue={(v) => setField("preferredLevel", v)}
                      onOther={setLevelOther}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="Eligibility and study plan">
                <div className="grid gap-3">
                  <Field label="Eligibility outcome *" error={fieldErrors.eligibility ?? null}>
                    <select
                      className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                      value={form.eligibility}
                      disabled={!fieldsEditable}
                      onChange={(e) => {
                        setField("eligibility", e.target.value);
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.eligibility;
                          return next;
                        });
                      }}
                    >
                      <option value="">Select outcome (blank saves as Pending Review)</option>
                      {COUNSELLOR_ELIGIBILITY.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="English test">
                      <CatalogOrCustom
                        value={form.languageTest}
                        other={langOther}
                        options={COUNSELLOR_LANGUAGE_TESTS}
                        disabled={!fieldsEditable}
                        onValue={(v) => setField("languageTest", v)}
                        onOther={setLangOther}
                        searchable={false}
                      />
                    </Field>
                    <Field label="Test score">
                      <Input
                        value={form.languageScore}
                        disabled={!fieldsEditable || form.languageTest === "Not taken yet"}
                        onChange={(e) => setField("languageScore", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Annual budget">
                    <Input
                      value={form.annualBudget}
                      disabled={!fieldsEditable}
                      placeholder="e.g. PKR 3–4 million"
                      onChange={(e) => setField("annualBudget", e.target.value)}
                    />
                  </Field>
                  <Field label="Funding source">
                    <CatalogOrCustom
                      value={form.fundingSource}
                      other={fundingOther}
                      options={COUNSELLOR_FUNDING_SOURCES}
                      disabled={!fieldsEditable}
                      onValue={(v) => setField("fundingSource", v)}
                      onOther={setFundingOther}
                      searchable={false}
                    />
                  </Field>
                  <Field label="Application target" error={fieldErrors.applicationTarget ?? null}>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={form.applicationTarget}
                      disabled={!fieldsEditable}
                      onChange={(e) => {
                        setField("applicationTarget", Number(e.target.value) || 0);
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.applicationTarget;
                          return next;
                        });
                      }}
                    />
                  </Field>
                  <Field label="Preferred destination">
                    <CatalogOrCustom
                      value={form.targetCountries}
                      other={countryOther}
                      options={COUNSELLOR_DESTINATIONS}
                      disabled={!fieldsEditable}
                      onValue={(v) => setField("targetCountries", v)}
                      onOther={setCountryOther}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Intake season">
                      <select
                        className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                        value={intakeSeason}
                        disabled={!fieldsEditable}
                        onChange={(e) => setIntakeSeason(e.target.value as IntakeSeason | "")}
                      >
                        <option value="">Season</option>
                        {COUNSELLOR_SEASONS.map((season) => (
                          <option key={season} value={season}>
                            {season}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Intake year">
                      <select
                        className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
                        value={intakeYear === "" ? "" : String(intakeYear)}
                        disabled={!fieldsEditable}
                        onChange={(e) =>
                          setIntakeYear(e.target.value ? Number(e.target.value) : "")
                        }
                      >
                        <option value="">Year</option>
                        {intakeYearOptions().map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {(intakeSeason && intakeYear) || form.targetIntake ? (
                    <p className="text-xs text-muted-foreground">
                      Intake:{" "}
                      <span className="font-medium text-navy">
                        {formatIntakeLabel(intakeSeason, intakeYear) || form.targetIntake}
                      </span>
                    </p>
                  ) : null}
                  <Field label="Counsellor notes / study plan">
                    <Textarea
                      value={form.studyPlan}
                      disabled={!fieldsEditable}
                      onChange={(e) => setField("studyPlan", e.target.value)}
                    />
                  </Field>
                  <Field label="Immediate next step">
                    <Input
                      value={form.immediateNextStep}
                      disabled={!fieldsEditable}
                      onChange={(e) => setField("immediateNextStep", e.target.value)}
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Assessed by:{" "}
                    <span className="font-medium text-navy">
                      {workspace.assessment.assessedByName || "—"}
                    </span>
                    {workspace.assessment.assessedAt
                      ? ` (${fmtDate(workspace.assessment.assessedAt.slice(0, 10))})`
                      : ""}
                  </p>
                </div>
              </Panel>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {workspace.canEdit && editingAssessment ? (
                <Button
                  variant="navy"
                  disabled={saveM.isPending}
                  onClick={() => {
                    setSaveMsg(null);
                    setFieldErrors({});
                    const payload = buildAssessmentPayload();
                    if (!payload) return;
                    const check = validateAssessmentForSave(payload);
                    if (!check.ok) {
                      setSaveMsg(check.message);
                      const next: Partial<Record<keyof AssessmentSaveInput, string>> = {};
                      for (const key of check.missing) {
                        if (key.includes("eligibility")) next.eligibility = check.message;
                        if (key.includes("application")) next.applicationTarget = check.message;
                      }
                      if (
                        !check.missing.length &&
                        check.message.toLowerCase().includes("eligibility")
                      ) {
                        next.eligibility = check.message;
                      }
                      if (check.message.toLowerCase().includes("application target")) {
                        next.applicationTarget = check.message;
                      }
                      setFieldErrors(next);
                      return;
                    }
                    saveM.mutate({ ...payload, eligibility: check.eligibility });
                  }}
                >
                  {saveM.isPending ? "Saving…" : "Save Assessment"}
                </Button>
              ) : null}
              {workspace.canEdit && !editingAssessment ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingAssessment(true);
                    setSaveMsg(null);
                  }}
                >
                  Edit Assessment
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                disabled={!hasSavedAssessment}
                onClick={printAssessment}
              >
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasSavedAssessment}
                onClick={printAssessment}
              >
                Print Assessment
              </Button>
              {assessmentDirty ? (
                <p className="text-xs text-amber-700">You have unsaved assessment changes.</p>
              ) : null}
              {saveMsg ? (
                <p
                  className={cn(
                    "text-sm",
                    saveM.isError ||
                      saveMsg.toLowerCase().includes("missing") ||
                      saveMsg.toLowerCase().includes("overwrite") ||
                      saveMsg.toLowerCase().includes("before")
                      ? "text-danger"
                      : "text-muted-foreground",
                  )}
                >
                  {saveMsg}
                </p>
              ) : null}
            </div>

            <Panel
              title="University shortlist"
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
                  title="No shortlist items yet"
                  body="Add universities and programmes you are considering with this student."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {workspace.shortlist.map((item) => (
                    <div key={item.id} className="border-b border-border pb-3">
                      <p className="font-semibold text-navy">{item.universityName}</p>
                      <p className="text-sm text-muted-foreground">{item.programName}</p>
                      <p className="mt-2 text-xs text-navy">{item.suitabilityNote || "—"}</p>
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
                  value={workspace.assessment.educationGap || "—"}
                />
                <OverviewItem
                  label="Work experience"
                  value={workspace.assessment.workExperience || "—"}
                />
                <OverviewItem
                  label="Preferred level"
                  value={workspace.assessment.preferredLevel || s.studyLevel}
                />
                <OverviewItem
                  label="Language"
                  value={workspace.assessment.languageScore || s.englishTest}
                />
                <OverviewItem label="Funding" value={workspace.assessment.fundingSource || "—"} />
              </dl>
            </Panel>
          </TabsContent>

          <TabsContent value="documents">
            <Panel title="Documents">
              {!workspace.documents.length ? (
                <EmptyState
                  title="No documents uploaded yet"
                  body="Documents appear here after upload."
                />
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
                          {n.authorName} · {fmtDate(n.createdAt.slice(0, 10))}
                          {n.pinned ? " · Pinned" : ""}
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

      {hasSavedAssessment ? (
        <div
          id="counselling-assessment-print-host"
          className={cn(showPrintAssessment ? "mt-2" : "hidden")}
          aria-hidden={!showPrintAssessment}
        >
          <CounsellingAssessmentFormA4
            studentName={s.name}
            caseId={s.caseId}
            assessment={workspace.assessment}
          />
        </div>
      ) : null}

      <style>{`
      @media print {
        body * { visibility: hidden !important; }
        #counselling-assessment-print-host,
        #counselling-assessment-print-host * { visibility: visible !important; }
        .student-profile-no-print { display: none !important; }
        #counselling-assessment-print-host {
          display: block !important;
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
        }
      }
    `}</style>
    </>
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

function catalogOrKeep(
  selected: string,
  otherText: string,
  catalog: readonly string[],
): { ok: true; value: string } | { ok: false; error: string } {
  const value = selected.trim();
  if (!value) return { ok: true, value: "" };
  if ((catalog as readonly string[]).includes(value)) {
    if (value === "Other") return resolveCatalogOrOther("Other", otherText);
    return { ok: true, value };
  }
  // Preserve legacy free-text that is not in the catalog.
  return { ok: true, value };
}

function CatalogOrCustom({
  value,
  other,
  options,
  disabled,
  onValue,
  onOther,
  searchable = true,
}: {
  value: string;
  other: string;
  options: readonly string[];
  disabled?: boolean;
  onValue: (v: string) => void;
  onOther: (v: string) => void;
  searchable?: boolean;
}) {
  const inCatalog = (options as readonly string[]).includes(value);
  const selectValue = !value ? "" : inCatalog ? value : "Other";
  const showOther = selectValue === "Other";

  return (
    <div>
      {searchable ? (
        <SearchableSelect
          value={selectValue}
          options={options}
          disabled={Boolean(disabled)}
          placeholder="Select"
          onChange={(v) => {
            if (v === "Other") {
              onValue("Other");
            } else {
              onValue(v);
              onOther("");
            }
          }}
        />
      ) : (
        <select
          className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm"
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "Other") onValue("Other");
            else {
              onValue(v);
              onOther("");
            }
          }}
        >
          <option value="">Select</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {showOther ? (
        <Input
          className="mt-2"
          value={inCatalog && value === "Other" ? other : inCatalog ? other : value}
          placeholder="Enter value"
          disabled={disabled}
          onChange={(e) => {
            onOther(e.target.value);
            if (value !== "Other") onValue("Other");
          }}
        />
      ) : null}
    </div>
  );
}
