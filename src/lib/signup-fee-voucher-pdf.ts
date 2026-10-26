/**
 * Signup fee voucher PDF builders — real PDF bytes via existing lightweight PDF encoder.
 * Uses persisted fee/student values only; unpaid vouchers never claim verification.
 */
import { siteContact } from "@/data/contact";
import { encodeExport } from "@/lib/export-formats";
import {
  SIGNUP_FEE_CATEGORY_LABEL,
  SIGNUP_FEE_VOUCHER_TITLE,
  buildSignupFeePaymentInstructions,
  describeSignupFeeOperationalStatus,
  formatSignupFeeAmount,
  signupFeeVoucherNumber,
  voucherPrintFilename,
} from "@/lib/signup-fee-voucher";

export type SignupFeeVoucherPdfInput = {
  feeId: string;
  caseId: string;
  studentName: string;
  amount: number;
  currency: string;
  status: string | null | undefined;
  issuedAt: string | null | undefined;
  consultancyName?: string;
  supportEmail?: string;
};

export function buildSignupFeeVoucherPdfLines(input: SignupFeeVoucherPdfInput): string[] {
  const voucherNo = signupFeeVoucherNumber(input.feeId);
  const ops = describeSignupFeeOperationalStatus(input.status);
  const amountLabel = formatSignupFeeAmount(input.amount, input.currency);
  const issued = input.issuedAt
    ? input.issuedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const consultancy = (input.consultancyName || "Global Roots Consultants").trim();
  const email = (input.supportEmail || siteContact.email.display).trim();
  const instructions = buildSignupFeePaymentInstructions({
    supportEmail: email,
    officeDisplay: siteContact.location.fullDisplay,
    phoneDisplay: siteContact.phone.display,
    phonePlaceholder: siteContact.phone.placeholder,
  });

  const lines: string[] = [
    consultancy,
    siteContact.location.fullDisplay,
    `Email: ${email}`,
    siteContact.registration ? String(siteContact.registration) : "",
    "",
    "════════════════════════════════════════",
    SIGNUP_FEE_VOUCHER_TITLE,
    "Signup / intake fee only — separate from university fees",
    "════════════════════════════════════════",
    "",
    `Voucher reference: ${voucherNo}`,
    `Issue date: ${issued}`,
    `Document status: ${ops.voucherBadge}`,
    "",
    "STUDENT",
    `Name: ${input.studentName.trim() || "—"}`,
    `Case ID: ${input.caseId.trim() || "—"}`,
    "",
    "FEE DETAILS",
    `Category: ${SIGNUP_FEE_CATEGORY_LABEL}`,
    `Description: Registration / counselling intake fee`,
    `Amount: ${amountLabel}`,
    `TOTAL PAYABLE: ${amountLabel}`,
    "",
    "PAYMENT INSTRUCTIONS",
    ...instructions.map((l, i) => `${i + 1}. ${l}`),
    "",
    `Quote voucher ${voucherNo} when submitting proof to Front Desk.`,
    "",
  ];

  if (ops.tone === "verified" || ops.tone === "waived") {
    lines.push(
      `Finance decision on file: ${ops.voucherBadge}.`,
      "University / application fees remain a separate ledger.",
    );
  } else {
    lines.push(
      "NOTICE: This is a payment voucher, not a verified receipt.",
      "A screenshot or bank slip alone does not confirm payment until Finance verifies the claim.",
      "No verification seal or paid QR code appears on unpaid vouchers.",
    );
  }

  lines.push(
    "",
    "────────────────────────────────────────",
    `${consultancy} · Ref ${voucherNo} · A4 fee voucher`,
  );

  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
}

export function encodeSignupFeeVoucherPdf(input: SignupFeeVoucherPdfInput): {
  filename: string;
  mimeType: string;
  contentBase64: string;
  voucherNumber: string;
} {
  const voucherNumber = signupFeeVoucherNumber(input.feeId);
  const lines = buildSignupFeeVoucherPdfLines(input);
  const encoded = encodeExport(
    "pdf",
    voucherPrintFilename(input.caseId, voucherNumber),
    [],
    lines,
    SIGNUP_FEE_VOUCHER_TITLE,
    { pdfPageSize: "a4" },
  );
  return {
    ...encoded,
    voucherNumber,
  };
}

/** Structured proof metadata appended to fee notes (no extra DB column required). */
export const FEE_PROOF_NOTE_PREFIX = "\n\n[FEE_PROOF_META]";

export type FeeProofMeta = {
  path: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  uploadedAt: string;
};

export function appendFeeProofMeta(notes: string | null | undefined, meta: FeeProofMeta): string {
  const base = stripFeeProofMeta(notes).trim();
  const payload = `${FEE_PROOF_NOTE_PREFIX}${JSON.stringify(meta)}`;
  return base ? `${base}${payload}` : payload.trimStart();
}

export function stripFeeProofMeta(notes: string | null | undefined): string {
  const raw = notes ?? "";
  const idx = raw.indexOf(FEE_PROOF_NOTE_PREFIX);
  if (idx < 0) return raw;
  return raw.slice(0, idx).trimEnd();
}

export function parseFeeProofMeta(notes: string | null | undefined): FeeProofMeta | null {
  const raw = notes ?? "";
  const idx = raw.indexOf(FEE_PROOF_NOTE_PREFIX);
  if (idx < 0) return null;
  const json = raw.slice(idx + FEE_PROOF_NOTE_PREFIX.length).trim();
  try {
    const parsed = JSON.parse(json) as FeeProofMeta;
    if (!parsed?.path || !parsed?.fileName || !parsed?.mimeType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function signupFeeProofStoragePath(
  studentId: string,
  feeId: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "proof";
  return `signup-fee-proofs/${studentId}/${feeId}_${safe}`;
}
