import { describe, expect, it } from "vitest";
import {
  FUNDING_UI_TO_DB,
  isPubliclyVisibleScholarship,
  mapFundingTypeDb,
  mapScholarshipRow,
} from "./scholarship-mappers";
import type { ScholarshipRow } from "@/types/database";

const row = {
  id: "s1",
  title: "Chevening",
  description: "UK award",
  provider: "FCDO",
  university_id: null,
  country: "UK",
  study_level: "Master's",
  field_of_study: "Any",
  funding_type: "fully_funded",
  funding_description: "Full tuition + stipend",
  eligibility: "Leadership potential",
  opens_on: "2026-08-01",
  closes_on: "2026-11-05",
  application_url: "https://example.com",
  status: "published",
  created_by: null,
  updated_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
} as ScholarshipRow;

describe("scholarship mappers", () => {
  it("maps DB funding/status onto UI Scholarship fields", () => {
    const ui = mapScholarshipRow(row);
    expect(ui.name).toBe("Chevening");
    expect(ui.funding).toBe("Fully Funded");
    expect(ui.deadline).toBe("2026-11-05");
    expect(ui.status).toBe("published");
    expect(FUNDING_UI_TO_DB["Tuition Waiver"]).toBe("tuition_waiver");
    expect(mapFundingTypeDb("partial_funding")).toBe("Partial Funding");
  });

  it("gates public visibility to published only", () => {
    expect(isPubliclyVisibleScholarship({ status: "published" })).toBe(true);
    expect(isPubliclyVisibleScholarship({ status: "draft" })).toBe(false);
    expect(isPubliclyVisibleScholarship({ status: "archived" })).toBe(false);
  });
});
