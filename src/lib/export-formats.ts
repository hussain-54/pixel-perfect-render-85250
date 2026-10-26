/** Lightweight CSV / Excel-compatible CSV / text PDF exports (no extra deps). */

import { sanitizeSpreadsheetCell } from "@/lib/report-rules";

function utf8ToBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

export function escapeCsvCell(value: string | number | null | undefined): string {
  const s = sanitizeSpreadsheetCell(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Excel opens UTF-8 CSV reliably with a BOM. */
export function toExcelCsv(rows: (string | number | null | undefined)[][]): string {
  return `\uFEFF${toCsv(rows)}`;
}

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export type SimplePdfPageSize = "letter" | "a4";

/** Minimal multi-page text PDF (PDF 1.4) for audit/report dumps and fee vouchers. */
export function toSimplePdf(
  title: string,
  lines: string[],
  opts?: { pageSize?: SimplePdfPageSize },
): string {
  const pageSize = opts?.pageSize ?? "letter";
  // ISO A4 = 595.28 × 841.89 pt; US Letter = 612 × 792.
  const mediaBox = pageSize === "a4" ? "[0 0 595 842]" : "[0 0 612 792]";
  const startY = pageSize === "a4" ? 800 : 780;
  const maxWidth = pageSize === "a4" ? 86 : 90;
  const wrapped: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\r/g, "");
    if (line.length <= maxWidth) {
      wrapped.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > maxWidth) {
      wrapped.push(rest.slice(0, maxWidth));
      rest = rest.slice(maxWidth);
    }
    if (rest) wrapped.push(rest);
  }

  const linesPerPage = pageSize === "a4" ? 52 : 48;
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += linesPerPage)
    pages.push(wrapped.slice(i, i + linesPerPage));
  if (!pages.length) pages.push(["(empty)"]);

  const bodies: string[] = [];
  bodies.push("<< /Type /Catalog /Pages 2 0 R >>");
  bodies.push(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((pageLines, i) => {
    const contentObj = 3 + i * 2 + 1;
    const textOps = [
      "BT",
      "/F1 10 Tf",
      `50 ${startY} Td`,
      "14 TL",
      `(${pdfEscape(i === 0 ? title : `${title} (cont.)`)}) Tj`,
      "T*",
      ...pageLines.map((l) => `(${pdfEscape(l)}) Tj T*`),
      "ET",
    ].join("\n");
    bodies.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /Contents ${contentObj} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`,
    );
    bodies.push(
      `<< /Length ${Buffer.byteLength(textOps, "utf8")} >>\nstream\n${textOps}\nendstream`,
    );
  });

  const rebuilt: string[] = ["%PDF-1.4"];
  const off: number[] = [0];
  for (let i = 0; i < bodies.length; i++) {
    off.push(Buffer.byteLength(rebuilt.join("\n"), "utf8") + 1);
    rebuilt.push(`${i + 1} 0 obj\n${bodies[i]}\nendobj`);
  }
  const xrefStart = Buffer.byteLength(rebuilt.join("\n"), "utf8") + 1;
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= bodies.length; i++) {
    xref += `${String(off[i]).padStart(10, "0")} 00000 n \n`;
  }
  rebuilt.push(xref);
  rebuilt.push(
    `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`,
  );
  return rebuilt.join("\n");
}

export function encodeExport(
  format: "csv" | "excel" | "pdf",
  filenameBase: string,
  csvRows: (string | number | null | undefined)[][],
  pdfLines: string[],
  pdfTitle: string,
  opts?: { pdfPageSize?: SimplePdfPageSize },
): { filename: string; mimeType: string; contentBase64: string } {
  if (format === "pdf") {
    return {
      filename: `${filenameBase}.pdf`,
      mimeType: "application/pdf",
      contentBase64: utf8ToBase64(
        toSimplePdf(pdfTitle, pdfLines, { pageSize: opts?.pdfPageSize ?? "letter" }),
      ),
    };
  }
  if (format === "excel") {
    return {
      filename: `${filenameBase}.csv`,
      mimeType: "text/csv;charset=utf-8",
      contentBase64: utf8ToBase64(toExcelCsv(csvRows)),
    };
  }
  return {
    filename: `${filenameBase}.csv`,
    mimeType: "text/csv;charset=utf-8",
    contentBase64: utf8ToBase64(toCsv(csvRows)),
  };
}

/** Browser helper — decode server base64 export and trigger download. */
export function downloadBase64File(filename: string, mimeType: string, contentBase64: string) {
  const bin = atob(contentBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
