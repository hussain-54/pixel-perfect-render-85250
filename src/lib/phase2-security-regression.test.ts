/**
 * Phase 2 security / workflow regression — unit-level (no production DB).
 * Live IDOR / local Supabase E2E remain BLOCKED without Docker.
 */
import { describe, expect, it } from "vitest";
import { resolveCrmListStudentIds } from "./student-crm-scope";
import {
  assertUniversityFeeVerifyTransition,
  canVerifyUniversityFeePayment,
} from "./university-fee-auth";
import { documentsHaveUnpublishedChanges, sanitizePlainText } from "./cms-rules";
import { sanitizeBlogHtml } from "./blog-rules";
import { canFullyApproveModule, hasMinPermission } from "./business-permissions";
import {
  appAllowsVerifySignupFeeCall,
  resolveFeeStatusForAction,
} from "./signup-fee-security-rules";
import { roleCanAccessPortal } from "./roles";

describe("IDOR / student self-scope", () => {
  it("blocks student requesting another student's CRM ids", () => {
    const result = resolveCrmListStudentIds({
      role: "student",
      ownStudentId: "stu-a",
      requestedStudentId: "stu-b",
      visibleStudentIds: ["stu-a", "stu-b"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("allows student only own id when no request", () => {
    const result = resolveCrmListStudentIds({
      role: "student",
      ownStudentId: "stu-a",
      requestedStudentId: null,
      visibleStudentIds: ["stu-a", "stu-b"],
    });
    expect(result).toEqual({ ok: true, studentIds: ["stu-a"] });
  });

  it("blocks staff requesting student outside visibility set", () => {
    const result = resolveCrmListStudentIds({
      role: "consultant",
      ownStudentId: null,
      requestedStudentId: "stu-x",
      visibleStudentIds: ["stu-a"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});

describe("cross-role portal access", () => {
  it("student cannot enter admin portal", () => {
    expect(roleCanAccessPortal("student", "admin")).toBe(false);
    expect(roleCanAccessPortal("student", "student")).toBe(true);
  });

  it("consultant cannot enter admin portal", () => {
    expect(roleCanAccessPortal("consultant", "admin")).toBe(false);
    expect(roleCanAccessPortal("admin", "admin")).toBe(true);
  });
});

describe("finance verification authorization", () => {
  it("denies counsellor university fee verify; allows accounts", () => {
    expect(
      canVerifyUniversityFeePayment({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canVerifyUniversityFeePayment({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
  });

  it("blocks duplicate / illegal university status transitions", () => {
    expect(() =>
      assertUniversityFeeVerifyTransition({ current: "verified", action: "verify" }),
    ).toThrow(/finalized/i);
    expect(() => assertUniversityFeeVerifyTransition({ current: "due", action: "verify" })).toThrow(
      /claimed/i,
    );
  });

  it("signup fee verify path is accounts-gated in app layer", () => {
    expect(appAllowsVerifySignupFeeCall({ isFrontDesk: true, appLayerCanVerify: true })).toBe(
      false,
    );
    expect(appAllowsVerifySignupFeeCall({ isFrontDesk: false, appLayerCanVerify: true })).toBe(
      true,
    );
  });

  it("signup fee verify action maps to terminal verified status", () => {
    expect(resolveFeeStatusForAction("verify")).toBe("verified");
  });
});

describe("counsellor / admission matrix boundaries", () => {
  it("counsellor cannot fully approve admissions; admission_team can", () => {
    expect(canFullyApproveModule("counsellor_consultant", "admissions")).toBe(false);
    expect(hasMinPermission("admission_team", "admissions", 2)).toBe(true);
  });

  it("front desk cannot edit banking_finance", () => {
    expect(hasMinPermission("front_desk_student_affairs", "banking_finance", 1)).toBe(false);
  });
});

describe("CMS draft vs publish + XSS hygiene", () => {
  it("detects unpublished draft changes (draft not equal published)", () => {
    expect(documentsHaveUnpublishedChanges({ title: "Draft" }, { title: "Live" })).toBe(true);
    expect(documentsHaveUnpublishedChanges({ title: "Same" }, { title: "Same" })).toBe(false);
  });

  it("strips script from blog HTML and plain CMS fields", () => {
    expect(sanitizeBlogHtml("<p>Hi</p><script>alert(1)</script>")).not.toMatch(/script/i);
    expect(sanitizePlainText("<img onerror=x>Hello", 100)).toBe("Hello");
  });
});
