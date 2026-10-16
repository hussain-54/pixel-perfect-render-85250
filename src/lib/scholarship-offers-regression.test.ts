/**
 * Regression: offers.scholarship_note stays a free-text note on offers —
 * unrelated to the scholarships catalog table.
 */
import { describe, expect, it } from "vitest";
import { mapOfferRow } from "@/server/ao-data";
import type { OfferRow } from "@/types/database";

describe("offers.scholarship_note regression", () => {
  it("still maps scholarship_note as offer text without catalog coupling", () => {
    const row: OfferRow = {
      id: "offer-1",
      application_id: "app-1",
      student_id: "stu-1",
      offer_type: "unconditional",
      status: "accepted",
      offer_date: "2026-01-01",
      response_deadline: "2026-02-01",
      tuition_fee: "10000",
      scholarship_note: "50% tuition waiver noted by uni",
      created_by: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const mapped = mapOfferRow(row);
    expect(mapped.scholarshipNote).toBe("50% tuition waiver noted by uni");
    expect(mapped).not.toHaveProperty("scholarshipId");
  });
});
