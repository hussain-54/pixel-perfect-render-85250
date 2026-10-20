/**
 * Data service layer. Portal reads go through authorized server functions.
 * Public marketing helpers remain unauthenticated.
 */
import * as db from "@/data/mock";
import { getAuthRequestHeaders } from "@/lib/auth";
import {
  portalGetActivity,
  portalGetAppointments,
  portalGetApplications,
  portalGetAuditLogs,
  portalGetConsultant,
  portalGetConsultants,
  portalGetCurrentStudent,
  portalUpdateOwnStudentContact,
  portalRequestAppointment,
  portalUpdateAppointmentStatus,
  portalGetDocuments,
  portalGetLeads,
  portalListLeadAssigneeOptions,
  portalAssignLead,
  portalUpdateLeadStatus,
  portalGetMonthlyStats,
  portalGetNotifications,
  portalMarkNotificationRead,
  portalGetStudent,
  portalGetStudents,
  portalSubmitConsultation,
} from "@/server/portal-data";
import {
  portalAddStudentNote,
  portalCreateStudentApplication,
  portalGetOfficerDashboard,
  portalGetStudentProfile,
  portalGetStudentsDirectory,
  portalRegisterStudent,
  portalReviewDocument,
  portalSaveShortlistItem,
  portalSaveStudentAssessment,
  portalSearchStudents,
} from "@/server/portal-officer";
import {
  portalChangeApplicationStage,
  portalCreatePipelineApplication,
  portalGetApplicationDetail,
  portalGetApplicationsPipeline,
} from "@/server/portal-applications";
import {
  portalFetchDocumentPreview,
  portalGetDocumentChecklist,
  portalGetDocumentInspection,
  portalGetDocumentQueue,
  portalIssueDocumentPreview,
  portalRequestDocument,
  portalReviewQueueDocument,
  portalUploadStudentDocument,
} from "@/server/portal-documents";
import {
  portalAcceptOffer,
  portalAdvanceCasI20,
  portalAdvanceVisa,
  portalCreateOfferRecord,
  portalDeclineOffer,
  portalExportOffersSummary,
  portalGetOfferDetail,
  portalGetOffersVisa,
  portalRecordDepositPaid,
  portalSetOfferConditionMet,
} from "@/server/portal-offers";
import {
  portalGetTaskOps,
  portalRunTaskAutomation,
  portalUpdateTaskStatus,
  portalUpsertTask,
} from "@/server/portal-tasks";
import { portalExportReports, portalGetReports } from "@/server/portal-reports";
import { portalExportActivityLog, portalGetActivityLog } from "@/server/portal-activity";
import {
  portalAssignCounsellor,
  portalClaimOwnStudentRecord,
  portalGetSignupFeeStatus,
  portalHandoverToAdmission,
  portalIntakeRegisterStudent,
  portalListAdmissionHandovers,
  portalRecordCounsellingAgreement,
  portalRecordSignupFee,
  portalUpdateAdmissionHandover,
  portalVerifySignupFee,
} from "@/server/portal-intake";
import type {
  AdmissionHandoverInput,
  AssignCounsellorInput,
  CounsellingAgreementInput,
  IntakeRegisterInput,
  SignupFeeRecordInput,
  VerifySignupFeeInput,
} from "@/types/intake";
import {
  portalClaimUniversityFeePayment,
  portalCreateUniversityFeeObligation,
  portalListUniversityFeeQueue,
  portalVerifyUniversityFeePayment,
} from "@/server/portal-finance";
import { portalGetStudentJourneyTimeline } from "@/server/portal-timeline";
import { portalGetAdminOpsOverview } from "@/server/portal-admin-ops";
import {
  portalCorrectHrAttendance,
  portalDecideHrLeave,
  portalGetHrDashboard,
  portalListHrAttendance,
  portalListHrEmployees,
  portalListHrLeave,
  portalRecordHrAttendance,
  portalSubmitHrLeave,
  portalUpsertHrEmployee,
} from "@/server/portal-hr";
import {
  portalArchiveMarketingCampaign,
  portalAttributeInquiryToCampaign,
  portalGetMarketingOverview,
  portalListAttributionHistory,
  portalUpsertMarketingCampaign,
} from "@/server/portal-marketing";
import {
  portalCreateOpsSalesOrder,
  portalCreatePurchaseOrder,
  portalGetOpsDashboard,
  portalReceivePurchaseLine,
  portalUpdatePurchaseStatus,
  portalUpsertOpsExpense,
  portalUpsertOpsInventoryItem,
  portalUpsertOpsSupplier,
} from "@/server/portal-operations";
import {
  portalCreateAccount,
  portalDeleteAccount,
  portalListAccountOptions,
  portalListAccounts,
  portalRemoveAccountAccess,
  portalResendPasswordReset,
  portalRevokeAccountSessions,
  portalSetConsultantDeskStatus,
  portalSetTemporaryPassword,
  portalUpdateAccountBusinessRole,
  type CreateAccountInput,
  type SetTemporaryPasswordInput,
  type UpdateAccountBusinessRoleInput,
} from "@/server/portal-accounts";
import {
  portalGetPermissionMatrix,
  portalUpdatePermissionMatrixCell,
  type UpdatePermissionMatrixInput,
} from "@/server/portal-permissions";
import {
  portalVerifyCurrentPassword,
  type VerifyCurrentPasswordInput,
} from "@/server/portal-password";
import type { HrAttendanceStatus, HrEmploymentStatus } from "@/lib/hr-rules";
import type { MarketingCampaignStatus } from "@/lib/marketing-rules";
import type { OpsExpenseStatus, OpsPurchaseStatus } from "@/lib/ops-rules";
import type { UniversityFeeKindDb, UniversityFeeStatusDb } from "@/types/database";
import type { StudentDirectoryFilters } from "@/types/portal-officer";
import type { AssessmentSaveInput, NewApplicationInput } from "@/types/student-profile";
import type {
  ApplicationPipelineFilters,
  ApplicationPipelineStage,
  ApplicationStageTarget,
  NewPipelineApplicationInput,
} from "@/types/applications-pipeline";
import type {
  DocumentQueueFilters,
  DocumentReviewAction,
  DocumentUploadInput,
  RequestDocumentInput,
} from "@/types/documents-queue";
import type {
  AdvanceCasI20Input,
  AdvanceVisaInput,
  NewOfferInput,
  OffersVisaFilters,
} from "@/types/offers-visa";
import type { TaskOpsFilters, UpdateTaskStatusInput, UpsertTaskInput } from "@/types/tasks-ops";
import type { ReportExportFormat, ReportsFilters } from "@/types/reports-ops";
import type { ModuleReportsFilters } from "@/types/module-reports";
import type { ActivityFilters } from "@/types/activity-ops";
import { portalExportModuleReports, portalGetModuleReports } from "@/server/portal-module-reports";
import {
  portalGetFrontDeskDashboard,
  portalListCounsellorDesks,
  portalListFrontDeskIntake,
  portalProvisionStudentPortalAccount,
} from "@/server/portal-front-desk";
import {
  portalDeleteProgram,
  portalDeleteUniversity,
  portalGetCatalogPrograms,
  portalGetCatalogUniversities,
  portalListCatalogProgramsAdmin,
  portalListCatalogUniversitiesAdmin,
  portalListPublishedPrograms,
  portalListPublishedUniversities,
  portalUpsertProgram,
  portalUpsertUniversity,
} from "@/server/portal-catalog";
import {
  portalListPublishedScholarships,
  portalListScholarshipsAdmin,
  portalSetScholarshipStatus,
  portalUpsertScholarship,
} from "@/server/portal-scholarships";
import type { ScholarshipListFilters, ScholarshipWriteInput } from "@/lib/scholarship-rules";
import type {
  CatalogListFilters,
  ProgramWriteInput,
  UniversityWriteInput,
} from "@/lib/catalog-rules";
import {
  portalCommitCatalogImport,
  portalExportCrmCsv,
  portalImportUniversitiesCsv,
  portalPreviewCatalogImport,
} from "@/server/portal-import-export";
import type {
  CatalogImportEntity,
  CrmExportEntity,
  DuplicatePolicy,
} from "@/lib/crm-export";
import {
  portalGetOrganizationSettings,
  portalUpdateOrganizationSettings,
} from "@/server/portal-settings";
import type { OrganizationSettingsInput } from "@/lib/admin-settings-rules";
import { portalGetConsultantLeaderboard } from "@/server/portal-leaderboard";
import type { LeaderboardFilters } from "@/server/portal-leaderboard";

async function withAuth<T>(fn: (opts: { headers?: HeadersInit }) => Promise<T>): Promise<T> {
  const headers = await getAuthRequestHeaders();
  return fn(headers ? { headers } : {});
}

export const getStages = () => db.STAGES;

export const getStudents = () => withAuth((opts) => portalGetStudents(opts));

export const getStudent = (id: string) =>
  withAuth((opts) => portalGetStudent({ ...opts, data: { id } }));

export const getCurrentStudent = () => withAuth((opts) => portalGetCurrentStudent(opts));

export const updateOwnStudentContact = (data: {
  phone?: string;
  whatsapp?: string;
  city?: string;
  dob?: string;
  destination?: string;
  program?: string;
  studyLevel?: string;
}) => withAuth((opts) => portalUpdateOwnStudentContact({ ...opts, data }));

export const getConsultants = () => withAuth((opts) => portalGetConsultants(opts));

export const getConsultant = (id: string) =>
  withAuth((opts) => portalGetConsultant({ ...opts, data: { id } }));

export const getAppointments = (studentId?: string) =>
  withAuth((opts) =>
    portalGetAppointments({
      ...opts,
      data: studentId ? { studentId } : {},
    }),
  );

export const requestAppointment = (data: {
  date: string;
  time: string;
  notes?: string;
  durationMinutes?: number;
}) => withAuth((opts) => portalRequestAppointment({ ...opts, data }));

export const updateAppointmentStatus = (data: { appointmentId: string; status: string }) =>
  withAuth((opts) => portalUpdateAppointmentStatus({ ...opts, data }));

export const getDocuments = (studentId?: string) =>
  withAuth((opts) =>
    portalGetDocuments({
      ...opts,
      data: studentId ? { studentId } : {},
    }),
  );

export const getApplications = (studentId?: string) =>
  withAuth((opts) =>
    portalGetApplications({
      ...opts,
      data: studentId ? { studentId } : {},
    }),
  );

export const getLeads = () => withAuth((opts) => portalGetLeads(opts));

export const listLeadAssigneeOptions = () =>
  withAuth((opts) => portalListLeadAssigneeOptions(opts));

export const assignLead = (data: { leadId: string; consultantId: string | null }) =>
  withAuth((opts) => portalAssignLead({ ...opts, data }));

export const updateLeadStatus = (data: { leadId: string; status: string }) =>
  withAuth((opts) => portalUpdateLeadStatus({ ...opts, data }));

/** Public universities — live catalog; labelled demo only in DEV when live unavailable. */
export const listPublishedUniversities = (filters?: CatalogListFilters) =>
  portalListPublishedUniversities({ data: filters ?? {} });

/** @deprecated Prefer listPublishedUniversities for source awareness. */
export const getUniversities = () =>
  listPublishedUniversities().then((payload) => payload.rows);

/** Public programs — live catalog; labelled demo only in DEV when live unavailable. */
export const listPublishedPrograms = (filters?: CatalogListFilters) =>
  portalListPublishedPrograms({ data: filters ?? {} });

/** Public scholarships — published live rows only (no demo fixture fallback). */
export const listPublishedScholarships = (filters?: ScholarshipListFilters) =>
  portalListPublishedScholarships({ data: filters ?? {} });

/** @deprecated Prefer listPublishedScholarships for source/unavailable awareness. */
export const getScholarships = () =>
  listPublishedScholarships().then((payload) => payload.rows);

/** Admin/staff admissions catalog — live universities when JWT plane is active. */
export const getCatalogUniversities = () =>
  withAuth((opts) => portalGetCatalogUniversities(opts));

/** Admin/staff admissions catalog — live programs when JWT plane is active. */
export const getCatalogPrograms = () => withAuth((opts) => portalGetCatalogPrograms(opts));

export const listCatalogUniversitiesAdmin = (filters?: CatalogListFilters) =>
  withAuth((opts) => portalListCatalogUniversitiesAdmin({ ...opts, data: filters ?? {} }));

export const listCatalogProgramsAdmin = (filters?: CatalogListFilters) =>
  withAuth((opts) => portalListCatalogProgramsAdmin({ ...opts, data: filters ?? {} }));

export const upsertUniversity = (data: UniversityWriteInput & { id?: string }) =>
  withAuth((opts) => portalUpsertUniversity({ ...opts, data }));

export const deleteUniversity = (id: string) =>
  withAuth((opts) => portalDeleteUniversity({ ...opts, data: { id } }));

export const upsertProgram = (data: ProgramWriteInput & { id?: string }) =>
  withAuth((opts) => portalUpsertProgram({ ...opts, data }));

export const deleteProgram = (id: string) =>
  withAuth((opts) => portalDeleteProgram({ ...opts, data: { id } }));

/** Admin/staff scholarships catalog — live when JWT plane is active. */
export const listScholarshipsAdmin = (filters?: ScholarshipListFilters) =>
  withAuth((opts) => portalListScholarshipsAdmin({ ...opts, data: filters ?? {} }));

export const upsertScholarship = (data: ScholarshipWriteInput & { id?: string }) =>
  withAuth((opts) => portalUpsertScholarship({ ...opts, data }));

export const setScholarshipStatus = (data: {
  id: string;
  status: "draft" | "published" | "archived";
}) => withAuth((opts) => portalSetScholarshipStatus({ ...opts, data }));

export const exportCrmCsv = (entity: CrmExportEntity) =>
  withAuth((opts) => portalExportCrmCsv({ ...opts, data: { entity } }));

export const previewCatalogImport = (data: { entity: CatalogImportEntity; csvText: string }) =>
  withAuth((opts) => portalPreviewCatalogImport({ ...opts, data }));

export const commitCatalogImport = (data: {
  entity: CatalogImportEntity;
  csvText: string;
  duplicatePolicy: DuplicatePolicy;
  confirmed: boolean;
}) => withAuth((opts) => portalCommitCatalogImport({ ...opts, data }));

/** @deprecated Prefer previewCatalogImport + commitCatalogImport (duplicates are skipped). */
export const importUniversitiesCsv = (csvText: string) =>
  withAuth((opts) => portalImportUniversitiesCsv({ ...opts, data: { csvText } }));

/** Admin organization settings — live singleton when JWT plane + migration are available. */
export const getOrganizationSettings = () =>
  withAuth((opts) => portalGetOrganizationSettings(opts));

export const updateOrganizationSettings = (data: OrganizationSettingsInput) =>
  withAuth((opts) => portalUpdateOrganizationSettings({ ...opts, data }));

/** Firm consultant leaderboard — live aggregates only (no demo score invention). */
export const getConsultantLeaderboard = (filters?: LeaderboardFilters) =>
  withAuth((opts) => portalGetConsultantLeaderboard({ ...opts, data: filters ?? {} }));

export const getNotifications = (audience: "student" | "staff" | "admin") =>
  withAuth((opts) => portalGetNotifications({ ...opts, data: { audience } }));

export const markNotificationRead = (id: string) =>
  withAuth((opts) => portalMarkNotificationRead({ ...opts, data: { id } }));

export const getActivity = (studentId: string) =>
  withAuth((opts) => portalGetActivity({ ...opts, data: { studentId } }));

export const getAuditLogs = () => withAuth((opts) => portalGetAuditLogs(opts));

export const getMonthlyStats = () => withAuth((opts) => portalGetMonthlyStats(opts));

/** Sync lookups for rendering names inside rows (non-sensitive labels). */
export const lookupStudent = (id: string) => db.students.find((s) => s.id === id);
export const lookupConsultant = (id: string | null) => db.consultants.find((c) => c.id === id);
export const stageIndex = (key: string) => db.STAGES.findIndex((s) => s.key === key);
export const stageLabel = (key: string) => db.STAGES.find((s) => s.key === key)?.label ?? key;

/** Public marketing mutation. Success only when persisted === true. */
export const submitConsultationRequest = (data: Record<string, string>) =>
  portalSubmitConsultation({ data }) as Promise<
    import("@/lib/consultation").ConsultationSubmitResult
  >;

/** Officer dashboard — metrics and lists scoped to the trusted session. */
export const getOfficerDashboard = () => withAuth((opts) => portalGetOfficerDashboard(opts));

export const getStudentsDirectory = (filters: StudentDirectoryFilters = {}) =>
  withAuth((opts) => portalGetStudentsDirectory({ ...opts, data: filters }));

export const searchAuthorizedStudents = (q: string) =>
  withAuth((opts) => portalSearchStudents({ ...opts, data: { q } }));

/** Dashboard review — routes through the shared queue review operation (demo + Supabase). */
export const reviewStudentDocument = (documentId: string, action: "Approved" | "Rejected") =>
  withAuth((opts) => portalReviewDocument({ ...opts, data: { documentId, action } }));

export const getStudentProfile = (id: string) =>
  withAuth((opts) => portalGetStudentProfile({ ...opts, data: { id } }));

export const saveStudentAssessment = (studentId: string, assessment: AssessmentSaveInput) =>
  withAuth((opts) => portalSaveStudentAssessment({ ...opts, data: { studentId, assessment } }));

export const addStudentNote = (studentId: string, body: string, pinned?: boolean) =>
  withAuth((opts) =>
    portalAddStudentNote({
      ...opts,
      data: pinned === undefined ? { studentId, body } : { studentId, body, pinned },
    }),
  );

export const createStudentApplication = (data: NewApplicationInput) =>
  withAuth((opts) => portalCreateStudentApplication({ ...opts, data }));

export const getApplicationsPipeline = (filters: ApplicationPipelineFilters = {}) =>
  withAuth((opts) => portalGetApplicationsPipeline({ ...opts, data: filters }));

export const getApplicationDetail = (id: string) =>
  withAuth((opts) => portalGetApplicationDetail({ ...opts, data: { id } }));

export const changeApplicationStage = (
  applicationId: string,
  toStage: ApplicationStageTarget,
  note?: string,
) =>
  withAuth((opts) =>
    portalChangeApplicationStage({
      ...opts,
      data: note === undefined ? { applicationId, toStage } : { applicationId, toStage, note },
    }),
  );

export const createPipelineApplication = (data: NewPipelineApplicationInput) =>
  withAuth((opts) => portalCreatePipelineApplication({ ...opts, data }));

export const getDocumentQueue = (filters: DocumentQueueFilters = {}) =>
  withAuth((opts) => portalGetDocumentQueue({ ...opts, data: filters }));

export const getDocumentInspection = (id: string) =>
  withAuth((opts) => portalGetDocumentInspection({ ...opts, data: { id } }));

export const getDocumentChecklist = (studentId: string) =>
  withAuth((opts) => portalGetDocumentChecklist({ ...opts, data: { studentId } }));

export const requestStudentDocument = (data: RequestDocumentInput) =>
  withAuth((opts) => portalRequestDocument({ ...opts, data }));

export const reviewQueueDocument = (
  documentId: string,
  action: DocumentReviewAction,
  note?: string,
) =>
  withAuth((opts) =>
    portalReviewQueueDocument({
      ...opts,
      data: note === undefined ? { documentId, action } : { documentId, action, note },
    }),
  );
export const uploadStudentDocument = (data: DocumentUploadInput) =>
  withAuth((opts) => portalUploadStudentDocument({ ...opts, data }));

export const issueDocumentPreview = (documentId: string, versionId?: string) =>
  withAuth((opts) =>
    portalIssueDocumentPreview({
      ...opts,
      data: versionId === undefined ? { documentId } : { documentId, versionId },
    }),
  );

export const fetchDocumentPreview = (token: string) =>
  withAuth((opts) => portalFetchDocumentPreview({ ...opts, data: { token } }));

export const saveShortlistItem = (data: {
  studentId: string;
  universityName: string;
  programName: string;
  country: string;
  suitabilityNote: string;
}) => withAuth((opts) => portalSaveShortlistItem({ ...opts, data }));

export const getOffersVisa = (filters: OffersVisaFilters = {}) =>
  withAuth((opts) => portalGetOffersVisa({ ...opts, data: filters }));

export const getOfferDetail = (id: string) =>
  withAuth((opts) => portalGetOfferDetail({ ...opts, data: { id } }));

export const createOfferRecord = (data: NewOfferInput) =>
  withAuth((opts) => portalCreateOfferRecord({ ...opts, data }));

export const setOfferConditionMet = (conditionId: string, met: boolean) =>
  withAuth((opts) => portalSetOfferConditionMet({ ...opts, data: { conditionId, met } }));

export const acceptOffer = (offerId: string) =>
  withAuth((opts) => portalAcceptOffer({ ...opts, data: { offerId } }));

export const declineOffer = (offerId: string, note?: string) =>
  withAuth((opts) =>
    portalDeclineOffer({
      ...opts,
      data: note === undefined ? { offerId } : { offerId, note },
    }),
  );

export const recordDepositPaid = (depositId: string, reference: string, paidAt?: string) =>
  withAuth((opts) =>
    portalRecordDepositPaid({
      ...opts,
      data: paidAt === undefined ? { depositId, reference } : { depositId, reference, paidAt },
    }),
  );

export const advanceCasI20 = (recordId: string, extras?: Omit<AdvanceCasI20Input, "recordId">) =>
  withAuth((opts) =>
    portalAdvanceCasI20({
      ...opts,
      data: { recordId, ...(extras ?? {}) },
    }),
  );

export const advanceVisaStage = (
  milestoneId: string,
  extras?: Omit<AdvanceVisaInput, "milestoneId">,
) =>
  withAuth((opts) =>
    portalAdvanceVisa({
      ...opts,
      data: { milestoneId, ...(extras ?? {}) },
    }),
  );

export const exportOffersSummary = () => withAuth((opts) => portalExportOffersSummary(opts));

export const getTaskOps = (filters: TaskOpsFilters = {}) =>
  withAuth((opts) => portalGetTaskOps({ ...opts, data: filters }));

export const upsertTask = (data: UpsertTaskInput) =>
  withAuth((opts) => portalUpsertTask({ ...opts, data }));

export const updateTaskStatus = (data: UpdateTaskStatusInput) =>
  withAuth((opts) => portalUpdateTaskStatus({ ...opts, data }));

export const runTaskAutomation = (secret?: string) =>
  withAuth((opts) =>
    portalRunTaskAutomation({
      ...opts,
      data: secret === undefined ? {} : { secret },
    }),
  );
export const registerStudent = (data: {
  fullName: string;
  email: string;
  phone: string;
  destination: string;
  program: string;
}) => withAuth((opts) => portalRegisterStudent({ ...opts, data }));

/** Milestone 1 intake registration (fee claim optional; never auto-verifies). */
export const intakeRegisterStudent = (data: IntakeRegisterInput) =>
  withAuth((opts) => portalIntakeRegisterStudent({ ...opts, data }));

export const getFrontDeskDashboard = () => withAuth((opts) => portalGetFrontDeskDashboard(opts));

export const listFrontDeskIntake = () => withAuth((opts) => portalListFrontDeskIntake(opts));
export const provisionStudentPortalAccount = (data: {
  studentId: string;
  temporaryPassword: string;
  confirmPassword: string;
}) => withAuth((opts) => portalProvisionStudentPortalAccount({ ...opts, data }));

export const listCounsellorDesks = () => withAuth((opts) => portalListCounsellorDesks(opts));

export const recordSignupFee = (data: SignupFeeRecordInput) =>
  withAuth((opts) => portalRecordSignupFee({ ...opts, data }));

export const verifySignupFee = (data: VerifySignupFeeInput) =>
  withAuth((opts) => portalVerifySignupFee({ ...opts, data }));

export const assignCounsellor = (data: AssignCounsellorInput) =>
  withAuth((opts) => portalAssignCounsellor({ ...opts, data }));

export const recordCounsellingAgreement = (data: CounsellingAgreementInput) =>
  withAuth((opts) => portalRecordCounsellingAgreement({ ...opts, data }));

export const handoverToAdmission = (data: AdmissionHandoverInput) =>
  withAuth((opts) => portalHandoverToAdmission({ ...opts, data }));

export const listAdmissionHandovers = (filters?: {
  status?: "submitted" | "accepted" | "returned";
}) => withAuth((opts) => portalListAdmissionHandovers({ ...opts, data: filters ?? {} }));

export const updateAdmissionHandover = (data: {
  handoverId: string;
  action: "accept" | "return";
  note?: string;
}) => withAuth((opts) => portalUpdateAdmissionHandover({ ...opts, data }));

export const getSignupFeeStatus = (studentId: string) =>
  withAuth((opts) => portalGetSignupFeeStatus({ ...opts, data: { studentId } }));

/** Link CRM student row to the signed-in Auth profile (email match only). */
export const claimOwnStudentRecord = () => withAuth((opts) => portalClaimOwnStudentRecord(opts));

export const listUniversityFeeQueue = (filters?: {
  status?: UniversityFeeStatusDb;
  studentId?: string;
}) => withAuth((opts) => portalListUniversityFeeQueue({ ...opts, data: filters ?? {} }));

export const createUniversityFeeObligation = (data: {
  studentId: string;
  amount: number;
  kind?: UniversityFeeKindDb;
  label?: string;
  currency?: string;
  dueDate?: string;
  applicationId?: string;
  offerId?: string;
}) => withAuth((opts) => portalCreateUniversityFeeObligation({ ...opts, data }));

export const claimUniversityFeePayment = (data: {
  obligationId: string;
  paymentMethod?: string;
  referenceReceipt?: string;
  evidenceNotes?: string;
}) => withAuth((opts) => portalClaimUniversityFeePayment({ ...opts, data }));

export const verifyUniversityFeePayment = (data: {
  obligationId: string;
  action: "verify" | "waive" | "reject";
  notes?: string;
}) => withAuth((opts) => portalVerifyUniversityFeePayment({ ...opts, data }));

/** Live chronological journey from persisted workflow records (own student or visible staff). */
export const getStudentJourneyTimeline = (studentId?: string) =>
  withAuth((opts) =>
    portalGetStudentJourneyTimeline({
      ...opts,
      data: studentId ? { studentId } : {},
    }),
  );

/** Admin / manager operations overview aggregates (authorized + RLS). */
export const getAdminOpsOverview = () => withAuth((opts) => portalGetAdminOpsOverview(opts));

/** Admin employee/account management (service-role Auth Admin API, server-only). */
export const listPortalAccounts = () => withAuth((opts) => portalListAccounts(opts));

export const listPortalAccountOptions = () => withAuth((opts) => portalListAccountOptions(opts));

export const createPortalAccount = (data: CreateAccountInput) =>
  withAuth((opts) => portalCreateAccount({ ...opts, data }));

export const updatePortalAccountBusinessRole = (data: UpdateAccountBusinessRoleInput) =>
  withAuth((opts) => portalUpdateAccountBusinessRole({ ...opts, data }));

export const setPortalTemporaryPassword = (data: SetTemporaryPasswordInput) =>
  withAuth((opts) => portalSetTemporaryPassword({ ...opts, data }));

export const resendPortalPasswordReset = (data: { userId: string }) =>
  withAuth((opts) => portalResendPasswordReset({ ...opts, data }));

export const setPortalConsultantDeskStatus = (data: {
  userId: string;
  status: "active" | "inactive";
}) => withAuth((opts) => portalSetConsultantDeskStatus({ ...opts, data }));

export const revokePortalAccountSessions = (data: { userId: string }) =>
  withAuth((opts) => portalRevokeAccountSessions({ ...opts, data }));

export const removePortalAccountAccess = (data: { userId: string }) =>
  withAuth((opts) => portalRemoveAccountAccess({ ...opts, data }));

export const deletePortalAccount = (data: { userId: string; confirmEmail: string }) =>
  withAuth((opts) => portalDeleteAccount({ ...opts, data }));

/** Admin RBAC permission matrix (persisted business_module_permissions). */
export const getPermissionMatrix = () => withAuth((opts) => portalGetPermissionMatrix(opts));

export const updatePermissionMatrixCell = (data: UpdatePermissionMatrixInput) =>
  withAuth((opts) => portalUpdatePermissionMatrixCell({ ...opts, data }));

export const verifyPortalCurrentPassword = (data: VerifyCurrentPasswordInput) =>
  withAuth((opts) => portalVerifyCurrentPassword({ ...opts, data }));

export const listHrEmployees = () => withAuth((opts) => portalListHrEmployees(opts));

export const listHrAttendance = (filters?: { from?: string; to?: string; employeeId?: string }) =>
  withAuth((opts) => portalListHrAttendance({ ...opts, data: filters ?? {} }));

export const getHrDashboard = () => withAuth((opts) => portalGetHrDashboard(opts));

export const upsertHrEmployee = (data: {
  id?: string;
  employeeCode: string;
  fullName: string;
  department?: string;
  jobTitle?: string;
  status?: HrEmploymentStatus;
  hiredOn?: string;
  profileId?: string | null;
  reportingManagerId?: string | null;
}) => withAuth((opts) => portalUpsertHrEmployee({ ...opts, data }));

export const recordHrAttendance = (data: {
  employeeId: string;
  workDate: string;
  status: HrAttendanceStatus;
  notes?: string;
}) => withAuth((opts) => portalRecordHrAttendance({ ...opts, data }));

export const correctHrAttendance = (data: {
  attendanceId: string;
  status: HrAttendanceStatus;
  reason: string;
}) => withAuth((opts) => portalCorrectHrAttendance({ ...opts, data }));

export const submitHrLeave = (data: {
  employeeId: string;
  leaveType?: "annual" | "sick" | "unpaid" | "other";
  startDate: string;
  endDate: string;
  reason: string;
}) => withAuth((opts) => portalSubmitHrLeave({ ...opts, data }));

export const decideHrLeave = (data: {
  leaveId: string;
  action: "approve" | "reject" | "cancel";
  note?: string;
}) => withAuth((opts) => portalDecideHrLeave({ ...opts, data }));

export const listHrLeave = (filters?: { status?: string; employeeId?: string }) =>
  withAuth((opts) => portalListHrLeave({ ...opts, data: filters ?? {} }));

export const getMarketingOverview = (filters?: { includeArchived?: boolean }) =>
  withAuth((opts) => portalGetMarketingOverview({ ...opts, data: filters ?? {} }));

export const upsertMarketingCampaign = (data: {
  id?: string;
  name: string;
  channel?: string;
  status?: MarketingCampaignStatus;
  startsOn?: string;
  endsOn?: string;
  budgetNote?: string;
}) => withAuth((opts) => portalUpsertMarketingCampaign({ ...opts, data }));

export const archiveMarketingCampaign = (data: { campaignId: string; archive: boolean }) =>
  withAuth((opts) => portalArchiveMarketingCampaign({ ...opts, data }));

export const attributeInquiryToCampaign = (data: {
  consultationRequestId: string;
  campaignId: string | null;
  attributionSource?: string;
}) => withAuth((opts) => portalAttributeInquiryToCampaign({ ...opts, data }));

export const listAttributionHistory = (consultationRequestId: string) =>
  withAuth((opts) => portalListAttributionHistory({ ...opts, data: { consultationRequestId } }));

export const getOpsDashboard = () => withAuth((opts) => portalGetOpsDashboard(opts));

export const upsertOpsSupplier = (data: {
  id?: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status?: "active" | "inactive";
  notes?: string;
}) => withAuth((opts) => portalUpsertOpsSupplier({ ...opts, data }));

export const upsertOpsInventoryItem = (data: {
  id?: string;
  sku: string;
  name: string;
  unit?: string;
}) => withAuth((opts) => portalUpsertOpsInventoryItem({ ...opts, data }));

export const createPurchaseOrder = (data: {
  supplierId: string;
  currency?: string;
  notes?: string;
  lines: Array<{ inventoryItemId: string; quantityOrdered: number; unitCost: number }>;
}) => withAuth((opts) => portalCreatePurchaseOrder({ ...opts, data }));

export const updatePurchaseStatus = (data: {
  purchaseOrderId: string;
  status: OpsPurchaseStatus;
}) => withAuth((opts) => portalUpdatePurchaseStatus({ ...opts, data }));

export const receivePurchaseLine = (data: {
  purchaseLineId: string;
  quantity: number;
  notes?: string;
}) => withAuth((opts) => portalReceivePurchaseLine({ ...opts, data }));

export const createOpsSalesOrder = (data: {
  customerName: string;
  totalAmount: number;
  currency?: string;
  notes?: string;
}) => withAuth((opts) => portalCreateOpsSalesOrder({ ...opts, data }));

export const upsertOpsExpense = (data: {
  id?: string;
  category: string;
  description: string;
  amount: number;
  currency?: string;
  status?: OpsExpenseStatus;
  incurredOn?: string;
}) => withAuth((opts) => portalUpsertOpsExpense({ ...opts, data }));

/** Typed Supabase entity helpers (RLS-backed; use from authorized server code). */
export * as dbApi from "@/services/db";

export const getOfficerReports = (filters: ReportsFilters = {}) =>
  withAuth((opts) => portalGetReports({ ...opts, data: filters }));

export const exportOfficerReports = (data: ReportsFilters & { format: ReportExportFormat }) =>
  withAuth((opts) => portalExportReports({ ...opts, data }));

export const getModuleReports = (filters: ModuleReportsFilters = {}) =>
  withAuth((opts) => portalGetModuleReports({ ...opts, data: filters }));

export const exportModuleReports = (data: ModuleReportsFilters & { format: "csv" | "excel" }) =>
  withAuth((opts) => portalExportModuleReports({ ...opts, data }));

export const getActivityLog = (filters: ActivityFilters = {}) =>
  withAuth((opts) => portalGetActivityLog({ ...opts, data: filters }));

export const exportActivityLog = (filters: ActivityFilters = {}) =>
  withAuth((opts) => portalExportActivityLog({ ...opts, data: filters }));
