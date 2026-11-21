import { describe, expect, it } from "vitest";
import {
  computeBooks,
  filterEntriesForTab,
  formatPkr,
  parseFinanceDeskTab,
  validateFinanceDeskWrite,
  type FinanceDeskEntry,
} from "./finance-desk";

describe("finance-desk helpers", () => {
  it("parses known tabs and defaults to statements", () => {
    expect(parseFinanceDeskTab("clients")).toBe("clients");
    expect(parseFinanceDeskTab("nope")).toBe("statements");
  });

  it("formats PKR amounts", () => {
    expect(formatPkr(1500)).toContain("1,500");
  });

  it("validates write input", () => {
    expect(validateFinanceDeskWrite({ kind: "petty-spend", title: "Tea", amount: 200 }).ok).toBe(
      true,
    );
    expect(validateFinanceDeskWrite({ kind: "", title: "Tea", amount: 200 }).ok).toBe(false);
  });

  it("filters drafts for approvals and kinds for area tabs", () => {
    const entries: FinanceDeskEntry[] = [
      {
        id: "1",
        kind: "petty-spend",
        title: "Tea",
        amount: 100,
        currency: "PKR",
        status: "draft",
        entryDate: "2026-11-08",
        detail: {},
        studentId: null,
        parentId: null,
        createdAt: "",
      },
      {
        id: "2",
        kind: "loan-draw",
        title: "Facility",
        amount: 5000,
        currency: "PKR",
        status: "posted",
        entryDate: "2026-11-08",
        detail: {},
        studentId: null,
        parentId: null,
        createdAt: "",
      },
    ];
    expect(filterEntriesForTab(entries, "approvals")).toHaveLength(1);
    expect(filterEntriesForTab(entries, "loans")).toHaveLength(1);
    expect(filterEntriesForTab(entries, "petty-cash")).toHaveLength(1);
  });

  it("computes a books snapshot from posted entries", () => {
    const books = computeBooks([
      {
        id: "1",
        kind: "receipt",
        title: "Fee receipt",
        amount: 1000,
        currency: "PKR",
        status: "posted",
        entryDate: "2026-11-08",
        detail: {},
        studentId: null,
        parentId: null,
        createdAt: "",
      },
      {
        id: "2",
        kind: "petty-spend",
        title: "Supplies",
        amount: 200,
        currency: "PKR",
        status: "posted",
        entryDate: "2026-11-08",
        detail: {},
        studentId: null,
        parentId: null,
        createdAt: "",
      },
    ]);
    expect(books.income).toBe(1000);
    expect(books.expenses).toBe(200);
    expect(books.profit).toBe(800);
  });
});
