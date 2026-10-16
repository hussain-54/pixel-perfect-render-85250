import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import {
  PageHeader,
  Panel,
  TableWrap,
  EmptyState,
  portalErrorMessage,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  CATALOG_EXPORT_ENTITIES,
  CATALOG_IMPORT_ENTITIES,
  CRM_EXPORT_ENTITIES,
  validateImportFileMeta,
  type CatalogImportEntity,
  type CatalogImportPreviewPayload,
  type CrmExportEntity,
  type DuplicatePolicy,
} from "@/lib/crm-export";
import {
  commitCatalogImport,
  exportCrmCsv,
  previewCatalogImport,
} from "@/services";
import { downloadBase64File } from "@/lib/export-formats";

export const Route = createFileRoute("/admin/import-export")({
  component: AdminImportExport,
});

function AdminImportExport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyEntity, setBusyEntity] = useState<CrmExportEntity | null>(null);

  const [importEntity, setImportEntity] = useState<CatalogImportEntity>("universities");
  const [csvText, setCsvText] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [preview, setPreview] = useState<CatalogImportPreviewPayload | null>(null);
  const [duplicatePolicy, setDuplicatePolicy] = useState<DuplicatePolicy>("skip");
  const [confirmed, setConfirmed] = useState(false);

  const exportM = useMutation({
    mutationFn: exportCrmCsv,
    onSuccess: (payload) => {
      downloadBase64File(payload.filename, payload.mimeType, payload.contentBase64);
      setErr(null);
      setMsg(
        payload.rowCount === 0
          ? `Export ready: ${payload.filename} (0 rows — empty dataset).`
          : `Exported ${payload.rowCount} ${payload.entity} row(s) as ${payload.filename}.`,
      );
      setBusyEntity(null);
    },
    onError: (e) => {
      setMsg(null);
      setBusyEntity(null);
      setErr(portalErrorMessage(e, "Export failed."));
    },
  });

  const previewM = useMutation({
    mutationFn: previewCatalogImport,
    onSuccess: (payload) => {
      setPreview(payload);
      setConfirmed(false);
      setErr(null);
      setMsg(
        `Preview: ${payload.summary.ok} ready, ${payload.summary.duplicate} duplicate(s), ${payload.summary.error} error(s).`,
      );
    },
    onError: (e) => {
      setPreview(null);
      setMsg(null);
      setErr(portalErrorMessage(e, "Preview failed."));
    },
  });

  const commitM = useMutation({
    mutationFn: commitCatalogImport,
    onSuccess: (result) => {
      setErr(null);
      setMsg(
        `Import complete (${result.entity}): ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed.`,
      );
      setPreview(null);
      setCsvText(null);
      setFileLabel(null);
      setConfirmed(false);
    },
    onError: (e) => {
      setMsg(null);
      setErr(portalErrorMessage(e, "Import failed."));
    },
  });

  const resetImport = () => {
    setCsvText(null);
    setFileLabel(null);
    setPreview(null);
    setConfirmed(false);
    setErr(null);
  };

  const otherExports = CRM_EXPORT_ENTITIES.filter(
    (e) => e !== "universities" && e !== "programs",
  );

  return (
    <div>
      <PageHeader
        title="Import / Export"
        subtitle="Authorized CSV for universities and programs. Preview and confirm before writing. Student bulk import is not available."
      />
      {msg ? (
        <p
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
          role="status"
        >
          {msg}
        </p>
      ) : null}
      {err ? (
        <p
          className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Export catalog">
          <p className="text-sm text-muted-foreground">
            Download UTF-8 CSV (Excel-safe BOM). Cells that look like formulas are escaped.
            Empty catalogs still download a header-only file.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATALOG_EXPORT_ENTITIES.map((entity) => (
              <Button
                key={entity}
                type="button"
                variant="navy"
                disabled={exportM.isPending}
                aria-label={`Export ${entity}`}
                onClick={() => {
                  setBusyEntity(entity);
                  setErr(null);
                  exportM.mutate(entity);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {exportM.isPending && busyEntity === entity
                  ? "Exporting…"
                  : entity.charAt(0).toUpperCase() + entity.slice(1)}
              </Button>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium text-navy">Other CRM exports (admin)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {otherExports.map((entity) => (
              <Button
                key={entity}
                type="button"
                variant="secondary"
                size="sm"
                disabled={exportM.isPending}
                aria-label={`Export ${entity}`}
                onClick={() => {
                  setBusyEntity(entity);
                  setErr(null);
                  exportM.mutate(entity);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {exportM.isPending && busyEntity === entity
                  ? "…"
                  : entity.charAt(0).toUpperCase() + entity.slice(1)}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel title="Import catalog">
          <p className="text-sm text-muted-foreground">
            Upload CSV → preview validation & duplicates → confirm. Default policy skips existing
            rows (no silent overwrite).
          </p>
          <label className="mt-3 block text-xs font-medium text-navy" htmlFor="import-entity">
            Entity
          </label>
          <select
            id="import-entity"
            className="mt-1 h-9 w-full max-w-xs rounded-md border border-border bg-background px-2 text-sm"
            value={importEntity}
            onChange={(e) => {
              setImportEntity(e.target.value as CatalogImportEntity);
              resetImport();
            }}
          >
            {CATALOG_IMPORT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            {importEntity === "universities" ? (
              <>
                Columns: <code className="text-[0.7rem]">name,country,city,website</code>. Unique
                key: name + country.
              </>
            ) : (
              <>
                Columns:{" "}
                <code className="text-[0.7rem]">
                  university_name,university_country,name,level,duration,tuition_fee
                </code>
                . Unique key: university + program name.
              </>
            )}
          </p>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-label={`${importEntity} CSV file`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const meta = validateImportFileMeta({
                name: file.name,
                size: file.size,
                type: file.type,
              });
              if (!meta.ok) {
                setErr(meta.error);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const text = typeof reader.result === "string" ? reader.result : "";
                setCsvText(text);
                setFileLabel(file.name);
                setPreview(null);
                setConfirmed(false);
                setErr(null);
                setMsg(`Loaded ${file.name} (${Math.round(file.size / 1024)} KB). Run preview.`);
              };
              reader.onerror = () => setErr("Could not read the selected file.");
              reader.readAsText(file);
            }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={previewM.isPending || commitM.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose CSV
            </Button>
            <Button
              type="button"
              variant="navy"
              disabled={!csvText || previewM.isPending || commitM.isPending}
              onClick={() => {
                if (!csvText) return;
                setErr(null);
                previewM.mutate({ entity: importEntity, csvText });
              }}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {previewM.isPending ? "Previewing…" : "Preview"}
            </Button>
            {fileLabel || preview ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetImport}>
                Clear
              </Button>
            ) : null}
          </div>
          {fileLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">Selected: {fileLabel}</p>
          ) : null}
        </Panel>
      </div>

      {preview ? (
        <div className="mt-6 space-y-4">
          <Panel title="Import preview">
            <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
              <p>
                Ready: <strong>{preview.summary.ok}</strong>
              </p>
              <p>
                Duplicates: <strong>{preview.summary.duplicate}</strong>
              </p>
              <p>
                Errors: <strong>{preview.summary.error}</strong>
              </p>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{preview.transactionNote}</p>

            <fieldset className="mb-3 space-y-2 text-sm">
              <legend className="text-xs font-medium text-navy">Duplicate rows</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dup-policy"
                  checked={duplicatePolicy === "skip"}
                  onChange={() => setDuplicatePolicy("skip")}
                />
                Skip duplicates (recommended — no overwrite)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="dup-policy"
                  checked={duplicatePolicy === "update"}
                  onChange={() => setDuplicatePolicy("update")}
                />
                Update duplicates (explicit overwrite of matching rows)
              </label>
            </fieldset>

            <label className="mb-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                I confirm this import will write to the live catalog using the selected duplicate
                policy.
              </span>
            </label>

            <Button
              type="button"
              variant="navy"
              disabled={
                !confirmed ||
                !csvText ||
                commitM.isPending ||
                (preview.summary.ok === 0 &&
                  !(duplicatePolicy === "update" && preview.summary.duplicate > 0))
              }
              onClick={() => {
                if (!csvText || !confirmed) return;
                if (
                  !window.confirm(
                    `Commit ${importEntity} import?\nPolicy: ${duplicatePolicy}\nReady: ${preview.summary.ok}, duplicates: ${preview.summary.duplicate}`,
                  )
                ) {
                  return;
                }
                commitM.mutate({
                  entity: importEntity,
                  csvText,
                  duplicatePolicy,
                  confirmed: true,
                });
              }}
            >
              {commitM.isPending ? "Importing…" : "Confirm & import"}
            </Button>
          </Panel>

          {!preview.rows.length ? (
            <EmptyState title="No rows" body="Preview returned no data rows." />
          ) : (
            <div className="overflow-x-auto">
              <TableWrap>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th>Status</th>
                    {preview.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 100).map((r) => (
                    <tr
                      key={r.line}
                      className={
                        r.status === "error"
                          ? "bg-destructive/5"
                          : r.status === "duplicate"
                            ? "bg-amber-50"
                            : undefined
                      }
                    >
                      <td>{r.line}</td>
                      <td className="text-xs font-medium">{r.status}</td>
                      {r.cells.map((c, i) => (
                        <td key={i} className="max-w-[10rem] truncate text-xs">
                          {c || "—"}
                        </td>
                      ))}
                      <td className="text-xs text-muted-foreground">{r.error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {preview.rows.length > 100 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first 100 of {preview.rows.length} preview rows.
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
