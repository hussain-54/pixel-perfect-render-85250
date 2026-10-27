import { createFileRoute } from "@tanstack/react-router";
import { DocumentsQueue } from "@/components/portal/DocumentsQueue";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/documents")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "documents"),
  component: StaffDocuments,
});

function StaffDocuments() {
  return <DocumentsQueue />;
}
