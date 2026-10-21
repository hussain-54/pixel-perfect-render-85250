import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge, formatStatusLabel } from "./StatusBadge";

describe("StatusBadge", () => {
  it("humanizes fee statuses without inventing verification", () => {
    expect(formatStatusLabel("claimed")).toBe("Claimed");
    expect(formatStatusLabel("verified")).toBe("Verified");
    expect(formatStatusLabel("in_progress")).toBe("In Progress");
    expect(formatStatusLabel("Pending Review")).toBe("Pending Review");
  });

  it("renders claimed and verified as distinct labels", () => {
    const claimed = renderToStaticMarkup(createElement(StatusBadge, { status: "claimed" }));
    const verified = renderToStaticMarkup(createElement(StatusBadge, { status: "verified" }));
    expect(claimed).toContain("Claimed");
    expect(verified).toContain("Verified");
    expect(claimed).not.toContain("Verified");
  });
});
