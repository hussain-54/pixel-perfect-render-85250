import { createFileRoute } from "@tanstack/react-router";
import { DocumentsQueue } from "@/components/portal/DocumentsQueue";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";
import {
  DOCUMENT_QUEUE_TABS,
  type DocumentQueueTab,
} from "@/types/documents-queue";

export type DocumentsSearch = {
  tab?: DocumentQueueTab;
  q?: string;
  studentId?: string;
};

const TAB_KEYS = new Set<string>(DOCUMENT_QUEUE_TABS.map((t) => t.key));

export const Route = createFileRoute("/staff/documents")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "documents"),
  validateSearch: (raw: Record<string, unknown>): DocumentsSearch => {
    const out: DocumentsSearch = {};
    const tab = raw["tab"];
    if (typeof tab === "string" && TAB_KEYS.has(tab)) {
      out.tab = tab as DocumentQueueTab;
    }
    const q = raw["q"];
    if (typeof q === "string" && q.trim()) out.q = q.trim();
    const studentId = raw["studentId"];
    if (typeof studentId === "string" && studentId.trim()) {
      out.studentId = studentId.trim();
    }
    return out;
  },
  component: StaffDocuments,
});

function StaffDocuments() {
  const search = Route.useSearch();
  useCounsellorWorkbenchRealtime(true);
  return (
    <DocumentsQueue
      {...(search.tab ? { initialTab: search.tab } : {})}
      {...(search.q ? { initialQ: search.q } : {})}
      {...(search.studentId ? { initialStudentId: search.studentId } : {})}
    />
  );
}
