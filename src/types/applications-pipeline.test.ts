import { describe, expect, it } from "vitest";
import {
  applicationTerminalActions,
  canTransitionApplicationStage,
  isApplicationStageTarget,
  isTerminalOutcome,
} from "./applications-pipeline";

describe("application stage transitions (admission outcomes)", () => {
  it("keeps adjacent pipeline moves and allows reject/withdraw from pipeline stages", () => {
    expect(canTransitionApplicationStage("Under Review", "Ready to Submit")).toBe(true);
    expect(canTransitionApplicationStage("Under Review", "Submitted")).toBe(false);
    expect(canTransitionApplicationStage("Submitted", "Rejected")).toBe(true);
    expect(canTransitionApplicationStage("Docs Pending", "Withdrawn")).toBe(true);
    expect(canTransitionApplicationStage("Offer Received", "Rejected")).toBe(true);
  });

  it("blocks moves out of terminal outcomes", () => {
    expect(canTransitionApplicationStage("Rejected", "Submitted")).toBe(false);
    expect(canTransitionApplicationStage("Withdrawn", "Docs Pending")).toBe(false);
    expect(applicationTerminalActions("Rejected")).toEqual([]);
    expect(applicationTerminalActions("Ready to Submit")).toEqual(["Rejected", "Withdrawn"]);
  });

  it("recognizes stage targets", () => {
    expect(isTerminalOutcome("Rejected")).toBe(true);
    expect(isApplicationStageTarget("Offer Received")).toBe(true);
    expect(isApplicationStageTarget("bogus")).toBe(false);
  });
});
