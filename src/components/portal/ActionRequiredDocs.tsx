import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtDate } from "@/components/common";
import type { StudentDocument } from "@/types";

const ACTION_STATUSES = new Set(["Needs Correction", "Rejected"]);

export function isActionRequired(doc: StudentDocument) {
  return ACTION_STATUSES.has(doc.status);
}

export function filterActionRequired(docs: StudentDocument[]) {
  return docs.filter(isActionRequired);
}

export function ActionRequiredBanner({
  docs,
  uploadLink = "/student/documents",
}: {
  docs: StudentDocument[];
  uploadLink?: "/student/documents";
}) {
  const urgent = filterActionRequired(docs);
  if (!urgent.length) return null;

  return (
    <div className="mb-6 rounded-lg border-2 border-warning bg-warning-soft p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wider text-navy">Action required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {urgent.length} document{urgent.length > 1 ? "s need" : " needs"} your attention before
            we can proceed.
          </p>
          <ul className="mt-4 space-y-3">
            {urgent.map((d) => (
              <li key={d.id} className="rounded-md border border-warning/40 bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-navy">{d.name}</span>
                  <StatusBadge status={d.status} />
                </div>
                {d.comment && <p className="mt-2 text-sm text-muted-foreground">{d.comment}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.category} · Uploaded {fmtDate(d.uploaded)}
                  {d.reviewer ? ` · Reviewer: ${d.reviewer}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {uploadLink && (
            <Link
              to={uploadLink}
              className="mt-4 inline-block text-sm font-semibold text-royal hover:underline"
            >
              Review all documents →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
