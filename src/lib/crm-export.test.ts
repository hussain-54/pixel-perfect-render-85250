import { describe, expect, it } from "vitest";
import {
  buildCrmCsv,
  crmExportFilename,
  isCrmExportEntity,
  isFormulaInjectionRisk,
  parseUniversityImportCsv,
  previewProgramImportCsv,
  previewUniversityImportCsv,
  splitCsvLine,
  validateImportFileMeta,
} from "./crm-export";
import { escapeCsvCell } from "./export-formats";

describe("CRM export / catalog import helpers", () => {
  it("recognizes supported export entities", () => {
    expect(isCrmExportEntity("students")).toBe(true);
    expect(isCrmExportEntity("universities")).toBe(true);
    expect(isCrmExportEntity("programs")).toBe(true);
    expect(isCrmExportEntity("scholarships")).toBe(false);
    expect(crmExportFilename("leads", "2026-10-16T12:00:00.000Z")).toBe(
      "global-roots-leads-2026-10-16.csv",
    );
  });

  it("builds BOM CSV, escapes quotes, and splits quoted cells", () => {
    const csv = buildCrmCsv(["a", "b"], [["1", "x,y"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"x,y"');
    expect(splitCsvLine('"Hello, world",UK')).toEqual(["Hello, world", "UK"]);
  });

  it("guards spreadsheet formula injection in export cells", () => {
    expect(isFormulaInjectionRisk("=cmd()")).toBe(true);
    expect(isFormulaInjectionRisk("+123")).toBe(true);
    expect(isFormulaInjectionRisk("-1+1")).toBe(true);
    expect(isFormulaInjectionRisk("@sum")).toBe(true);
    expect(isFormulaInjectionRisk("Normal University")).toBe(false);
    expect(escapeCsvCell("=1+1")).toBe("\"'=1+1\"");
  });

  it("validates import file metadata", () => {
    expect(validateImportFileMeta({ name: "u.csv", size: 100, type: "text/csv" }).ok).toBe(true);
    expect(validateImportFileMeta({ name: "u.txt", size: 100 }).ok).toBe(false);
    expect(validateImportFileMeta({ name: "u.csv", size: 0 }).ok).toBe(false);
    expect(validateImportFileMeta({ name: "u.csv", size: 999_999 }).ok).toBe(false);
  });

  it("previews university import with row-level errors", () => {
    const ok = previewUniversityImportCsv("name,country,city\nTest U,UK,London\n");
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.summary.ok).toBe(1);
      expect(ok.rows[0]?.university).toEqual({
        name: "Test U",
        country: "UK",
        city: "London",
        website: null,
      });
    }
    const bad = previewUniversityImportCsv("name,country\n,UK\n");
    expect(bad.ok).toBe(true);
    if (bad.ok) {
      expect(bad.summary.error).toBe(1);
    }
    expect(previewUniversityImportCsv("name,city\nA,B").ok).toBe(false);
  });

  it("rejects invalid website on university preview", () => {
    const bad = previewUniversityImportCsv("name,country,website\nTest U,UK,javascript:alert(1)\n");
    expect(bad.ok).toBe(true);
    if (bad.ok) {
      expect(bad.rows[0]?.status).toBe("error");
    }
  });

  it("previews program import CSV", () => {
    const ok = previewProgramImportCsv(
      "university_name,university_country,name,level\nTest U,UK,CS,Bachelor's\n",
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.rows[0]?.program?.name).toBe("CS");
    }
    expect(previewProgramImportCsv("name,level\nCS,BA").ok).toBe(false);
  });

  it("legacy parseUniversityImportCsv fails closed on any bad row", () => {
    expect(parseUniversityImportCsv("name,country\n,UK").ok).toBe(false);
    expect(parseUniversityImportCsv("name,country\nTest U,UK\n").ok).toBe(true);
  });
});
