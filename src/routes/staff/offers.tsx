import { createFileRoute } from "@tanstack/react-router";
import { OffersVisaWorkspace } from "@/components/portal/OffersVisaWorkspace";

export const Route = createFileRoute("/staff/offers")({
  component: StaffOffers,
});

function StaffOffers() {
  return <OffersVisaWorkspace />;
}