/**
 * Signup/intake fee voucher helpers — stable references from persisted fee rows.
 * Does not invent payment verification; unpaid vouchers are never "Verified".
 */

export const SIGNUP_FEE_VOUCHER_TITLE = "Official Fee Payment Voucher";
export const SIGNUP_FEE_CATEGORY_LABEL = "Signup / intake registration fee";

/** Stable display reference from the unique signup_fee_payments.id. */
export function signupFeeVoucherNumber(feeId: string | null | undefined): string {
  const id = (feeId ?? "").trim();
  if (!id) return "";
  const compact = id.replace(/-/g, "").slice(0, 12).toUpperCase();
  return `GR-SF-${compact || id.slice(0, 8).toUpperCase()}`;
}

export function formatSignupFeeAmount(amount: number, currency: string): string {
  const cur = (currency || "PKR").trim() || "PKR";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${cur} —`;
  return `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** FD / Finance facing labels for the payment lifecycle (existing enum only). */
export function describeSignupFeeOperationalStatus(status: string | null | undefined): {
  label: string;
  tone: "pending" | "awaiting" | "verified" | "rejected" | "waived" | "unknown";
  voucherBadge: string;
} {
  const s = (status ?? "").trim().toLowerCase();
  if (!s || s === "unpaid") {
    return {
      label: "Voucher issued — awaiting payment",
      tone: "pending",
      voucherBadge: "Payment Pending",
    };
  }
  if (s === "claimed") {
    return {
      label: "Payment proof submitted — awaiting Finance verification",
      tone: "awaiting",
      voucherBadge: "Awaiting Finance verification",
    };
  }
  if (s === "verified") {
    return { label: "Verified by Finance", tone: "verified", voucherBadge: "Verified" };
  }
  if (s === "waived") {
    return { label: "Waived by Finance", tone: "waived", voucherBadge: "Waived" };
  }
  if (s === "rejected") {
    return {
      label: "Rejected — correction required",
      tone: "rejected",
      voucherBadge: "Rejected",
    };
  }
  return {
    label: s.replaceAll("_", " "),
    tone: "unknown",
    voucherBadge: s.replaceAll("_", " "),
  };
}

export function voucherPrintFilename(caseId: string, voucherNumber: string): string {
  const safeCase = (caseId || "student").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  const safeV = (voucherNumber || "voucher").replace(/[^\w.-]+/g, "-");
  return `${safeCase || "student"}-${safeV || "fee-voucher"}`;
}

/** Payment instructions — only use configured contact; never invent bank accounts. */
export function buildSignupFeePaymentInstructions(input: {
  supportEmail: string;
  officeDisplay: string;
  phoneDisplay: string;
  phonePlaceholder?: boolean;
}): string[] {
  const lines: string[] = [
    "Pay the total amount shown on this voucher using an office-accepted method.",
    "After payment, submit proof of payment (receipt or transfer screenshot) to Front Desk with this voucher reference.",
    "Front Desk will record the claim. Finance / Accounts must verify before the fee is treated as paid.",
  ];
  const email = input.supportEmail.trim();
  if (email) lines.push(`Office email: ${email}`);
  const office = input.officeDisplay.trim();
  if (office) lines.push(`Office: ${office}`);
  if (!input.phonePlaceholder && input.phoneDisplay.trim()) {
    lines.push(`Phone: ${input.phoneDisplay.trim()}`);
  } else {
    lines.push("Phone: confirm with Front Desk (not published on this voucher).");
  }
  lines.push(
    "Bank account numbers and QR verification seals are not printed here unless configured by the organization.",
  );
  return lines;
}
