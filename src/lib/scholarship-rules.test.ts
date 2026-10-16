import { describe, expect, it } from "vitest";
import {
  canMutateScholarshipStaff,
  canViewScholarshipStaff,
  resolveScholarshipPage,
  studentMayMutateScholarships,
  validateScholarshipWrite,
} from "./scholarship-rules";

describe("scholarship rules", () => {
  it("allows staff view/mutate roles; never students", () => {
    expect(canViewScholarshipStaff({ appRole: "consultant" })).toBe(true);
    expect(canMutateScholarshipStaff({ appRole: "admin" })).toBe(true);
    expect(canViewScholarshipStaff({ appRole: "student" })).toBe(false);
    expect(canMutateScholarshipStaff({ appRole: "student" })).toBe(false);
    expect(studentMayMutateScholarships()).toBe(false);
  });

  it("validates write payload and date order", () => {
    expect(validateScholarshipWrite({ title: "A" }).ok).toBe(false);
    expect(
      validateScholarshipWrite({
        title: "Chevening",
        funding: "Fully Funded",
        opensOn: "2026-11-01",
        closesOn: "2026-10-01",
      }).ok,
    ).toBe(false);
    expect(
      validateScholarshipWrite({
        title: "Chevening",
        applicationUrl: "javascript:alert(1)",
      }).ok,
    ).toBe(false);
    const ok = validateScholarshipWrite({
      title: "Chevening",
      funding: "Fully Funded",
      status: "published",
      opensOn: "2026-08-01",
      closesOn: "2026-11-05",
      applicationUrl: "https://www.chevening.org",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.normalized.fundingType).toBe("fully_funded");
      expect(ok.normalized.status).toBe("published");
    }
  });

  it("resolves pagination bounds", () => {
    expect(resolveScholarshipPage({})).toEqual({ page: 1, pageSize: 25, offset: 0 });
    expect(resolveScholarshipPage({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      offset: 20,
    });
    expect(resolveScholarshipPage({ page: 0, pageSize: 500 }).pageSize).toBe(100);
  });
});
