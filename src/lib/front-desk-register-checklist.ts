/**
 * Live registration checklist — derived from form values only.
 * Optional sections never block Register; required fields drive canSubmit.
 */
import {
  isValidIntakeEmail,
  isValidIntakePhone,
  resolveCatalogOrOther,
} from "@/lib/intake-form-options";

export type RegisterChecklistStatus = "complete" | "pending" | "optional";

export type RegisterChecklistSectionId =
  | "contact"
  | "preferences"
  | "signup_fee"
  | "counsellor";

export type RegisterFormSnapshot = {
  fullName: string;
  email: string;
  phone: string;
  whatsapp: string;
  whatsappSameAsPhone: boolean;
  city: string;
  cityOther: string;
  destination: string;
  destinationOther: string;
  program: string;
  programOther: string;
  studyLevel: string;
  studyLevelOther: string;
  inquirySource: string;
  inquirySourceOther: string;
  feeAmount: string;
  assignedConsultantId: string;
};

export type RegisterChecklistSection = {
  id: RegisterChecklistSectionId;
  title: string;
  status: RegisterChecklistStatus;
  requiredComplete: number;
  requiredTotal: number;
  hint: string;
};

function catalogOk(selected: string, other: string, required: boolean): boolean {
  if (!selected.trim()) return !required;
  const r = resolveCatalogOrOther(selected, other);
  return r.ok;
}

export function contactRequiredComplete(form: RegisterFormSnapshot): {
  complete: number;
  total: number;
  ok: boolean;
} {
  const nameOk = form.fullName.trim().length > 0;
  const emailOk = isValidIntakeEmail(form.email);
  const phoneOk = isValidIntakePhone(form.phone);
  const whatsappOk =
    form.whatsappSameAsPhone ||
    !form.whatsapp.trim() ||
    isValidIntakePhone(form.whatsapp);
  const cityOk = catalogOk(form.city, form.cityOther, false);
  // City is optional — only name/email/phone are required for section completeness.
  const required = [nameOk, emailOk, phoneOk && whatsappOk];
  return {
    complete: required.filter(Boolean).length,
    total: 3,
    ok: required.every(Boolean) && cityOk,
  };
}

export function preferencesRequiredComplete(form: RegisterFormSnapshot): {
  complete: number;
  total: number;
  ok: boolean;
} {
  const destOk = catalogOk(form.destination, form.destinationOther, true);
  const progOk = catalogOk(form.program, form.programOther, true);
  const levelOk = catalogOk(form.studyLevel, form.studyLevelOther, false);
  const sourceOk = catalogOk(form.inquirySource, form.inquirySourceOther, false);
  const required = [destOk, progOk];
  return {
    complete: required.filter(Boolean).length,
    total: 2,
    ok: required.every(Boolean) && levelOk && sourceOk,
  };
}

export function signupFeeSectionStatus(form: RegisterFormSnapshot): RegisterChecklistStatus {
  const amount = form.feeAmount.trim();
  if (!amount) return "optional";
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "pending";
  return "complete";
}

export function counsellorSectionStatus(form: RegisterFormSnapshot): RegisterChecklistStatus {
  return form.assignedConsultantId.trim() ? "complete" : "optional";
}

export function buildRegisterChecklist(
  form: RegisterFormSnapshot,
): RegisterChecklistSection[] {
  const contact = contactRequiredComplete(form);
  const prefs = preferencesRequiredComplete(form);
  const fee = signupFeeSectionStatus(form);
  const counsellor = counsellorSectionStatus(form);

  return [
    {
      id: "contact",
      title: "Student & Contact Information",
      status: contact.ok ? "complete" : "pending",
      requiredComplete: contact.complete,
      requiredTotal: contact.total,
      hint: "Full name, email, phone / WhatsApp",
    },
    {
      id: "preferences",
      title: "Study Preferences",
      status: prefs.ok ? "complete" : "pending",
      requiredComplete: prefs.complete,
      requiredTotal: prefs.total,
      hint: "Destination and intended programme",
    },
    {
      id: "signup_fee",
      title: "Signup Fee",
      status: fee,
      requiredComplete: fee === "complete" ? 1 : 0,
      requiredTotal: 0,
      hint: "Optional — claimed is not Finance-verified",
    },
    {
      id: "counsellor",
      title: "Counsellor Assignment",
      status: counsellor,
      requiredComplete: counsellor === "complete" ? 1 : 0,
      requiredTotal: 0,
      hint: "Optional — assign later is allowed",
    },
  ];
}

export function registerFormCanSubmit(form: RegisterFormSnapshot): boolean {
  return contactRequiredComplete(form).ok && preferencesRequiredComplete(form).ok;
}

export function countRequiredRemaining(form: RegisterFormSnapshot): number {
  const contact = contactRequiredComplete(form);
  const prefs = preferencesRequiredComplete(form);
  return (
    contact.total -
    contact.complete +
    (prefs.total - prefs.complete)
  );
}
