import type {
  CounsellingSessionModeDb,
  HandoverStatusDb,
  InquiryChannelDb,
  SignupFeeStatusDb,
} from '@/types/database';

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

export type SignupFeeRecordInput = {
  studentId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  referenceReceipt?: string;
  notes?: string;
  markClaimed?: boolean;
};

export type VerifySignupFeeInput = {
  studentId: string;
  action: 'verify' | 'waive' | 'reject';
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
  status: SignupFeeStatusDb;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  referenceReceipt: string | null;
  verifiedAt: string | null;
  portalActivatedAt: string | null;
};

export type HandoverView = {
  id: string;
  studentId: string;
  status: HandoverStatusDb;
  summary: string;
  handedOverAt: string;
};
