import { describe, expect, it } from "vitest";
import {
  exploreUniversities,
  exploreUniversitiesAwaitingLogos,
  exploreUniversitiesWithVerifiedLogos,
  splitExploreUniversitiesForCarousel,
} from "./explore-universities";

const REQUIRED_NAMES = [
  "University of Greenwich",
  "Northeastern University London",
  "Northumbria University Newcastle",
  "Cranfield University",
  "Nottingham Trent University",
  "University of Sussex",
  "Oxford Brookes University",
  "University of Exeter",
  "Bangor University",
  "University of Brighton",
  "University of Kent",
  "Manchester Metropolitan University",
  "University of Surrey",
  "University of Aberdeen",
  "Royal Holloway, University of London",
  "London Metropolitan University",
  "St Mary's University, London",
  "Aston University",
  "Dublin City University",
  "Linnaeus University",
  "University of Skövde",
  "University West",
  "Kristianstad University",
  "Karlstad University",
  "Kyungdong University",
  "Woosong University",
  "Korean Bible University",
  "Namseoul University",
  "SRH University, Berlin Campus",
  "Berlin School of Business and Innovation (BSBI)",
  "Arden University Berlin Study Center",
  "Macromedia University of Applied Sciences",
  "University of Europe for Applied Sciences",
  "GISMA University of Applied Sciences",
  "Constructor University",
  "Bahçeşehir University",
  "Istanbul Aydın University",
  "Istanbul Kültür University",
  "İstinye University",
  "SRH Haarlem University of Applied Sciences",
  "Erasmus University Rotterdam",
  "Dalhousie University",
  "University of Victoria",
  "Northeastern University",
  "Cape Breton University",
  "University of New Brunswick",
  "Lakehead University",
  "Ontario Tech University",
  "Trent University",
  "Huron University",
  "TAR UMT (Tunku Abdul Rahman University of Management and Technology)",
  "Sunway University Malaysia",
  "Universiti Sains Malaysia (USM)",
  "APU, Asia Pacific University of Technology & Innovation",
  "UCSI University",
  "University of Wollongong Malaysia",
  "Lincoln University College, Malaysia",
  "Universiti Tun Abdul Razak (UNIRAZAK)",
  "University of Kuala Lumpur (UniKL)",
  "Swinburne University of Technology, Malaysia",
] as const;

describe("explore universities catalogue", () => {
  it("includes all 60 supplied institutions exactly once", () => {
    expect(exploreUniversities).toHaveLength(60);
    expect(REQUIRED_NAMES).toHaveLength(60);
    const names = exploreUniversities.map((u) => u.name);
    expect(new Set(names).size).toBe(60);
    for (const name of REQUIRED_NAMES) {
      expect(names).toContain(name);
    }
  });

  it("keeps Northeastern London and Northeastern University distinct", () => {
    const london = exploreUniversities.find((u) => u.name === "Northeastern University London");
    const canada = exploreUniversities.find((u) => u.name === "Northeastern University");
    expect(london?.id).not.toBe(canada?.id);
    expect(london?.country).toBe("United Kingdom");
    expect(canada?.country).toBe("Canada");
  });

  it("preserves Turkish and Swedish accents in names", () => {
    expect(exploreUniversities.some((u) => u.name === "Bahçeşehir University")).toBe(true);
    expect(exploreUniversities.some((u) => u.name === "Istanbul Aydın University")).toBe(true);
    expect(exploreUniversities.some((u) => u.name === "Istanbul Kültür University")).toBe(true);
    expect(exploreUniversities.some((u) => u.name === "İstinye University")).toBe(true);
    expect(exploreUniversities.some((u) => u.name === "University of Skövde")).toBe(true);
  });

  it("stores local logo assets for most institutions with text fallbacks for the rest", () => {
    const verified = exploreUniversitiesWithVerifiedLogos();
    const awaiting = exploreUniversitiesAwaitingLogos();
    expect(verified.length).toBeGreaterThanOrEqual(50);
    expect(verified.length + awaiting.length).toBe(60);
    expect(exploreUniversities.some((u) => u.name === "Korean Bible University")).toBe(true);
    expect(exploreUniversities.some((u) => u.name === "Sunway University Malaysia")).toBe(true);
  });

  it("splits into two non-empty carousel rows covering every entry", () => {
    const { rowA, rowB } = splitExploreUniversitiesForCarousel();
    expect(rowA.length + rowB.length).toBe(60);
    expect(rowA.length).toBeGreaterThan(0);
    expect(rowB.length).toBeGreaterThan(0);
  });
});
