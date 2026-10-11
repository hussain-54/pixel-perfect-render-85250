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
  portalGetDocuments,
  portalGetLeads,
  portalGetMonthlyStats,
  portalGetNotifications,
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
import {
  portalExportReports,
  portalGetReports,
} from "@/server/portal-reports";
import {
  portalExportActivityLog,
  portalGetActivityLog,
} from "@/server/portal-activity";
import type { StudentDirectoryFilters } from "@/types/portal-officer";
import type { AssessmentSaveInput, NewApplicationInput } from "@/types/student-profile";
import type {
  ApplicationPipelineFilters,
  ApplicationPipelineStage,
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
import type {
  TaskOpsFilters,
  UpdateTaskStatusInput,
  UpsertTaskInput,
} from "@/types/tasks-ops";
import type { ReportExportFormat, ReportsFilters } from "@/types/reports-ops";
import type { ActivityFilters } from "@/types/activity-ops";

async function withAuth<T>(fn: (opts: { headers?: HeadersInit }) => Promise<T>): Promise<T> {
  const headers = await getAuthRequestHeaders();
  return fn(headers ? { headers } : {});
}

export const getStages = () => db.STAGES;

export const getStudents = () => withAuth((opts) => portalGetStudents(opts));

export const getStudent = (id: string) =>
  withAuth((opts) => portalGetStudent({ ...opts, data: { id } }));

export const getCurrentStudent = () => withAuth((opts) => portalGetCurrentStudent(opts));

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

/** Public catalog — safe without portal auth. */
export const getUniversities = () => Promise.resolve(db.universities);

/** Public catalog — safe without portal auth. */
export const getScholarships = () => Promise.resolve(db.scholarships);

export const getNotifications = (audience: "student" | "staff" | "admin") =>
  withAuth((opts) => portalGetNotifications({ ...opts, data: { audience } }));

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
  toStage: ApplicationPipelineStage,
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
      data:
        paidAt === undefined
          ? { depositId, reference }
          : { depositId, reference, paidAt },
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

export const exportOffersSummary = () =>
  withAuth((opts) => portalExportOffersSummary(opts));

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

/** Typed Supabase entity helpers (RLS-backed; use from authorized server code). */
export * as dbApi from "@/services/db";

export const getOfficerReports = (filters: ReportsFilters = {}) =>
  withAuth((opts) => portalGetReports({ ...opts, data: filters }));

export const exportOfficerReports = (
  data: ReportsFilters & { format: ReportExportFormat },
) => withAuth((opts) => portalExportReports({ ...opts, data }));

export const getActivityLog = (filters: ActivityFilters = {}) =>
  withAuth((opts) => portalGetActivityLog({ ...opts, data: filters }));

export const exportActivityLog = (filters: ActivityFilters = {}) =>
  withAuth((opts) => portalExportActivityLog({ ...opts, data: filters }));