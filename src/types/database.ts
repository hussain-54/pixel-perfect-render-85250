/**
 * Supabase Postgres schema types for the Admission Officer Portal foundation.
 * Mirrors supabase/migrations/20261010010000_admission_officer_foundation.sql
 * Regenerate from Supabase after applying migrations when CLI access is available.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRoleDb = "student" | "consultant" | "admin" | "super_admin";
export type ConsultantStatus = "active" | "inactive";
export type JourneyStage =
  | "profile_submitted"
  | "consultation_completed"
  | "documents_submitted"
  | "documents_under_review"
  | "university_shortlisting"
  | "application_submitted"
  | "offer_received"
  | "visa_preparation"
  | "visa_submitted"
  | "visa_approved"
  | "travel_preparation"
  | "completed"
;
export type ApplicationStage =
  | "docs_pending"
  | "under_review"
  | "ready_to_submit"
  | "submitted"
  | "offer_received"
  | "rejected"
  | "withdrawn"
  | "draft"
;
export type DocumentStatusDb = "pending_review" | "approved" | "rejected" | "needs_correction";
export type DocumentReviewAction = "approved" | "rejected" | "needs_correction" | "reupload_requested";
export type OfferType = "conditional" | "unconditional";
export type OfferStatus = "awaiting_student" | "conditions_pending" | "accepted" | "declined" | "expired";
export type DepositStatus = "due" | "paid" | "waived" | "overdue";
export type CasI20Type = "CAS" | "I-20";
export type CasI20Status = "pending" | "requested" | "issued" | "expired";
export type VisaStage = "doc_prep" | "filed" | "biometrics" | "decision";
export type VisaDecision = "pending" | "approved" | "refused";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "overdue";
export type AppointmentStatusDb = "requested" | "confirmed" | "rescheduled" | "completed" | "cancelled" | "no_show";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: AppRoleDb;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          phone?: string | null;
          role?: AppRoleDb;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      consultants: {
        Row: {
          id: string;
          department: string | null;
          desk: string | null;
          job_title: string | null;
          status: ConsultantStatus;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          department?: string | null;
          desk?: string | null;
          job_title?: string | null;
          status?: ConsultantStatus;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["consultants"]["Insert"]>;
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          profile_id: string | null;
          case_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          whatsapp: string | null;
          city: string | null;
          dob: string | null;
          destination: string | null;
          program: string | null;
          study_level: string | null;
          journey_stage: JourneyStage;
          assigned_consultant_id: string | null;
          last_activity_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          case_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          whatsapp?: string | null;
          city?: string | null;
          dob?: string | null;
          destination?: string | null;
          program?: string | null;
          study_level?: string | null;
          journey_stage?: JourneyStage;
          assigned_consultant_id?: string | null;
          last_activity_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [];
      };
      student_academic_profiles: {
        Row: {
          student_id: string;
          highest_qualification: string | null;
          institution: string | null;
          graduation_year: number | null;
          gpa_or_percentage: string | null;
          english_test: string | null;
          english_score: string | null;
          work_experience_years: number | null;
          preferred_intake: string | null;
          budget_range: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          student_id: string;
          highest_qualification?: string | null;
          institution?: string | null;
          graduation_year?: number | null;
          gpa_or_percentage?: string | null;
          english_test?: string | null;
          english_score?: string | null;
          work_experience_years?: number | null;
          preferred_intake?: string | null;
          budget_range?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_academic_profiles"]["Insert"]>;
        Relationships: [];
      };
      student_assessments: {
        Row: {
          id: string;
          student_id: string;
          assessed_by: string | null;
          summary: string;
          readiness_score: number | null;
          strengths: string | null;
          gaps: string | null;
          recommended_next_steps: string | null;
          assessed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          assessed_by?: string | null;
          summary?: string;
          readiness_score?: number | null;
          strengths?: string | null;
          gaps?: string | null;
          recommended_next_steps?: string | null;
          assessed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_assessments"]["Insert"]>;
        Relationships: [];
      };
      universities: {
        Row: {
          id: string;
          name: string;
          country: string;
          city: string | null;
          website: string | null;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          country: string;
          city?: string | null;
          website?: string | null;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["universities"]["Insert"]>;
        Relationships: [];
      };
      programs: {
        Row: {
          id: string;
          university_id: string;
          name: string;
          level: string | null;
          duration: string | null;
          tuition_fee: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          name: string;
          level?: string | null;
          duration?: string | null;
          tuition_fee?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["programs"]["Insert"]>;
        Relationships: [];
      };
      shortlist_items: {
        Row: {
          id: string;
          student_id: string;
          university_id: string | null;
          program_id: string | null;
          university_name: string;
          program_name: string;
          country: string | null;
          tuition_fee: string | null;
          ranking_note: string | null;
          reason: string | null;
          sort_order: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          university_id?: string | null;
          program_id?: string | null;
          university_name: string;
          program_name: string;
          country?: string | null;
          tuition_fee?: string | null;
          ranking_note?: string | null;
          reason?: string | null;
          sort_order?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shortlist_items"]["Insert"]>;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          student_id: string;
          university_id: string | null;
          program_id: string | null;
          university_name: string;
          program_name: string;
          country: string | null;
          intake: string;
          deadline: string | null;
          stage: ApplicationStage;
          portal_ref: string | null;
          submitted_at: string | null;
          decision_at: string | null;
          owned_by_consultant_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          university_id?: string | null;
          program_id?: string | null;
          university_name: string;
          program_name: string;
          country?: string | null;
          intake?: string;
          deadline?: string | null;
          stage?: ApplicationStage;
          portal_ref?: string | null;
          submitted_at?: string | null;
          decision_at?: string | null;
          owned_by_consultant_id?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      application_stage_history: {
        Row: {
          id: string;
          application_id: string;
          from_stage: ApplicationStage | null;
          to_stage: ApplicationStage;
          changed_by: string | null;
          note: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          from_stage?: ApplicationStage | null;
          to_stage: ApplicationStage;
          changed_by?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_stage_history"]["Insert"]>;
        Relationships: [];
      };
      document_checklist_templates: {
        Row: {
          id: string;
          country: string;
          doc_type: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          country: string;
          doc_type: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["document_checklist_templates"]["Insert"]>;
        Relationships: [];
      };
      student_documents: {
        Row: {
          id: string;
          student_id: string;
          doc_type: string;
          label: string;
          status: DocumentStatusDb;
          current_version: number;
          required: boolean;
          expires_on: string | null;
          linked_application_id: string | null;
          awaiting_upload: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          doc_type: string;
          label: string;
          status?: DocumentStatusDb;
          current_version?: number;
          required?: boolean;
          expires_on?: string | null;
          linked_application_id?: string | null;
          awaiting_upload?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_documents"]["Insert"]>;
        Relationships: [];
      };
      document_versions: {
        Row: {
          id: string;
          document_id: string;
          version_number: number;
          storage_bucket: string;
          storage_path: string;
          file_name: string;
          mime_type: string | null;
          file_size_bytes: number | null;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          version_number: number;
          storage_bucket?: string;
          storage_path: string;
          file_name: string;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          uploaded_by?: string | null;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_versions"]["Insert"]>;
        Relationships: [];
      };
      document_reviews: {
        Row: {
          id: string;
          document_id: string;
          version_id: string | null;
          reviewer_id: string | null;
          action: DocumentReviewAction;
          comments: string | null;
          reviewed_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          version_id?: string | null;
          reviewer_id?: string | null;
          action: DocumentReviewAction;
          comments?: string | null;
          reviewed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_reviews"]["Insert"]>;
        Relationships: [];
      };
      offers: {
        Row: {
          id: string;
          application_id: string;
          student_id: string;
          offer_type: OfferType;
          status: OfferStatus;
          offer_date: string | null;
          response_deadline: string | null;
          tuition_fee: string | null;
          scholarship_note: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          student_id: string;
          offer_type?: OfferType;
          status?: OfferStatus;
          offer_date?: string | null;
          response_deadline?: string | null;
          tuition_fee?: string | null;
          scholarship_note?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["offers"]["Insert"]>;
        Relationships: [];
      };
      offer_conditions: {
        Row: {
          id: string;
          offer_id: string;
          description: string;
          met: boolean;
          met_at: string | null;
          evidence_document_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          description: string;
          met?: boolean;
          met_at?: string | null;
          evidence_document_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["offer_conditions"]["Insert"]>;
        Relationships: [];
      };
      deposits: {
        Row: {
          id: string;
          offer_id: string;
          student_id: string;
          amount: number | null;
          currency: string | null;
          status: DepositStatus;
          due_date: string | null;
          paid_at: string | null;
          reference: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          student_id: string;
          amount?: number | null;
          currency?: string | null;
          status?: DepositStatus;
          due_date?: string | null;
          paid_at?: string | null;
          reference?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deposits"]["Insert"]>;
        Relationships: [];
      };
      cas_i20_records: {
        Row: {
          id: string;
          student_id: string;
          application_id: string | null;
          offer_id: string | null;
          record_type: CasI20Type;
          status: CasI20Status;
          reference_number: string | null;
          issued_at: string | null;
          expires_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          application_id?: string | null;
          offer_id?: string | null;
          record_type: CasI20Type;
          status?: CasI20Status;
          reference_number?: string | null;
          issued_at?: string | null;
          expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cas_i20_records"]["Insert"]>;
        Relationships: [];
      };
      visa_milestones: {
        Row: {
          id: string;
          student_id: string;
          application_id: string | null;
          cas_i20_id: string | null;
          stage: VisaStage;
          decision: VisaDecision;
          filed_at: string | null;
          biometrics_at: string | null;
          decision_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          application_id?: string | null;
          cas_i20_id?: string | null;
          stage?: VisaStage;
          decision?: VisaDecision;
          filed_at?: string | null;
          biometrics_at?: string | null;
          decision_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["visa_milestones"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          student_id: string | null;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          assignee_id: string | null;
          created_by: string | null;
          due_at: string | null;
          completed_at: string | null;
          reminder_at: string | null;
          reminder_ref: string | null;
          related_application_id: string | null;
          related_document_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id?: string | null;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          assignee_id?: string | null;
          created_by?: string | null;
          due_at?: string | null;
          completed_at?: string | null;
          reminder_at?: string | null;
          reminder_ref?: string | null;
          related_application_id?: string | null;
          related_document_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      internal_notes: {
        Row: {
          id: string;
          student_id: string;
          author_id: string | null;
          body: string;
          pinned: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          author_id?: string | null;
          body: string;
          pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["internal_notes"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string | null;
          link_path: string | null;
          student_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body?: string | null;
          link_path?: string | null;
          student_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          student_id: string;
          consultant_id: string | null;
          status: AppointmentStatusDb;
          scheduled_at: string | null;
          duration_minutes: number | null;
          meeting_link: string | null;
          location: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          consultant_id?: string | null;
          status?: AppointmentStatusDb;
          scheduled_at?: string | null;
          duration_minutes?: number | null;
          meeting_link?: string | null;
          location?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Insert"]>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          student_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          student_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      consultation_requests: {
        Row: {
          id: string;
          reference_code: string;
          full_name: string;
          email: string;
          phone: string;
          whatsapp: string | null;
          destination: string | null;
          study_level: string | null;
          program: string | null;
          preferred_date: string | null;
          message: string | null;
          status: string;
          assigned_consultant_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reference_code: string;
          full_name: string;
          email: string;
          phone: string;
          whatsapp?: string | null;
          destination?: string | null;
          study_level?: string | null;
          program?: string | null;
          preferred_date?: string | null;
          message?: string | null;
          status?: string;
          assigned_consultant_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["consultation_requests"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_set_user_role: {
        Args: { target_user_id: string; new_role: AppRoleDb };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      write_audit_event: {
        Args: {
          p_action: string;
          p_entity_type: string;
          p_entity_id?: string | null;
          p_student_id?: string | null;
          p_metadata?: Json;
        };
        Returns: Database["public"]["Tables"]["audit_events"]["Row"];
      };
      can_access_student: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      current_app_role: {
        Args: Record<string, never>;
        Returns: AppRoleDb;
      };
    };
    Enums: {
      app_role: AppRoleDb;
      consultant_status: ConsultantStatus;
      journey_stage: JourneyStage;
      application_stage: ApplicationStage;
      document_status: DocumentStatusDb;
      document_review_action: DocumentReviewAction;
      offer_type: OfferType;
      offer_status: OfferStatus;
      deposit_status: DepositStatus;
      cas_i20_type: CasI20Type;
      cas_i20_status: CasI20Status;
      visa_stage: VisaStage;
      visa_decision: VisaDecision;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      appointment_status: AppointmentStatusDb;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type ProfileRow = Tables<"profiles">;
export type StudentRow = Tables<"students">;
export type ConsultantRow = Tables<"consultants">;
export type ApplicationRow = Tables<"applications">;
export type ApplicationStageHistoryRow = Tables<"application_stage_history">;
export type StudentDocumentRow = Tables<"student_documents">;
export type DocumentVersionRow = Tables<"document_versions">;
export type DocumentReviewRow = Tables<"document_reviews">;
export type OfferRow = Tables<"offers">;
export type OfferConditionRow = Tables<"offer_conditions">;
export type DepositRow = Tables<"deposits">;
export type CasI20Row = Tables<"cas_i20_records">;
export type VisaMilestoneRow = Tables<"visa_milestones">;
export type TaskRow = Tables<"tasks">;
export type InternalNoteRow = Tables<"internal_notes">;
export type ShortlistItemRow = Tables<"shortlist_items">;
export type StudentAcademicProfileRow = Tables<"student_academic_profiles">;
export type StudentAssessmentRow = Tables<"student_assessments">;
export type AuditEventRow = Tables<"audit_events">;

export {
  STUDENT_DOCUMENTS_BUCKET,
  studentDocumentStoragePath,
} from "@/lib/document-storage";
