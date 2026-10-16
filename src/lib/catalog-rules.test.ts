import { describe, expect, it } from "vitest";
import {
  catalogHasPublicationStatus,
  resolveCatalogPage,
  validateProgramWrite,
  validateUniversityWrite,
} from "./catalog-rules";

describe("catalog rules", () => {
  it("documents no publication status column on universities/programs", () => {
    expect(catalogHasPublicationStatus()).toBe(false);
  });

  it("validates university writes", () => {
    expect(validateUniversityWrite({ name: "A", country: "UK" }).ok).toBe(false);
    expect(
      validateUniversityWrite({
        name: "Test U",
        country: "UK",
        website: "not-a-url",
      }).ok,
    ).toBe(false);
    const ok = validateUniversityWrite({
      name: "Test University",
      country: "United Kingdom",
      city: "London",
      website: "https://example.ac.uk",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.normalized.website).toBe("https://example.ac.uk");
      expect(ok.normalized.city).toBe("London");
    }
  });

  it("validates program writes", () => {
    expect(validateProgramWrite({ universityId: "", name: "CS" }).ok).toBe(false);
    expect(
      validateProgramWrite({
        universityId: "u1",
        name: "Computer Science",
        level: "Bachelor's",
      }).ok,
    ).toBe(true);
  });

  it("resolves pagination", () => {
    expect(resolveCatalogPage({ page: 2, pageSize: 10 })).toEqual({
      page: 2,
      pageSize: 10,
      offset: 10,
    });
  });
});
