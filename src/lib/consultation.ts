/** Public consultation request validation (shared client/server). */
import { z } from "zod";

export const CONSULTATION_REF_PATTERN = /^REQ-[A-Z0-9]+$/;

export const CONSULTATION_PERSISTENCE_ERROR =
  "We could not confirm that your request was saved. Please try again — your details are still in the form.";

export const consultationRequestSchema = z.object({
  name: z.string().trim().min(2, "Please enter your full name.").max(120),
  email: z.string().trim().email("Please enter a valid email address.").max(180),
  phone: z
    .string()
    .trim()
    .min(8, "Please enter a valid phone number.")
    .max(40)
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Please enter a valid phone number."),
  whatsapp: z.string().trim().max(40).optional().or(z.literal("")),
  destination: z.string().trim().max(80).optional().or(z.literal("")),
  level: z.string().trim().max(80).optional().or(z.literal("")),
  program: z.string().trim().max(120).optional().or(z.literal("")),
  date: z.string().trim().max(32).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  /** Optional client-supplied ref for retry idempotency (same attempt). */
  reference_code: z
    .string()
    .trim()
    .regex(CONSULTATION_REF_PATTERN, "Invalid reference code.")
    .optional()
    .or(z.literal("")),
});

export type ConsultationRequestInput = z.infer<typeof consultationRequestSchema>;

export type ConsultationSubmitSuccess = {
  ok: true;
  persisted: true;
  ref: string;
};

export type ConsultationSubmitFailure = {
  ok: false;
  persisted: false;
  ref: string;
  error: string;
};

export type ConsultationSubmitResult = ConsultationSubmitSuccess | ConsultationSubmitFailure;

export function isConsultationReference(value: string): boolean {
  return CONSULTATION_REF_PATTERN.test(value.trim());
}

export function validateConsultationRequest(data: Record<string, string>) {
  return consultationRequestSchema.safeParse({
    name: data["name"] ?? "",
    email: data["email"] ?? "",
    phone: data["phone"] ?? "",
    whatsapp: data["whatsapp"] ?? "",
    destination: data["destination"] ?? "",
    level: data["level"] ?? "",
    program: data["program"] ?? "",
    date: data["date"] ?? "",
    message: data["message"] ?? "",
    reference_code: data["reference_code"] ?? "",
  });
}

export function newConsultationReference(): string {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `REQ-${token}`;
}

/** Resolve reference for this submission attempt (reuse on retry). */
export function resolveConsultationReference(preferred?: string | null): string {
  const trimmed = preferred?.trim() ?? "";
  if (trimmed && isConsultationReference(trimmed)) return trimmed;
  return newConsultationReference();
}

/**
 * Strip status prefixes and internal/SQL details from errors shown to visitors.
 */
export function publicConsultationErrorMessage(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return CONSULTATION_PERSISTENCE_ERROR;
  let msg = raw.trim().replace(/^\d{3}:\s*/, "");
  if (
    /42501|PGRST|permission denied|row-level security|schema cache|does not exist|postgres|sqlstate|stack|supabase/i.test(
      msg,
    )
  ) {
    return CONSULTATION_PERSISTENCE_ERROR;
  }
  if (msg.length > 180) return CONSULTATION_PERSISTENCE_ERROR;
  return msg || CONSULTATION_PERSISTENCE_ERROR;
}

/** Pure UI decision helper — success only when the row was confirmed persisted. */
export function resolveConsultationSubmitUi(result: ConsultationSubmitResult): {
  kind: "success" | "failure";
  ref: string;
  error?: string;
} {
  if (result.ok && result.persisted) {
    return { kind: "success", ref: result.ref };
  }
  const failure = result as ConsultationSubmitFailure;
  return {
    kind: "failure",
    ref: failure.ref,
    error: publicConsultationErrorMessage(failure.error || CONSULTATION_PERSISTENCE_ERROR),
  };
}
