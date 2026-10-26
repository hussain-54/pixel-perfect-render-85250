import { describe, expect, it } from "vitest";
import {
  appendFeeProofMeta,
  buildSignupFeeVoucherPdfLines,
  encodeSignupFeeVoucherPdf,
  parseFeeProofMeta,
  signupFeeProofStoragePath,
  stripFeeProofMeta,
} from "./signup-fee-voucher-pdf";
import { signupFeeVoucherNumber } from "./signup-fee-voucher";

const feeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("signup-fee-voucher-pdf", () => {
  it("builds PDF lines from real fee values without Paid/Verified seals on unpaid", () => {
    const lines = buildSignupFeeVoucherPdfLines({
      feeId,
      caseId: "GR-1001",
      studentName: "Hina Khan",
      amount: 5000,
      currency: "PKR",
      status: "unpaid",
      issuedAt: "2026-10-20T08:00:00.000Z",
    });
    const text = lines.join("\n");
    expect(text).toContain(signupFeeVoucherNumber(feeId));
    expect(text).toContain("Hina Khan");
    expect(text).toContain("GR-1001");
    expect(text).toContain("PKR");
    expect(text).toContain("5");
    expect(text).toMatch(/Payment Pending/i);
    expect(text).not.toMatch(/Document status:\s*Verified/i);
    expect(text).toMatch(/not a verified receipt/i);
    expect(text).toMatch(/No verification seal or paid QR code/i);
  });

  it("encodes a downloadable A4 PDF with stable filename and voucher number", () => {
    const a = encodeSignupFeeVoucherPdf({
      feeId,
      caseId: "GR-1001",
      studentName: "Hina Khan",
      amount: 5000,
      currency: "PKR",
      status: "unpaid",
      issuedAt: "2026-10-20T08:00:00.000Z",
    });
    const b = encodeSignupFeeVoucherPdf({
      feeId,
      caseId: "GR-1001",
      studentName: "Hina Khan",
      amount: 5000,
      currency: "PKR",
      status: "unpaid",
      issuedAt: "2026-10-20T08:00:00.000Z",
    });
    expect(a.voucherNumber).toBe(b.voucherNumber);
    expect(a.filename).toBe(b.filename);
    expect(a.mimeType).toBe("application/pdf");
    expect(a.contentBase64.length).toBeGreaterThan(80);
    const decoded = Buffer.from(a.contentBase64, "base64").toString("latin1");
    expect(decoded.startsWith("%PDF")).toBe(true);
    expect(decoded).toContain("/MediaBox [0 0 595 842]");
    // Unpaid generation must not flip status wording to Verified in the PDF body.
    expect(decoded).not.toMatch(/Document status: Verified/);
  });

  it("round-trips proof meta in notes without losing staff notes", () => {
    const withMeta = appendFeeProofMeta("Bank transfer confirmed at counter.", {
      path: "signup-fee-proofs/s1/fee1_slip.png",
      fileName: "slip.png",
      mimeType: "image/png",
      byteLength: 1200,
      uploadedAt: "2026-10-26T12:00:00.000Z",
    });
    expect(stripFeeProofMeta(withMeta)).toBe("Bank transfer confirmed at counter.");
    const parsed = parseFeeProofMeta(withMeta);
    expect(parsed?.path).toContain("signup-fee-proofs");
    expect(parsed?.fileName).toBe("slip.png");
    expect(signupFeeProofStoragePath("stu-1", "fee-9", "My Slip!.png")).toContain(
      "signup-fee-proofs/stu-1/fee-9_",
    );
  });
});
