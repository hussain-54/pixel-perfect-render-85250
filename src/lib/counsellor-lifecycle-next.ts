/**
 * Counsellor student-profile next-step UI (pure).
 * Driven only by persisted assessment / consent / fee / request / handover state.
 */
import { feeStatusAllowsAdmissionHandover } from "@/lib/fee-verification-workflow";

/** Factual action label when optional request notes are left blank. */
export const DEFAULT_FEE_VERIFICATION_SUMMARY = "Signup fee verification requested";

/** Factual action label when optional handover notes are left blank. */
export const DEFAULT_ADMISSION_HANDOVER_SUMMARY = "Case forwarded to Admission Team";

export type CounsellorLifecycleStepId =
  | "review_profile"
  | "complete_assessment"
  | "record_consent"
  | "request_fee_verification"
  | "await_fee_decision"
  | "forward_admission"
  | "with_admission"
  | "done";

export type CounsellorLifecycleInput = {
  hasSavedAssessment: boolean;
  hasConsent: boolean;
  signupFeeStatus: string | null | undefined;
  /** Latest open/in_progress counselling fee-verification request, if any. */
  openFeeRequestStatus: string | null | undefined;
  /** Latest admission handover status (submitted / accepted / returned), if any. */
  handoverStatus: string | null | undefined;
};

export type CounsellorLifecycleNext = {
  stepId: CounsellorLifecycleStepId;
  title: string;
  body: string;
  primaryAction:
    | "none"
    | "go_assessment"
    | "record_consent"
    | "request_fee_verification"
    | "forward_admission"
    | "view_handover";
  primaryLabel: string | null;
  feeStatusLabel: string;
};

export function normalizeOptionalActionSummary(
  raw: string | null | undefined,
  fallback: string,
): string {
  const t = (raw ?? "").trim();
  return t || fallback;
}

export function describeSignupFeeStatusForCounsellor(status: string | null | undefined): string {
  const s = (status ?? "").trim().toLowerCase();
  if (!s || s === "unpaid") return "Signup fee not yet claimed";
  if (s === "claimed") return "Payment claimed — awaiting Accounts/Finance";
  if (s === "verified") return "Signup fee verified";
  if (s === "waived") return "Signup fee waived";
  if (s === "rejected") return "Signup fee rejected";
  return `Signup fee: ${s.replaceAll("_", " ")}`;
}

export function resolveCounsellorLifecycleNext(
  input: CounsellorLifecycleInput,
): CounsellorLifecycleNext {
  const feeStatusLabel = describeSignupFeeStatusForCounsellor(input.signupFeeStatus);
  const feeOk = feeStatusAllowsAdmissionHandover(input.signupFeeStatus);
  const openReq = (input.openFeeRequestStatus ?? "").trim().toLowerCase();
  const handover = (input.handoverStatus ?? "").trim().toLowerCase();

  if (handover === "accepted") {
    return {
      stepId: "done",
      title: "With Admission Team",
      body: "Admission has accepted this case. Continue documents and applications as needed.",
      primaryAction: "none",
      primaryLabel: null,
      feeStatusLabel,
    };
  }

  if (handover === "submitted") {
    return {
      stepId: "with_admission",
      title: "Forwarded to Admission",
      body: "Waiting for the Admission Team to accept or return this case.",
      primaryAction: "view_handover",
      primaryLabel: null,
      feeStatusLabel,
    };
  }

  if (handover === "returned") {
    return {
      stepId: "forward_admission",
      title: "Admission returned the case",
      body: "Review notes, update the assessment if needed, then forward to Admission again when ready.",
      primaryAction: feeOk ? "forward_admission" : "request_fee_verification",
      primaryLabel: feeOk ? "Forward to Admission" : "Request fee verification",
      feeStatusLabel,
    };
  }

  if (!input.hasSavedAssessment) {
    return {
      stepId: "complete_assessment",
      title: "Complete assessment",
      body: "Save the eligibility assessment before consent, fee verification, or Admission.",
      primaryAction: "go_assessment",
      primaryLabel: "Open assessment",
      feeStatusLabel,
    };
  }

  if (!input.hasConsent) {
    return {
      stepId: "record_consent",
      title: "Record counselling consent",
      body: "Confirm that the student consented to counselling. This is required before fee verification or Admission.",
      primaryAction: "record_consent",
      primaryLabel: "Record consent",
      feeStatusLabel,
    };
  }

  if (feeOk) {
    return {
      stepId: "forward_admission",
      title: "Ready for Admission",
      body: "Signup fee is authorized. Forward this case to the Admission Team when counselling is complete.",
      primaryAction: "forward_admission",
      primaryLabel: "Forward to Admission",
      feeStatusLabel,
    };
  }

  if (openReq === "in_progress" || openReq === "open") {
    return {
      stepId: "await_fee_decision",
      title: openReq === "in_progress" ? "Awaiting Accounts/Finance" : "With Front Desk",
      body:
        openReq === "in_progress"
          ? "Front Desk forwarded this request. Accounts must verify or waive before Admission."
          : "Fee verification request is with Front Desk. They will coordinate with Accounts.",
      primaryAction: "none",
      primaryLabel: null,
      feeStatusLabel,
    };
  }

  if ((input.signupFeeStatus ?? "").toLowerCase() === "rejected") {
    return {
      stepId: "request_fee_verification",
      title: "Fee was rejected",
      body: "Accounts rejected the signup fee. Coordinate a corrected claim, then request verification again if needed.",
      primaryAction: "request_fee_verification",
      primaryLabel: "Request fee verification",
      feeStatusLabel,
    };
  }

  return {
    stepId: "request_fee_verification",
    title: "Request fee verification",
    body: "Ask Front Desk to coordinate signup-fee verification with Accounts. Optional notes can help them.",
    primaryAction: "request_fee_verification",
    primaryLabel: "Send to Front Desk",
    feeStatusLabel,
  };
}

export type ProgressStep = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
};

export function counsellorLifecycleProgressSteps(input: CounsellorLifecycleInput): ProgressStep[] {
  const next = resolveCounsellorLifecycleNext(input);
  const feeOk = feeStatusAllowsAdmissionHandover(input.signupFeeStatus);
  const handoverDone =
    (input.handoverStatus ?? "").toLowerCase() === "submitted" ||
    (input.handoverStatus ?? "").toLowerCase() === "accepted";

  const steps: Omit<ProgressStep, "current">[] = [
    {
      id: "assessment",
      label: "Assessment",
      done: input.hasSavedAssessment,
    },
    {
      id: "consent",
      label: "Consent",
      done: input.hasConsent,
    },
    {
      id: "fee",
      label: "Fee",
      done: feeOk,
    },
    {
      id: "admission",
      label: "Admission",
      done: handoverDone,
    },
  ];

  const currentId =
    next.stepId === "complete_assessment"
      ? "assessment"
      : next.stepId === "record_consent"
        ? "consent"
        : next.stepId === "request_fee_verification" || next.stepId === "await_fee_decision"
          ? "fee"
          : "admission";

  return steps.map((s) => ({
    ...s,
    current: s.id === currentId && !s.done,
  }));
}
