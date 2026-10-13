import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./export-formats";
import {
  canExportReports,
  canViewHrEmployeeSummaries,
  canViewReportsPortal,
  formatMetricCount,
  inDateRange,
  isUnavailable,
  parseReportDateKey,
  registrationTrendByDay,
  reportSectionAccess,
  sanitizeSpreadsheetCell,
  signupFeeStatusBuckets,
  universityFeeByKindAndStatus,
  workloadByAssignee,
} from "./report-rules";

describe("report rules", () => {
  it("distinguishes unavailable from zero", () => {
    expect(formatMetricCount(null)).toBe("N/A");
    expect(formatMetricCount(0)).toBe("0");
    expect(isUnavailable(null)).toBe(true);
    expect(isUnavailable(0)).toBe(false);
  });

  it("filters by date range", () => {
    expect(parseReportDateKey("2026-03-15T10:00:00.000Z")).toBe("2026-03-15");
    expect(inDateRange("2026-03-15", "2026-03-01", "2026-03-31")).toBe(true);
    expect(inDateRange("2026-02-28", "2026-03-01", "2026-03-31")).toBe(false);
    expect(inDateRange(null, "2026-03-01", "2026-03-31")).toBe(false);
  });

  it("builds registration trends and workload", () => {
    const trend = registrationTrendByDay(
      ["2026-03-01", "2026-03-01", "2026-03-02", null],
      "2026-03-01",
      "2026-03-31",
    );
    expect(trend).toEqual([
      { date: "2026-03-01", count: 2 },
      { date: "2026-03-02", count: 1 },
    ]);
    expect(
      workloadByAssignee([
        { assigneeId: "a" },
        { assigneeId: "b" },
        { assigneeId: "a" },
        { assigneeId: null },
      ]),
    ).toEqual([
      { assigneeId: "a", count: 2 },
      { assigneeId: "b", count: 1 },
    ]);
  });

  it("never treats claimed signup fees as verified", () => {
    const b = signupFeeStatusBuckets(["claimed", "claimed", "verified", "rejected", "unpaid"]);
    expect(b.claimedAwaiting).toBe(2);
    expect(b.verified).toBe(1);
    expect(b.rejected).toBe(1);
  });

  it("keeps university fee kinds distinct", () => {
    const m = universityFeeByKindAndStatus([
      { kind: "tuition", status: "claimed" },
      { kind: "tuition", status: "verified" },
      { kind: "offer_deposit", status: "due" },
      { kind: "application_fee", status: "claimed" },
    ]);
    expect(m["tuition"]?.["claimed"]).toBe(1);
    expect(m["tuition"]?.["verified"]).toBe(1);
    expect(m["offer_deposit"]?.["due"]).toBe(1);
    expect(m["application_fee"]?.["claimed"]).toBe(1);
  });

  it("sanitizes spreadsheet formula injection", () => {
    expect(sanitizeSpreadsheetCell("=CMD()")).toBe("'=CMD()");
    expect(sanitizeSpreadsheetCell("+123")).toBe("'+123");
    expect(sanitizeSpreadsheetCell("-1+1")).toBe("'-1+1");
    expect(sanitizeSpreadsheetCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(sanitizeSpreadsheetCell("Normal Name")).toBe("Normal Name");
    // CSV export path must also neutralize formulas inside quoted cells
    expect(escapeCsvCell("=CMD()")).toBe('"\'=CMD()"');
    expect(escapeCsvCell("Safe")).toBe('"Safe"');
  });

  it("applies role restrictions for portal and sections", () => {
    expect(canViewReportsPortal({ appRole: "admin", businessRole: null })).toBe(true);
    expect(
      canViewReportsPortal({ appRole: "consultant", businessRole: "counsellor_consultant" }),
    ).toBe(true);
    expect(canExportReports({ appRole: "consultant", businessRole: "hr_system" })).toBe(true);

    const accounts = reportSectionAccess({
      appRole: "consultant",
      businessRole: "accounts_banking_finance",
    });
    expect(accounts.finance).toBe(true);
    expect(accounts.operations).toBe(false);
    expect(accounts.hr).toBe(true);

    expect(
      canViewHrEmployeeSummaries({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(canViewHrEmployeeSummaries({ appRole: "consultant", businessRole: "hr_system" })).toBe(
      true,
    );
  });
});
