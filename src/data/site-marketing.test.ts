import { describe, expect, it } from "vitest";
import { destinations, europeanDestinations, stats, topDestinations, whyUs } from "./site";

describe("public marketing destinations and stats", () => {
  it("uses 250+ students guided and 26+ countries consistently", () => {
    expect(stats.find((s) => s.label === "Students Guided")?.value).toBe("250+");
    expect(stats.find((s) => s.label === "Countries")?.value).toBe("26+");
    expect(whyUs.some((w) => w.body.includes("26+ countries"))).toBe(true);
    expect(whyUs.some((w) => w.body.includes("30+"))).toBe(false);
  });

  it("removes Lithuania and Finland from public destination listings", () => {
    const names = destinations.map((d) => d.name);
    expect(names).not.toContain("Lithuania");
    expect(names).not.toContain("Finland");
    expect(topDestinations.map((d) => d.name)).not.toContain("Lithuania");
    expect(topDestinations.map((d) => d.name)).not.toContain("Finland");
  });

  it("features Ireland, Austria, Hungary, and Sweden with full explore copy", () => {
    expect(europeanDestinations.map((d) => d.name)).toEqual([
      "Ireland",
      "Austria",
      "Hungary",
      "Sweden",
    ]);
    for (const d of europeanDestinations) {
      expect(d.desc.length).toBeGreaterThan(20);
      expect(d.desc.endsWith("...")).toBe(false);
      expect(destinations.some((x) => x.name === d.name)).toBe(true);
    }
  });
});
