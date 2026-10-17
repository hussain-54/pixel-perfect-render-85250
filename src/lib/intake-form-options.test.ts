import { describe, expect, it } from "vitest";
import {
  INTAKE_DESTINATIONS,
  INTAKE_INQUIRY_CHANNELS,
  INTAKE_PAKISTAN_CITIES,
  INTAKE_PROGRAMMES,
  INTAKE_SEASONS,
  INTAKE_STUDY_LEVELS,
  formatIntakeLabel,
  intakeSeasonYearToDate,
  intakeYearOptions,
  isValidIntakeEmail,
  isValidIntakePhone,
  mapInquiryChannelForLegacyDb,
  resolveCatalogOrOther,
} from "./intake-form-options";

describe("intake form options", () => {
  it("includes required cities, destinations, programmes, levels, seasons", () => {
    for (const city of ["Islamabad", "Haripur", "Karachi", "Other"]) {
      expect(INTAKE_PAKISTAN_CITIES).toContain(city);
    }
    for (const d of ["Germany", "United Kingdom", "Canada", "Other"]) {
      expect(INTAKE_DESTINATIONS).toContain(d);
    }
    expect(INTAKE_PROGRAMMES).toContain("Computer Science");
    expect(INTAKE_PROGRAMMES).toContain("Other");
    expect(INTAKE_STUDY_LEVELS).toContain("Bachelor's");
    expect(INTAKE_SEASONS).toEqual(
      expect.arrayContaining(["Winter", "Summer", "Spring", "Autumn", "Other"]),
    );
    expect(INTAKE_INQUIRY_CHANNELS.map((c) => c.value)).toEqual(
      expect.arrayContaining(["physical", "whatsapp", "education_expo", "other"]),
    );
  });

  it("maps season/year to a date without treating intake as a calendar picker day", () => {
    expect(intakeSeasonYearToDate("Winter", 2027)).toBe("2027-01-15");
    expect(intakeSeasonYearToDate("Summer", 2028)).toBe("2028-06-15");
    expect(formatIntakeLabel("Winter", 2027)).toBe("Winter 2027");
    expect(intakeSeasonYearToDate("", 2027)).toBeNull();
    expect(intakeYearOptions(new Date("2026-10-17T00:00:00Z"))).toEqual([
      2026, 2027, 2028, 2029,
    ]);
  });

  it("resolves Other custom values and validates contact fields", () => {
    expect(resolveCatalogOrOther("Lahore", "")).toEqual({ ok: true, value: "Lahore" });
    expect(resolveCatalogOrOther("Other", "Mansehra").ok).toBe(true);
    expect(resolveCatalogOrOther("Other", "").ok).toBe(false);
    expect(isValidIntakeEmail("a@b.co")).toBe(true);
    expect(isValidIntakeEmail("bad")).toBe(false);
    expect(isValidIntakePhone("+92 300 1234567")).toBe(true);
    expect(isValidIntakePhone("123")).toBe(false);
    expect(mapInquiryChannelForLegacyDb("whatsapp")).toBe("online");
    expect(mapInquiryChannelForLegacyDb("physical")).toBe("physical");
  });
});
