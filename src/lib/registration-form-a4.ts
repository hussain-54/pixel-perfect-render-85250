/**
 * Shared Front Desk registration form display helpers (A4 + list UI).
 * Labels must reflect persisted signup_fee_payments.status — never invent outcomes.
 */

export function displayOrBlank(value: string | null | undefined, blank = "—"): string {
  const t = (value ?? "").trim();
  return t || blank;
}

export function registrationFormPdfFilename(caseId: string): string {
  const safe = (caseId || "registration").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "registration"}-registration-form`;
}

/** Human-readable signup fee status for FD lists and A4 form. */
export function describePersistedSignupFeeStatus(status: string | null | undefined): {
  label: string;
  /** True when a payment claim exists but Accounts has not verified/waived. */
  isClaimedAwaitingFinance: boolean;
  /** True when Accounts verified or waived. */
  isAuthorized: boolean;
} {
  const s = (status ?? "").trim().toLowerCase();
  if (!s || s === "unpaid") {
    return {
      label: "Not claimed",
      isClaimedAwaitingFinance: false,
      isAuthorized: false,
    };
  }
  if (s === "claimed") {
    return {
      label: "Claimed — awaiting Finance",
      isClaimedAwaitingFinance: true,
      isAuthorized: false,
    };
  }
  if (s === "verified") {
    return { label: "Verified", isClaimedAwaitingFinance: false, isAuthorized: true };
  }
  if (s === "waived") {
    return { label: "Waived", isClaimedAwaitingFinance: false, isAuthorized: true };
  }
  if (s === "rejected") {
    return { label: "Rejected", isClaimedAwaitingFinance: false, isAuthorized: false };
  }
  return {
    label: s.replaceAll("_", " "),
    isClaimedAwaitingFinance: false,
    isAuthorized: false,
  };
}

/**
 * Sets the browser document title used as the default Save-as-PDF filename,
 * then opens print. Restores the previous title afterward.
 *
 * Note: browsers may still strip background colours unless the user enables
 * “Background graphics” in the print dialog — CSS cannot override that setting.
 */
export function printRegistrationFormPdf(caseId: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const previous = document.title;
  document.title = registrationFormPdfFilename(caseId);
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  // Allow logo/layout paint before print (helps colour + image fidelity).
  window.setTimeout(() => {
    window.print();
    window.setTimeout(restore, 2000);
  }, 120);
}
