/**
 * Supabase Postgres schema types for the Admission Officer Portal foundation.
 * Mirrors supabase/migrations/20261010010000_admission_officer_foundation.sql
 * Regenerate from Supabase after applying migrations when CLI access is available.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
  | "completed";
export type ApplicationStage =
  | "docs_pending"
  | "under_review"
  | "ready_to_submit"
  | "submitted"
  | "offer_received"
  | "rejected"
  | "withdrawn"
  | "draft";
export type DocumentStatusDb = "pending_review" | "approved" | "rejected" | "needs_correction";
export type DocumentReviewAction =
  "approved" | "rejected" | "needs_correction" | "reupload_requested";
export type ScholarshipStatusDb = "draft" | "published" | "archived";
export type ScholarshipFundingTypeDb =
  | "fully_funded"
  | "partial_funding"
  | "tuition_waiver";
export type OfferType = "conditional" | "unconditional";
export type OfferStatus =
  "awaiting_student" | "conditions_pending" | "accepted" | "declined" | "expired";
export type DepositStatus = "due" | "paid" | "waived" | "overdue";
export type CasI20Type = "CAS" | "I-20";
export type CasI20Status = "pending" | "requested" | "issued" | "expired";
export type VisaStage = "doc_prep" | "filed" | "biometrics" | "decision";
export type VisaDecision = "pending" | "approved" | "refused";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "overdue";
export type AppointmentStatusDb =
  "requested" | "confirmed" | "rescheduled" | "completed" | "cancelled" | "no_show";
/** Matrix business role (profiles.business_role) — Milestone 1. */
export type HrEmploymentStatusDb = "active" | "on_leave" | "terminated";
export type HrAttendanceStatusDb = "present" | "absent" | "late" | "leave" | "holiday";

export type BusinessRoleDb =
  | "front_desk_student_affairs"
  | "counsellor_consultant"
  | "admission_team"
  | "student_portal"
  | "accounts_banking_finance"
  | "hr_system"
  | "digital_manager"
  | "office_ops"
  | "manager"
  | "admin";
export type SignupFeeStatusDb = "unpaid" | "claimed" | "verified" | "waived" | "rejected";
export type InquiryChannelDb =
  | "physical"
  | "online"
  | "phone"
  | "whatsapp"
  | "referral"
  | "education_expo"
  | "social_media"
  | "other";
export type CounsellingSessionModeDb = "physical" | "online";
export type HandoverStatusDb = "submitted" | "accepted" | "returned";
export type UniversityFeeKindDb =
  "application_fee" | "tuition" | "offer_deposit" | "visa_fee" | "other";
export type UniversityFeeStatusDb = "due" | "claimed" | "verified" | "waived" | "rejected";

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
          business_role: BusinessRoleDb | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          phone?: string | null;
          role?: AppRoleDb;
          business_role?: BusinessRoleDb | null;
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
          inquiry_source: string | null;
          inquiry_channel: InquiryChannelDb | null;
          intake_date: string | null;
          registration_notes: string | null;
          next_follow_up_at: string | null;
          portal_activated_at: string | null;
          registered_by: string | null;
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
          inquiry_source?: string | null;
          inquiry_channel?: InquiryChannelDb | null;
          intake_date?: string | null;
          registration_notes?: string | null;
          next_follow_up_at?: string | null;
          portal_activated_at?: string | null;
          registered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
        Relationships: [];
      };
      signup_fee_payments: {
        Row: {
          id: string;
          student_id: string;
          amount: number;
          currency: string;
          payment_method: string | null;
          reference_receipt: string | null;
          status: SignupFeeStatusDb;
          recorded_by: string | null;
          verified_by: string | null;
          verified_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          amount: number;
          currency?: string;
          payment_method?: string | null;
          reference_receipt?: string | null;
          status?: SignupFeeStatusDb;
          recorded_by?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["signup_fee_payments"]["Insert"]>;
        Relationships: [];
      };
      counselling_agreements: {
        Row: {
          id: string;
          student_id: string;
          consented: boolean;
          consent_label: string;
          session_date: string | null;
          session_mode: CounsellingSessionModeDb | null;
          attendance: string | null;
          summary: string | null;
          outcome: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          consented?: boolean;
          consent_label?: string;
          session_date?: string | null;
          session_mode?: CounsellingSessionModeDb | null;
          attendance?: string | null;
          summary?: string | null;
          outcome?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["counselling_agreements"]["Insert"]>;
        Relationships: [];
      };
      admission_handovers: {
        Row: {
          id: string;
          student_id: string;
          from_consultant_id: string | null;
          to_owner_id: string | null;
          status: HandoverStatusDb;
          checklist: Json;
          summary: string;
          missing_information: string | null;
          handed_over_by: string | null;
          handed_over_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          from_consultant_id?: string | null;
          to_owner_id?: string | null;
          status?: HandoverStatusDb;
          checklist?: Json;
          summary?: string;
          missing_information?: string | null;
          handed_over_by?: string | null;
          handed_over_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admission_handovers"]["Insert"]>;
        Relationships: [];
      };
      university_fee_obligations: {
        Row: {
          id: string;
          student_id: string;
          application_id: string | null;
          offer_id: string | null;
          kind: UniversityFeeKindDb;
          label: string;
          amount: number;
          currency: string;
          due_date: string | null;
          status: UniversityFeeStatusDb;
          payment_method: string | null;
          reference_receipt: string | null;
          evidence_notes: string | null;
          recorded_by: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          application_id?: string | null;
          offer_id?: string | null;
          kind?: UniversityFeeKindDb;
          label?: string;
          amount: number;
          currency?: string;
          due_date?: string | null;
          status?: UniversityFeeStatusDb;
          payment_method?: string | null;
          reference_receipt?: string | null;
          evidence_notes?: string | null;
          recorded_by?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["university_fee_obligations"]["Insert"]>;
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
      scholarships: {
        Row: {
          id: string;
          title: string;
          description: string;
          provider: string;
          university_id: string | null;
          country: string;
          study_level: string;
          field_of_study: string;
          funding_type: ScholarshipFundingTypeDb;
          funding_description: string;
          eligibility: string;
          opens_on: string | null;
          closes_on: string | null;
          application_url: string | null;
          status: ScholarshipStatusDb;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string;
          provider?: string;
          university_id?: string | null;
          country?: string;
          study_level?: string;
          field_of_study?: string;
          funding_type?: ScholarshipFundingTypeDb;
          funding_description?: string;
          eligibility?: string;
          opens_on?: string | null;
          closes_on?: string | null;
          application_url?: string | null;
          status?: ScholarshipStatusDb;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scholarships"]["Insert"]>;
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
      hr_employees: {
        Row: {
          id: string;
          profile_id: string | null;
          employee_code: string;
          full_name: string;
          department: string;
          job_title: string;
          status: HrEmploymentStatusDb;
          hired_on: string | null;
          reporting_manager_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          employee_code: string;
          full_name: string;
          department?: string;
          job_title?: string;
          status?: HrEmploymentStatusDb;
          hired_on?: string | null;
          reporting_manager_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hr_employees"]["Insert"]>;
        Relationships: [];
      };
      hr_attendance_records: {
        Row: {
          id: string;
          employee_id: string;
          work_date: string;
          status: HrAttendanceStatusDb;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          work_date: string;
          status?: HrAttendanceStatusDb;
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hr_attendance_records"]["Insert"]>;
        Relationships: [];
      };
      hr_leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          leave_type: "annual" | "sick" | "unpaid" | "other";
          start_date: string;
          end_date: string;
          reason: string;
          status: "pending" | "approved" | "rejected" | "cancelled";
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          leave_type?: "annual" | "sick" | "unpaid" | "other";
          start_date: string;
          end_date: string;
          reason?: string;
          status?: "pending" | "approved" | "rejected" | "cancelled";
          decided_by?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hr_leave_requests"]["Insert"]>;
        Relationships: [];
      };
      hr_attendance_corrections: {
        Row: {
          id: string;
          attendance_id: string;
          previous_status: HrAttendanceStatusDb;
          new_status: HrAttendanceStatusDb;
          reason: string;
          corrected_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          attendance_id: string;
          previous_status: HrAttendanceStatusDb;
          new_status: HrAttendanceStatusDb;
          reason: string;
          corrected_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hr_attendance_corrections"]["Insert"]>;
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
      organization_settings: {
        Row: {
          id: number;
          consultancy_name: string;
          support_email: string;
          portal_footer_note: string;
          email_admins_on_new_leads: boolean;
          student_document_alerts: boolean;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          consultancy_name?: string;
          support_email?: string;
          portal_footer_note?: string;
          email_admins_on_new_leads?: boolean;
          student_document_alerts?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_settings"]["Insert"]>;
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
      business_module_permissions: {
        Row: {
          business_role: BusinessRoleDb;
          module: string;
          permission_level: number;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          business_role: BusinessRoleDb;
          module: string;
          permission_level: number;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          business_role?: BusinessRoleDb;
          module?: string;
          permission_level?: number;
          updated_by?: string | null;
          updated_at?: string;
        };
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
          campaign_id: string | null;
          attribution_source: string | null;
          original_attribution_source: string | null;
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
          campaign_id?: string | null;
          attribution_source?: string | null;
          original_attribution_source?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["consultation_requests"]["Insert"]>;
        Relationships: [];
      };
      marketing_campaigns: {
        Row: {
          id: string;
          name: string;
          channel: string;
          status: "draft" | "active" | "paused" | "completed";
          starts_on: string | null;
          ends_on: string | null;
          budget_note: string | null;
          owner_profile_id: string | null;
          created_by: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          channel?: string;
          status?: "draft" | "active" | "paused" | "completed";
          starts_on?: string | null;
          ends_on?: string | null;
          budget_note?: string | null;
          owner_profile_id?: string | null;
          created_by?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marketing_campaigns"]["Insert"]>;
        Relationships: [];
      };
      marketing_attribution_history: {
        Row: {
          id: string;
          consultation_request_id: string;
          previous_campaign_id: string | null;
          new_campaign_id: string | null;
          previous_attribution_source: string | null;
          new_attribution_source: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          consultation_request_id: string;
          previous_campaign_id?: string | null;
          new_campaign_id?: string | null;
          previous_attribution_source?: string | null;
          new_attribution_source?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marketing_attribution_history"]["Insert"]>;
        Relationships: [];
      };
      ops_suppliers: {
        Row: {
          id: string;
          name: string;
          contact_name: string;
          email: string;
          phone: string;
          status: "active" | "inactive";
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_name?: string;
          email?: string;
          phone?: string;
          status?: "active" | "inactive";
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_suppliers"]["Insert"]>;
        Relationships: [];
      };
      ops_inventory_items: {
        Row: {
          id: string;
          sku: string;
          name: string;
          unit: string;
          quantity_on_hand: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          unit?: string;
          quantity_on_hand?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_inventory_items"]["Insert"]>;
        Relationships: [];
      };
      ops_purchase_orders: {
        Row: {
          id: string;
          supplier_id: string;
          status:
            "draft" | "submitted" | "approved" | "partially_received" | "received" | "cancelled";
          currency: string;
          notes: string | null;
          ordered_at: string | null;
          created_by: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          status?:
            "draft" | "submitted" | "approved" | "partially_received" | "received" | "cancelled";
          currency?: string;
          notes?: string | null;
          ordered_at?: string | null;
          created_by?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_purchase_orders"]["Insert"]>;
        Relationships: [];
      };
      ops_purchase_lines: {
        Row: {
          id: string;
          purchase_order_id: string;
          inventory_item_id: string;
          quantity_ordered: number;
          quantity_received: number;
          unit_cost: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          inventory_item_id: string;
          quantity_ordered: number;
          quantity_received?: number;
          unit_cost?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_purchase_lines"]["Insert"]>;
        Relationships: [];
      };
      ops_stock_movements: {
        Row: {
          id: string;
          inventory_item_id: string;
          kind: "receive" | "adjust" | "issue";
          quantity: number;
          purchase_order_id: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_item_id: string;
          kind: "receive" | "adjust" | "issue";
          quantity: number;
          purchase_order_id?: string | null;
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_stock_movements"]["Insert"]>;
        Relationships: [];
      };
      ops_sales_orders: {
        Row: {
          id: string;
          customer_name: string;
          status: "draft" | "confirmed" | "fulfilled" | "cancelled";
          currency: string;
          total_amount: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_name: string;
          status?: "draft" | "confirmed" | "fulfilled" | "cancelled";
          currency?: string;
          total_amount?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_sales_orders"]["Insert"]>;
        Relationships: [];
      };
      ops_expenses: {
        Row: {
          id: string;
          category: string;
          description: string;
          amount: number;
          currency: string;
          status: "draft" | "submitted" | "reviewed" | "rejected";
          incurred_on: string;
          created_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category?: string;
          description: string;
          amount: number;
          currency?: string;
          status?: "draft" | "submitted" | "reviewed" | "rejected";
          incurred_on?: string;
          created_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ops_expenses"]["Insert"]>;
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
      claim_own_student_record: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["students"]["Row"];
      };
      front_desk_link_student_portal_profile: {
        Args: { p_student_id: string; p_profile_id: string };
        Returns: {
          student_id: string;
          profile_id: string | null;
          portal_activated_at: string | null;
        }[];
      };
      is_front_desk: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_intake_registrar: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      is_front_desk_fee_registrar: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      intake_register_student: {
        Args: {
          p_case_id: string;
          p_full_name: string;
          p_email: string;
          p_phone?: string | null;
          p_whatsapp?: string | null;
          p_city?: string | null;
          p_destination?: string | null;
          p_program?: string | null;
          p_study_level?: string | null;
          p_assigned_consultant_id?: string | null;
          p_inquiry_source?: string | null;
          p_inquiry_channel?: InquiryChannelDb | null;
          p_intake_date?: string | null;
          p_registration_notes?: string | null;
          p_profile_id?: string | null;
        };
        Returns: {
          id: string;
          case_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          whatsapp: string | null;
          city: string | null;
          destination: string | null;
          program: string | null;
          study_level: string | null;
          journey_stage: JourneyStage;
          assigned_consultant_id: string | null;
          registered_by: string | null;
          inquiry_source: string | null;
          inquiry_channel: InquiryChannelDb | null;
          intake_date: string | null;
          created_at: string;
          updated_at: string;
        }[];
      };
      verify_signup_fee_and_activate: {
        Args: {
          p_fee_id: string;
          p_student_id: string;
          p_action: string;
          p_notes?: string | null;
          p_activate_portal?: boolean;
        };
        Returns: {
          fee_id: string;
          student_id: string;
          status: SignupFeeStatusDb;
          portal_activated_at: string | null;
        }[];
      };
      list_front_desk_intake_summaries: {
        Args: { p_include_archived?: boolean };
        Returns: {
          id: string;
          case_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          whatsapp: string | null;
          city: string | null;
          destination: string | null;
          program: string | null;
          study_level: string | null;
          inquiry_source: string | null;
          inquiry_channel: InquiryChannelDb | null;
          intake_date: string | null;
          registration_notes: string | null;
          next_follow_up_at: string | null;
          assigned_consultant_id: string | null;
          registered_by: string | null;
          journey_stage: JourneyStage;
          portal_activated_at: string | null;
          profile_id: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          signup_fee_status: SignupFeeStatusDb | null;
          signup_fee_amount: number | null;
          signup_fee_currency: string | null;
          signup_fee_method: string | null;
          signup_fee_reference: string | null;
          counsellor_name: string | null;
          registrar_name: string | null;
        }[];
      };
      front_desk_update_intake_registration: {
        Args: {
          p_student_id: string;
          p_expected_updated_at: string;
          p_full_name: string;
          p_email: string;
          p_phone?: string | null;
          p_whatsapp?: string | null;
          p_city?: string | null;
          p_destination?: string | null;
          p_program?: string | null;
          p_study_level?: string | null;
          p_inquiry_source?: string | null;
          p_inquiry_channel?: InquiryChannelDb | null;
          p_intake_date?: string | null;
          p_registration_notes?: string | null;
          p_next_follow_up_at?: string | null;
        };
        Returns: {
          id: string;
          case_id: string;
          updated_at: string;
        }[];
      };
      front_desk_archive_registration: {
        Args: {
          p_student_id: string;
          p_archive: boolean;
          p_reason?: string | null;
        };
        Returns: {
          id: string;
          case_id: string;
          archived_at: string | null;
        }[];
      };
      front_desk_assign_counsellor: {
        Args: { p_student_id: string; p_consultant_id: string };
        Returns: {
          id: string;
          case_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          whatsapp: string | null;
          city: string | null;
          destination: string | null;
          program: string | null;
          study_level: string | null;
          journey_stage: JourneyStage;
          assigned_consultant_id: string | null;
          registered_by: string | null;
          updated_at: string;
        };
      };
      list_active_counsellor_desks: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          full_name: string;
          email: string;
          department: string | null;
          job_title: string | null;
        }[];
      };
      can_access_hr: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_mutate_hr: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_own_hr_employee: {
        Args: { p_employee_id: string };
        Returns: boolean;
      };
      can_access_marketing: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_mutate_marketing: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_access_office_ops: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      can_mutate_office_ops: {
        Args: Record<string, never>;
        Returns: boolean;
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
      business_role: BusinessRoleDb;
      signup_fee_status: SignupFeeStatusDb;
      inquiry_channel: InquiryChannelDb;
      counselling_session_mode: CounsellingSessionModeDb;
      handover_status: HandoverStatusDb;
      university_fee_kind: UniversityFeeKindDb;
      university_fee_status: UniversityFeeStatusDb;
      scholarship_status: ScholarshipStatusDb;
      scholarship_funding_type: ScholarshipFundingTypeDb;
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
export type AppointmentRow = Tables<"appointments">;
export type SignupFeePaymentRow = Tables<"signup_fee_payments">;
export type CounsellingAgreementRow = Tables<"counselling_agreements">;
export type AdmissionHandoverRow = Tables<"admission_handovers">;
export type UniversityFeeObligationRow = Tables<"university_fee_obligations">;
export type InternalNoteRow = Tables<"internal_notes">;
export type ShortlistItemRow = Tables<"shortlist_items">;
export type StudentAcademicProfileRow = Tables<"student_academic_profiles">;
export type StudentAssessmentRow = Tables<"student_assessments">;
export type AuditEventRow = Tables<"audit_events">;
export type ScholarshipRow = Tables<"scholarships">;

export { STUDENT_DOCUMENTS_BUCKET, studentDocumentStoragePath } from "@/lib/document-storage";
