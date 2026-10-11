/** Map Supabase AO rows to existing UI types (Title Case statuses, etc.). */
import type {
  Application,
  ApplicationStatus,
  DocumentStatus,
  Student,
  StageKey,
  StudentDocument,
} from "@/types";
import type {
  ApplicationRow,
  ApplicationStage,
  DocumentStatusDb,
  JourneyStage,
  ProfileRow,
  StudentDocumentRow,
  StudentRow,
} from "@/types/database";

const APP_STAGE_TO_UI: Record<ApplicationStage, ApplicationStatus> = {
  docs_pending: "Docs Pending",
  under_review: "Under Review",
  ready_to_submit: "Ready to Submit",
  submitted: "Submitted",
  offer_received: "Offer Received",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  draft: "Docs Pending",
};

const DOC_STATUS_TO_UI: Record<DocumentStatusDb, DocumentStatus> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  needs_correction: "Needs Correction",
};

export function journeyToStageKey(stage: JourneyStage): StageKey {
  return stage as StageKey;
}

export function mapStudentRow(row: StudentRow): Student {
  return {
    id: row.id,
    caseId: row.case_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? "",
    city: row.city ?? "",
    dob: row.dob ?? "",
    destination: row.destination ?? "",
    program: row.program ?? "",
    studyLevel: row.study_level ?? "",
    stage: journeyToStageKey(row.journey_stage),
    consultantId: row.assigned_consultant_id ?? "",
    lastActivity: row.last_activity_at ?? row.updated_at,
    qualification: "",
    institution: "",
    grade: "",
    englishTest: "",
    archived: Boolean(row.archived_at),
  };
}

export function mapApplicationRow(row: ApplicationRow): Application {
  return {
    id: row.id,
    studentId: row.student_id,
    university: row.university_name,
    country: row.country ?? "",
    program: row.program_name,
    intake: row.intake,
    appliedOn: row.submitted_at?.slice(0, 10) ?? row.created_at.slice(0, 10),
    deadline: row.deadline ?? "",
    status: APP_STAGE_TO_UI[row.stage] ?? "Docs Pending",
    officerId: row.owned_by_consultant_id ?? "",
  };
}

export function mapDocumentRow(row: StudentDocumentRow): StudentDocument {
  const doc = {
    id: row.id,
    studentId: row.student_id,
    name: row.label,
    category: row.doc_type,
    uploaded: row.updated_at.slice(0, 10),
    status: (DOC_STATUS_TO_UI[row.status] ?? "Pending Review") as DocumentStatus,
  } satisfies Pick<
    StudentDocument,
    "id" | "studentId" | "name" | "category" | "uploaded" | "status"
  >;
  const out: StudentDocument = { ...doc };
  if (row.awaiting_upload) out.awaitingUpload = true;
  if (row.current_version > 0) out.version = row.current_version;
  if (row.linked_application_id) out.linkedApplicationId = row.linked_application_id;
  if (row.expires_on) out.expiresOn = row.expires_on;
  return out;
}

/** DB application stage -> UI status (exported for stage-history mapping). */
export function stageToUi(stage: ApplicationStage): ApplicationStatus {
  return APP_STAGE_TO_UI[stage] ?? "Docs Pending";
}

export function profileGreeting(profile: ProfileRow | null, email: string): string {
  const name = profile?.full_name?.trim();
  if (name) return name.split(/\s+/)[0] ?? name;
  return email.split("@")[0] ?? "Officer";
}

export function uiStatusToAppStage(status: ApplicationStatus): ApplicationStage {
  const entry = (Object.entries(APP_STAGE_TO_UI) as [ApplicationStage, ApplicationStatus][]).find(
    ([, ui]) => ui === status,
  );
  return entry?.[0] ?? "docs_pending";
}
