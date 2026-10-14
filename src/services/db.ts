/**
 * Typed Supabase data-access helpers for the Admission Officer Portal.
 * Uses the publishable/anon client only — never a service-role key.
 * Privileged mutations (role assignment, document review) rely on RLS + RPC.
 * Call these from server functions after TrustedSession authorization.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentRow,
  ApplicationRow,
  ApplicationStage,
  AppRoleDb,
  AuditEventRow,
  ConsultantRow,
  Database,
  DocumentReviewAction,
  DocumentReviewRow,
  DocumentVersionRow,
  Json,
  OfferConditionRow,
  OfferRow,
  ProfileRow,
  StudentDocumentRow,
  StudentRow,
  TablesInsert,
  TablesUpdate,
  TaskRow,
} from "@/types/database";
import { STUDENT_DOCUMENTS_BUCKET, studentDocumentStoragePath } from "@/types/database";

export type TypedSupabase = SupabaseClient<Database>;

function throwOnError<T>(error: { message: string } | null, data: T | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Expected data from Supabase query.");
  return data;
}

/** Profiles */
export async function getProfileById(
  client: TypedSupabase,
  id: string,
): Promise<ProfileRow | null> {
  const { data, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateOwnProfile(
  client: TypedSupabase,
  id: string,
  patch: Pick<TablesUpdate<"profiles">, "full_name" | "phone">,
): Promise<ProfileRow> {
  const { data, error } = await client
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  return throwOnError(error, data);
}

/** Admin-only role assignment via security-definer RPC (not direct profiles.role update). */
export async function adminSetUserRole(
  client: TypedSupabase,
  targetUserId: string,
  newRole: AppRoleDb,
): Promise<ProfileRow> {
  const { data, error } = await client.rpc("admin_set_user_role", {
    target_user_id: targetUserId,
    new_role: newRole,
  });
  return throwOnError(error, data);
}

/** Consultants */
export async function listConsultants(client: TypedSupabase): Promise<ConsultantRow[]> {
  const { data, error } = await client.from("consultants").select("*").order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConsultantById(
  client: TypedSupabase,
  id: string,
): Promise<ConsultantRow | null> {
  const { data, error } = await client.from("consultants").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Students */
export async function listStudents(client: TypedSupabase): Promise<StudentRow[]> {
  const { data, error } = await client
    .from("students")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudentById(
  client: TypedSupabase,
  id: string,
): Promise<StudentRow | null> {
  const { data, error } = await client.from("students").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getStudentByProfileId(
  client: TypedSupabase,
  profileId: string,
): Promise<StudentRow | null> {
  const { data, error } = await client
    .from("students")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Own-student contact patch. Caller must resolve studentId from profile_id = auth user.
 * Relies on students_update_self_contact + enforce_student_staff_fields (JWT, no service role).
 */
export async function updateOwnStudentContact(
  client: TypedSupabase,
  studentId: string,
  profileId: string,
  patch: Pick<
    TablesUpdate<"students">,
    "phone" | "whatsapp" | "city" | "dob" | "destination" | "program" | "study_level"
  >,
): Promise<StudentRow | null> {
  const { data, error } = await client
    .from("students")
    .update(patch)
    .eq("id", studentId)
    .eq("profile_id", profileId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function assignConsultant(
  client: TypedSupabase,
  studentId: string,
  consultantId: string | null,
): Promise<StudentRow> {
  const { data, error } = await client
    .from("students")
    .update({ assigned_consultant_id: consultantId })
    .eq("id", studentId)
    .select("*")
    .single();
  const row = throwOnError(error, data);
  await writeAudit(client, {
    action: "student.assign_consultant",
    entity_type: "students",
    entity_id: studentId,
    student_id: studentId,
    metadata: { consultantId },
  });
  return row;
}

/** Academic profile + assessments */
export async function getAcademicProfile(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("student_academic_profiles")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertAcademicProfile(
  client: TypedSupabase,
  row: TablesInsert<"student_academic_profiles">,
) {
  const { data, error } = await client
    .from("student_academic_profiles")
    .upsert(row)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function listAssessments(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("student_assessments")
    .select("*")
    .eq("student_id", studentId)
    .order("assessed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAssessment(
  client: TypedSupabase,
  row: TablesInsert<"student_assessments">,
) {
  const { data, error } = await client.from("student_assessments").insert(row).select("*").single();
  return throwOnError(error, data);
}

/** Applications */
export async function listApplications(
  client: TypedSupabase,
  studentId?: string,
): Promise<ApplicationRow[]> {
  let q = client.from("applications").select("*").order("updated_at", { ascending: false });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getApplicationById(
  client: TypedSupabase,
  id: string,
): Promise<ApplicationRow | null> {
  const { data, error } = await client.from("applications").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createApplication(
  client: TypedSupabase,
  row: TablesInsert<"applications">,
): Promise<ApplicationRow> {
  const { data, error } = await client.from("applications").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function updateApplicationStage(
  client: TypedSupabase,
  applicationId: string,
  stage: ApplicationStage,
): Promise<ApplicationRow> {
  const { data, error } = await client
    .from("applications")
    .update({ stage })
    .eq("id", applicationId)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function listApplicationStageHistory(client: TypedSupabase, applicationId: string) {
  const { data, error } = await client
    .from("application_stage_history")
    .select("*")
    .eq("application_id", applicationId)
    .order("changed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Documents */
export async function listStudentDocuments(
  client: TypedSupabase,
  studentId: string,
): Promise<StudentDocumentRow[]> {
  const { data, error } = await client
    .from("student_documents")
    .select("*")
    .eq("student_id", studentId)
    .order("label");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getStudentDocumentById(
  client: TypedSupabase,
  id: string,
): Promise<StudentDocumentRow | null> {
  const { data, error } = await client
    .from("student_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listDocumentReviews(
  client: TypedSupabase,
  documentId: string,
): Promise<DocumentReviewRow[]> {
  const { data, error } = await client
    .from("document_reviews")
    .select("*")
    .eq("document_id", documentId)
    .order("reviewed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function ensureStudentDocument(
  client: TypedSupabase,
  row: TablesInsert<"student_documents">,
): Promise<StudentDocumentRow> {
  const { data, error } = await client
    .from("student_documents")
    .upsert(row, { onConflict: "student_id,doc_type" })
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function listDocumentVersions(
  client: TypedSupabase,
  documentId: string,
): Promise<DocumentVersionRow[]> {
  const { data, error } = await client
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function registerDocumentVersion(
  client: TypedSupabase,
  input: {
    studentId: string;
    documentId: string;
    versionNumber: number;
    fileName: string;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
    uploadedBy?: string | null;
  },
): Promise<DocumentVersionRow> {
  const storage_path = studentDocumentStoragePath(
    input.studentId,
    input.documentId,
    input.versionNumber,
    input.fileName,
  );
  const { data, error } = await client
    .from("document_versions")
    .insert({
      document_id: input.documentId,
      version_number: input.versionNumber,
      storage_bucket: STUDENT_DOCUMENTS_BUCKET,
      storage_path,
      file_name: input.fileName,
      mime_type: input.mimeType ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      uploaded_by: input.uploadedBy ?? null,
    })
    .select("*")
    .single();
  const version = throwOnError(error, data);
  await client
    .from("student_documents")
    .update({ current_version: input.versionNumber, status: "pending_review" })
    .eq("id", input.documentId);
  return version;
}

export async function createDocumentReview(
  client: TypedSupabase,
  input: {
    documentId: string;
    versionId?: string | null;
    reviewerId?: string | null;
    action: DocumentReviewAction;
    comments?: string | null;
  },
) {
  const { data, error } = await client
    .from("document_reviews")
    .insert({
      document_id: input.documentId,
      version_id: input.versionId ?? null,
      reviewer_id: input.reviewerId ?? null,
      action: input.action,
      comments: input.comments ?? null,
    })
    .select("*")
    .single();
  return throwOnError(error, data);
}

/** Offers / deposits / CAS-I20 / visa */
export async function listOffers(client: TypedSupabase, studentId: string): Promise<OfferRow[]> {
  const { data, error } = await client
    .from("offers")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOfferById(client: TypedSupabase, id: string): Promise<OfferRow | null> {
  const { data, error } = await client.from("offers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createOffer(
  client: TypedSupabase,
  row: TablesInsert<"offers">,
): Promise<OfferRow> {
  const { data, error } = await client.from("offers").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function listOfferConditions(client: TypedSupabase, offerId: string) {
  const { data, error } = await client
    .from("offer_conditions")
    .select("*")
    .eq("offer_id", offerId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOfferConditionById(
  client: TypedSupabase,
  id: string,
): Promise<OfferConditionRow | null> {
  const { data, error } = await client
    .from("offer_conditions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** offer_conditions.met + met_at are present in the foundation schema — safe to update directly. */
export async function markOfferConditionMet(
  client: TypedSupabase,
  conditionId: string,
  met: boolean,
): Promise<OfferConditionRow> {
  const { data, error } = await client
    .from("offer_conditions")
    .update({ met, met_at: met ? new Date().toISOString() : null })
    .eq("id", conditionId)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function createOfferCondition(
  client: TypedSupabase,
  row: TablesInsert<"offer_conditions">,
) {
  const { data, error } = await client.from("offer_conditions").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function listDeposits(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("deposits")
    .select("*")
    .eq("student_id", studentId)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCasI20Records(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("cas_i20_records")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listVisaMilestones(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("visa_milestones")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Tasks */
export async function listTasks(
  client: TypedSupabase,
  filters?: { studentId?: string; assigneeId?: string },
): Promise<TaskRow[]> {
  let q = client.from("tasks").select("*").order("due_at", { ascending: true });
  if (filters?.studentId) q = q.eq("student_id", filters.studentId);
  if (filters?.assigneeId) q = q.eq("assignee_id", filters.assigneeId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTask(
  client: TypedSupabase,
  row: TablesInsert<"tasks">,
): Promise<TaskRow> {
  const { data, error } = await client.from("tasks").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function updateTask(
  client: TypedSupabase,
  id: string,
  patch: TablesUpdate<"tasks">,
): Promise<TaskRow> {
  const { data, error } = await client
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  return throwOnError(error, data);
}

/** Internal notes (staff RLS) */
export async function listInternalNotes(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("internal_notes")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createInternalNote(
  client: TypedSupabase,
  row: TablesInsert<"internal_notes">,
) {
  const { data, error } = await client.from("internal_notes").insert(row).select("*").single();
  return throwOnError(error, data);
}

/** Consultation / leads — JWT user client; RLS consultation_select_staff / consultation_update_staff. */
export async function listConsultationRequests(client: TypedSupabase, limit = 100) {
  const { data, error } = await client
    .from("consultation_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConsultationRequestById(client: TypedSupabase, id: string) {
  const { data, error } = await client
    .from("consultation_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateConsultationRequest(
  client: TypedSupabase,
  id: string,
  patch: {
    status?: string;
    assigned_consultant_id?: string | null;
  },
) {
  const { data, error } = await client
    .from("consultation_requests")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Notifications — JWT user client only; RLS notifications_own / notifications_update_own. */
export async function listNotifications(client: TypedSupabase, userId: string, limit = 100) {
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Mark own notification read. Always scopes by trusted userId (never client body).
 * Idempotent when already read. Missing/unauthorized → null (caller maps to 404).
 */
export async function markNotificationRead(client: TypedSupabase, id: string, userId: string) {
  const { data: existing, error: loadErr } = await client
    .from("notifications")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) return null;
  if (existing.read_at) return existing;

  const { data, error } = await client
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Appointments */
export async function listAppointments(client: TypedSupabase, studentId?: string) {
  let q = client.from("appointments").select("*").order("scheduled_at", { ascending: true });
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAppointmentById(
  client: TypedSupabase,
  id: string,
): Promise<AppointmentRow | null> {
  const { data, error } = await client.from("appointments").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Staff appointment status update. Caller must authorize via assertStudentVisibleDb.
 * Relies on appointments_access + can_access_student (JWT, no service role).
 */
export async function updateAppointmentStatus(
  client: TypedSupabase,
  id: string,
  patch: Pick<TablesUpdate<"appointments">, "status" | "consultant_id">,
): Promise<AppointmentRow | null> {
  const { data, error } = await client
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Student-originated appointment request.
 * Caller must set student_id / created_by from session ownership — never client IDs.
 * Relies on appointments_access + can_access_student (JWT, no service role).
 */
export async function createAppointmentRequest(
  client: TypedSupabase,
  row: Pick<
    TablesInsert<"appointments">,
    | "student_id"
    | "consultant_id"
    | "status"
    | "scheduled_at"
    | "duration_minutes"
    | "notes"
    | "created_by"
  >,
): Promise<AppointmentRow> {
  const { data, error } = await client.from("appointments").insert(row).select("*").single();
  return throwOnError(error, data);
}

/** Directory helpers for Admission Officer cutover (no silent mock fallback). */
export async function listStudentsDirectory(
  client: TypedSupabase,
  filters?: {
    consultantId?: string | null;
    includeArchived?: boolean;
    journeyStage?: string;
    search?: string;
  },
): Promise<StudentRow[]> {
  let q = client.from("students").select("*").order("updated_at", { ascending: false });
  if (!filters?.includeArchived) q = q.is("archived_at", null);
  if (filters?.consultantId) q = q.eq("assigned_consultant_id", filters.consultantId);
  if (filters?.journeyStage)
    q = q.eq("journey_stage", filters.journeyStage as StudentRow["journey_stage"]);
  if (filters?.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    q = q.or(`full_name.ilike.${term},email.ilike.${term},case_id.ilike.${term}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Officer / non-intake inserts. Front Desk intake uses RPC `intake_register_student` instead. */
export async function createStudentRecord(
  client: TypedSupabase,
  row: TablesInsert<"students">,
): Promise<StudentRow> {
  const { data, error } = await client.from("students").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function archiveStudent(
  client: TypedSupabase,
  studentId: string,
  archived: boolean,
): Promise<StudentRow> {
  const { data, error } = await client
    .from("students")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", studentId)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function updateOfferStatus(
  client: TypedSupabase,
  offerId: string,
  status: OfferRow["status"],
): Promise<OfferRow> {
  const { data, error } = await client
    .from("offers")
    .update({ status })
    .eq("id", offerId)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function createDeposit(client: TypedSupabase, row: TablesInsert<"deposits">) {
  const { data, error } = await client.from("deposits").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function updateDepositStatus(
  client: TypedSupabase,
  depositId: string,
  status: NonNullable<TablesUpdate<"deposits">["status"]>,
  paidAt?: string | null,
) {
  const patch: TablesUpdate<"deposits"> = { status };
  if (paidAt !== undefined) patch.paid_at = paidAt;
  const { data, error } = await client
    .from("deposits")
    .update(patch)
    .eq("id", depositId)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function createCasI20Record(
  client: TypedSupabase,
  row: TablesInsert<"cas_i20_records">,
) {
  const { data, error } = await client.from("cas_i20_records").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function updateCasI20Status(
  client: TypedSupabase,
  id: string,
  status: NonNullable<TablesUpdate<"cas_i20_records">["status"]>,
  extra?: Pick<TablesUpdate<"cas_i20_records">, "reference_number" | "issued_at" | "expires_at">,
) {
  const { data, error } = await client
    .from("cas_i20_records")
    .update({ status, ...extra })
    .eq("id", id)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function createVisaMilestone(
  client: TypedSupabase,
  row: TablesInsert<"visa_milestones">,
) {
  const { data, error } = await client.from("visa_milestones").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function updateVisaMilestone(
  client: TypedSupabase,
  id: string,
  patch: TablesUpdate<"visa_milestones">,
) {
  const { data, error } = await client
    .from("visa_milestones")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  return throwOnError(error, data);
}

export async function listDocumentChecklistTemplates(client: TypedSupabase, country?: string) {
  let q = client.from("document_checklist_templates").select("*").order("sort_order");
  if (country) q = q.eq("country", country);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listShortlistItems(client: TypedSupabase, studentId: string) {
  const { data, error } = await client
    .from("shortlist_items")
    .select("*")
    .eq("student_id", studentId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertShortlistItem(
  client: TypedSupabase,
  row: TablesInsert<"shortlist_items">,
) {
  const { data, error } = await client.from("shortlist_items").insert(row).select("*").single();
  return throwOnError(error, data);
}

export async function officerDashboardCounts(client: TypedSupabase, consultantId?: string | null) {
  const students = await listStudentsDirectory(client, consultantId ? { consultantId } : {});
  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) {
    return {
      students: 0,
      applicationsInProgress: 0,
      documentsAwaitingReview: 0,
      openTasks: 0,
    };
  }
  const apps = await client
    .from("applications")
    .select("*", { count: "exact", head: true })
    .in("student_id", studentIds)
    .not("stage", "in", "(rejected,withdrawn)");
  if (apps.error) throw new Error(apps.error.message);

  const docs = await client
    .from("student_documents")
    .select("*", { count: "exact", head: true })
    .in("student_id", studentIds)
    .eq("status", "pending_review");
  if (docs.error) throw new Error(docs.error.message);

  const tasks = await client
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .in("status", ["open", "in_progress"])
    .in("student_id", studentIds);
  if (tasks.error) throw new Error(tasks.error.message);

  return {
    students: students.length,
    applicationsInProgress: apps.count ?? 0,
    documentsAwaitingReview: docs.count ?? 0,
    openTasks: tasks.count ?? 0,
  };
}

/** Audit (append-only) */
export async function writeAudit(
  client: TypedSupabase,
  input: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    student_id?: string | null;
    metadata?: Json;
  },
): Promise<AuditEventRow> {
  const { data, error } = await client.rpc("write_audit_event", {
    p_action: input.action,
    p_entity_type: input.entity_type,
    p_entity_id: input.entity_id ?? null,
    p_student_id: input.student_id ?? null,
    p_metadata: input.metadata ?? {},
  });
  return throwOnError(error, data);
}

export async function listAuditEvents(
  client: TypedSupabase,
  studentId?: string,
): Promise<AuditEventRow[]> {
  let q = client
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (studentId) q = q.eq("student_id", studentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export { STUDENT_DOCUMENTS_BUCKET, studentDocumentStoragePath };
