/** Public consultation request validation (shared client/server). */
import { z } from "zod";

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
});

export type ConsultationRequestInput = z.infer<typeof consultationRequestSchema>;

export type ConsultationSubmitResult = {
  ok: true;
  ref: string;
  /** True only when a row was written to consultation_requests. */
  persisted: boolean;
};

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
  });
}

export function newConsultationReference(): string {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `REQ-${token}`;
}
