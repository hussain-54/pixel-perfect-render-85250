import { describe, expect, it } from "vitest";
import { DOCUMENT_QUEUE_TABS } from "@/types/documents-queue";
import { OFFERS_METRIC_TABS } from "@/types/offers-visa";

describe("Admission workspace metric tabs", () => {
  it("includes Missing in the documents queue", () => {
    expect(DOCUMENT_QUEUE_TABS.map((t) => t.key)).toEqual([
      "pending",
      "approved",
      "rejected",
      "missing",
      "expiring",
    ]);
  });

  it("includes CAS confirmation and Decisions on offers metrics", () => {
    expect(OFFERS_METRIC_TABS.map((t) => t.key)).toEqual([
      "offers_received",
      "conditions_pending",
      "deposits_due",
      "cas_confirmation_pending",
      "visa_in_progress",
      "decisions",
    ]);
  });
});
