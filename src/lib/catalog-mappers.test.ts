import { describe, expect, it } from "vitest";
import {
  SCHOLARSHIPS_SCHEMA_GAP,
  mapProgramRow,
  mapUniversityWithPrograms,
} from "./catalog-mappers";
import type { Tables } from "@/types/database";

const uni = {
  id: "u1",
  name: "Test U",
  country: "UK",
  city: "London",
  website: "https://example.edu",
  logo_url: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
} as Tables<"universities">;

const programs = [
  {
    id: "p1",
    university_id: "u1",
    name: "MSc CS",
    level: "Master's",
    duration: "1 year",
    tuition_fee: "£20k",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "p2",
    university_id: "u1",
    name: "BSc CS",
    level: "Bachelor's",
    duration: "3 years",
    tuition_fee: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
] as Tables<"programs">[];

describe("catalog mappers (live universities/programs)", () => {
  it("maps university with program names/levels; never invents scholarship", () => {
    const ui = mapUniversityWithPrograms(uni, programs);
    expect(ui.name).toBe("Test U");
    expect(ui.levels).toEqual(["Bachelor's", "Master's"]);
    expect(ui.programs).toEqual(["MSc CS", "BSc CS"]);
    expect(ui.scholarship).toBe(false);
    expect(ui.ranking).toBe("https://example.edu");
  });

  it("maps program rows with university name fallback", () => {
    const row = mapProgramRow(programs[0]!, new Map([["u1", "Test U"]]));
    expect(row.universityName).toBe("Test U");
    expect(row.level).toBe("Master's");
    expect(mapProgramRow(programs[0]!, new Map()).universityName).toBe("—");
  });

  it("documents scholarships as live with no demo fallback", () => {
    expect(SCHOLARSHIPS_SCHEMA_GAP).toMatch(/20261016010000/);
    expect(SCHOLARSHIPS_SCHEMA_GAP).toMatch(/20261016020000/);
    expect(SCHOLARSHIPS_SCHEMA_GAP).toMatch(/no demo fallback/i);
  });
});
