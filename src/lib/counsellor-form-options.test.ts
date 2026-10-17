import { describe, expect, it } from "vitest";
import {
  COUNSELLOR_DESTINATIONS,
  COUNSELLOR_ELIGIBILITY,
  COUNSELLOR_LANGUAGE_TESTS,
  formatIntakeLabel,
  parseIntakeSeasonYear,
} from "./counsellor-form-options";

describe("counsellor form catalogs", () => {
  it("includes core destinations and eligibility outcomes", () => {
    expect(COUNSELLOR_DESTINATIONS).toContain("Germany");
    expect(COUNSELLOR_DESTINATIONS).toContain("Other");
    expect(COUNSELLOR_ELIGIBILITY).toContain("Good Fit");
    expect(COUNSELLOR_LANGUAGE_TESTS).toContain("Not taken yet");
  });

  it("round-trips season and year labels", () => {
    expect(formatIntakeLabel("Winter", 2027)).toBe("Winter 2027");
    expect(parseIntakeSeasonYear("Summer 2028")).toEqual({ season: "Summer", year: 2028 });
    expect(parseIntakeSeasonYear("legacy free text").season).toBe("");
  });
});
