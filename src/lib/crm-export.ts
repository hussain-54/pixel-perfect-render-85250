/**
 * Pure CSV helpers for admin Import/Export (authorized server lists only).
 * Catalog import: universities + programs. No silent overwrite by default.
 */
import { toExcelCsv } from "./export-formats";
import { sanitizeSpreadsheetCell } from "./report-rules";

export type CrmExportEntity =
  | "students"
  | "leads"
  | "applications"
  | "universities"
  | "programs";

export type CatalogImportEntity = "universities" | "programs";

export const CRM_EXPORT_ENTITIES: readonly CrmExportEntity[] = [
  "students",
  "leads",
  "applications",
  "universities",
  "programs",
] as const;

/** Primary catalog entities for the Import/Export workspace. */
export const CATALOG_IMPORT_ENTITIES: readonly CatalogImportEntity[] = [
  "universities",
  "programs",
] as const;

export const CATALOG_EXPORT_ENTITIES: readonly CatalogImportEntity[] = [
  "universities",
  "programs",
] as const;

export const MAX_IMPORT_BYTES = 512_000;
export const MAX_IMPORT_ROWS = 200;

export type DuplicatePolicy = "skip" | "update";

export function isCrmExportEntity(value: string): value is CrmExportEntity {
  return (CRM_EXPORT_ENTITIES as readonly string[]).includes(value);
}

export function isCatalogImportEntity(value: string): value is CatalogImportEntity {
  return (CATALOG_IMPORT_ENTITIES as readonly string[]).includes(value);
}

export function isDuplicatePolicy(value: string): value is DuplicatePolicy {
  return value === "skip" || value === "update";
}

export function buildCrmCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return toExcelCsv([headers, ...rows]);
}

export function crmExportFilename(entity: CrmExportEntity, iso = new Date().toISOString()): string {
  return `global-roots-${entity}-${iso.slice(0, 10)}.csv`;
}

/** Minimal CSV line splitter (handles quoted commas). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function validateImportFileMeta(input: {
  name: string;
  size: number;
  type?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, error: "Only .csv files are accepted." };
  }
  if (input.size <= 0) return { ok: false, error: "The selected file is empty." };
  if (input.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: `File is too large (max ${Math.floor(MAX_IMPORT_BYTES / 1024)} KB).`,
    };
  }
  const t = (input.type ?? "").toLowerCase();
  if (t && t !== "text/csv" && t !== "application/vnd.ms-excel" && t !== "application/csv" && t !== "text/plain") {
    return { ok: false, error: "File type must be CSV (text/csv)." };
  }
  return { ok: true };
}

export type UniversityImportRow = {
  name: string;
  country: string;
  city: string | null;
  website: string | null;
};

export type ProgramImportRow = {
  universityName: string;
  universityCountry: string;
  name: string;
  level: string | null;
  duration: string | null;
  tuitionFee: string | null;
};

export type CatalogImportPreviewRow = {
  line: number;
  status: "ok" | "error" | "duplicate";
  error?: string;
  /** Display cells for preview table */
  cells: string[];
  university?: UniversityImportRow;
  program?: ProgramImportRow;
};

export type CatalogImportPreviewPayload = {
  entity: CatalogImportEntity;
  headers: string[];
  rows: CatalogImportPreviewRow[];
  summary: {
    ok: number;
    error: number;
    duplicate: number;
  };
  transactionNote: string;
};

function headerIndex(header: string[], aliases: string[]): number {
  for (const a of aliases) {
    const i = header.indexOf(a);
    if (i >= 0) return i;
  }
  return -1;
}

function parseCsvTable(text: string): {
  ok: true;
  header: string[];
  lines: string[];
} | {
  ok: false;
  error: string;
} {
  const raw = text.replace(/^\uFEFF/, "");
  if (raw.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: `CSV exceeds ${Math.floor(MAX_IMPORT_BYTES / 1024)} KB limit.` };
  }
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "CSV must include a header row and at least one data row." };
  }
  if (lines.length - 1 > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Import is limited to ${MAX_IMPORT_ROWS} data rows per file.` };
  }
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  return { ok: true, header, lines };
}

function optionalUrl(value: string | null): string | null | "invalid" {
  if (value == null || value === "") return null;
  if (!/^https?:\/\//i.test(value)) return "invalid";
  return value;
}

/** Parse + per-row validate universities CSV (no DB). */
export function previewUniversityImportCsv(text: string): {
  ok: true;
  headers: string[];
  rows: CatalogImportPreviewRow[];
  summary: { ok: number; error: number };
} | {
  ok: false;
  error: string;
} {
  const table = parseCsvTable(text);
  if (!table.ok) return table;
  const { header, lines } = table;
  const nameIdx = headerIndex(header, ["name", "university", "university_name"]);
  const countryIdx = headerIndex(header, ["country"]);
  if (nameIdx < 0 || countryIdx < 0) {
    return { ok: false, error: "CSV header must include name and country columns." };
  }
  const cityIdx = headerIndex(header, ["city"]);
  const websiteIdx = headerIndex(header, ["website", "url"]);
  const displayHeaders = ["name", "country", "city", "website"];
  const rows: CatalogImportPreviewRow[] = [];
  let okCount = 0;
  let errCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const cols = splitCsvLine(lines[i]!);
    const name = (cols[nameIdx] ?? "").trim();
    const country = (cols[countryIdx] ?? "").trim();
    const city = cityIdx >= 0 ? (cols[cityIdx] ?? "").trim() || null : null;
    const websiteRaw = websiteIdx >= 0 ? (cols[websiteIdx] ?? "").trim() || null : null;
    const website = optionalUrl(websiteRaw);

    if (!name || !country) {
      errCount += 1;
      rows.push({
        line,
        status: "error",
        error: "name and country are required",
        cells: [name, country, city ?? "", websiteRaw ?? ""],
      });
      continue;
    }
    if (name.length > 200 || country.length > 100) {
      errCount += 1;
      rows.push({
        line,
        status: "error",
        error: "name or country is too long",
        cells: [name, country, city ?? "", websiteRaw ?? ""],
      });
      continue;
    }
    if (website === "invalid") {
      errCount += 1;
      rows.push({
        line,
        status: "error",
        error: "website must start with http:// or https://",
        cells: [name, country, city ?? "", websiteRaw ?? ""],
      });
      continue;
    }
    okCount += 1;
    rows.push({
      line,
      status: "ok",
      cells: [name, country, city ?? "", website ?? ""],
      university: { name, country, city, website },
    });
  }

  return {
    ok: true,
    headers: displayHeaders,
    rows,
    summary: { ok: okCount, error: errCount },
  };
}

/** Parse + per-row validate programs CSV (no DB). */
export function previewProgramImportCsv(text: string): {
  ok: true;
  headers: string[];
  rows: CatalogImportPreviewRow[];
  summary: { ok: number; error: number };
} | {
  ok: false;
  error: string;
} {
  const table = parseCsvTable(text);
  if (!table.ok) return table;
  const { header, lines } = table;
  const uniNameIdx = headerIndex(header, [
    "university_name",
    "university",
    "uni_name",
  ]);
  const uniCountryIdx = headerIndex(header, ["university_country", "country"]);
  const nameIdx = headerIndex(header, ["name", "program", "program_name"]);
  if (uniNameIdx < 0 || uniCountryIdx < 0 || nameIdx < 0) {
    return {
      ok: false,
      error:
        "CSV header must include university_name, university_country (or country), and name columns.",
    };
  }
  const levelIdx = headerIndex(header, ["level"]);
  const durationIdx = headerIndex(header, ["duration"]);
  const tuitionIdx = headerIndex(header, ["tuition_fee", "tuition", "tuitionfee"]);
  const displayHeaders = [
    "university_name",
    "university_country",
    "name",
    "level",
    "duration",
    "tuition_fee",
  ];
  const rows: CatalogImportPreviewRow[] = [];
  let okCount = 0;
  let errCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = i + 1;
    const cols = splitCsvLine(lines[i]!);
    const universityName = (cols[uniNameIdx] ?? "").trim();
    const universityCountry = (cols[uniCountryIdx] ?? "").trim();
    const name = (cols[nameIdx] ?? "").trim();
    const level = levelIdx >= 0 ? (cols[levelIdx] ?? "").trim() || null : null;
    const duration = durationIdx >= 0 ? (cols[durationIdx] ?? "").trim() || null : null;
    const tuitionFee = tuitionIdx >= 0 ? (cols[tuitionIdx] ?? "").trim() || null : null;

    if (!universityName || !universityCountry || !name) {
      errCount += 1;
      rows.push({
        line,
        status: "error",
        error: "university_name, university_country and name are required",
        cells: [universityName, universityCountry, name, level ?? "", duration ?? "", tuitionFee ?? ""],
      });
      continue;
    }
    if (name.length > 200 || universityName.length > 200) {
      errCount += 1;
      rows.push({
        line,
        status: "error",
        error: "name is too long",
        cells: [universityName, universityCountry, name, level ?? "", duration ?? "", tuitionFee ?? ""],
      });
      continue;
    }
    okCount += 1;
    rows.push({
      line,
      status: "ok",
      cells: [universityName, universityCountry, name, level ?? "", duration ?? "", tuitionFee ?? ""],
      program: {
        universityName,
        universityCountry,
        name,
        level,
        duration,
        tuitionFee,
      },
    });
  }

  return {
    ok: true,
    headers: displayHeaders,
    rows,
    summary: { ok: okCount, error: errCount },
  };
}

/** @deprecated Prefer previewUniversityImportCsv — kept for older call sites. */
export function parseUniversityImportCsv(text: string): {
  ok: true;
  rows: UniversityImportRow[];
} | {
  ok: false;
  error: string;
} {
  const preview = previewUniversityImportCsv(text);
  if (!preview.ok) return preview;
  if (preview.summary.error > 0) {
    const first = preview.rows.find((r) => r.status === "error");
    return {
      ok: false,
      error: first ? `Row ${first.line}: ${first.error}` : "CSV contains invalid rows.",
    };
  }
  return {
    ok: true,
    rows: preview.rows
      .filter((r) => r.status === "ok" && r.university)
      .map((r) => r.university!),
  };
}

/** Formula-injection guard used by export cells (via export-formats). */
export function isFormulaInjectionRisk(value: string): boolean {
  return /^[=+\-@\t\r]/.test(value);
}

export function guardExportCell(value: string | number | null | undefined): string {
  return sanitizeSpreadsheetCell(value);
}
