import type {
  CounsellingSessionModeDb,
  HandoverStatusDb,
  InquiryChannelDb,
  SignupFeeStatusDb,
} from "@/types/database";

export type IntakeRegisterInput = {
  fullName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  city?: string;
  destination: string;
  program: string;
  studyLevel?: string;
  inquirySource?: string;
  inquiryChannel?: InquiryChannelDb;
  intakeDate?: string;
  registrationNotes?: string;
  assignedConsultantId?: string;
  signupFee?: {
    amount: number;
    currency?: string;
    paymentMethod?: string;
    referenceReceipt?: string;
    notes?: string;
    markClaimed?: boolean;
  };
};

export type SignupFeeProofFileInput = {
  fileName: string;
  mimeType: string;
  /** Raw file bytes as base64 (no data: URL prefix). */
  contentBase64: string;
};

export type SignupFeeRecordInput = {
  studentId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  referenceReceipt?: string;
  notes?: string;
  markClaimed?: boolean;
  /** Optional payment screenshot/receipt — stored privately; Finance previews via signed URL. */
  proofFile?: SignupFeeProofFileInput;
};

export type VerifySignupFeeInput = {
  studentId: string;
  action: "verify" | "waive" | "reject";
  notes?: string;
  activatePortal?: boolean;
};

export type AssignCounsellorInput = {
  studentId: string;
  consultantId: string;
};

export type CounsellingAgreementInput = {
  studentId: string;
  consented: boolean;
  consentLabel?: string;
  sessionDate?: string;
  sessionMode?: CounsellingSessionModeDb;
  attendance?: string;
  summary?: string;
  outcome?: string;
};

export type AdmissionHandoverInput = {
  studentId: string;
  summary: string;
  checklist?: Record<string, boolean | string>;
  missingInformation?: string;
  toOwnerId?: string;
};

export type SignupFeeView = {
  studentId: string;
  /** Persisted signup_fee_payments.id — stable voucher reference source. */
  feeId: string | null;
  status: SignupFeeStatusDb;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  referenceReceipt: string | null;
  notes?: string | null;
  verifiedAt: string | null;
  portalActivatedAt: string | null;
  recordedBy?: string | null;
  updatedAt?: string | null;
};

export type HandoverView = {
  id: string;
  studentId: string;
  status: HandoverStatusDb;
  summary: string;
  handedOverAt: string;
};
