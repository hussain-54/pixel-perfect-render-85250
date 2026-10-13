import { describe, expect, it } from "vitest";
import { nextJourneyStageIfAdvanced } from "./journey-stage";

describe("journey stage forward-only advances", () => {
  it("advances from handover shortlisting to application_submitted", () => {
    expect(nextJourneyStageIfAdvanced("university_shortlisting", "application_submitted")).toBe(
      "application_submitted",
    );
  });

  it("does not regress stages", () => {
    expect(nextJourneyStageIfAdvanced("offer_received", "application_submitted")).toBeNull();
    expect(nextJourneyStageIfAdvanced("application_submitted", "university_shortlisting")).toBeNull();
  });

  it("advances to offer_received from application_submitted", () => {
    expect(nextJourneyStageIfAdvanced("application_submitted", "offer_received")).toBe(
      "offer_received",
    );
  });
});
