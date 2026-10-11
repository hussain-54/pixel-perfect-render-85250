import { createFileRoute } from "@tanstack/react-router";
import { DocumentsQueue } from "@/components/portal/DocumentsQueue";

export const Route = createFileRoute("/staff/documents")({
  component: StaffDocuments,
});

function StaffDocuments() {
  return <DocumentsQueue />;
}
