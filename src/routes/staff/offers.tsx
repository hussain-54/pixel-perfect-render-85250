import { createFileRoute } from "@tanstack/react-router";
import { OffersVisaWorkspace } from "@/components/portal/OffersVisaWorkspace";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";

export const Route = createFileRoute("/staff/offers")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "admissions"),
  component: StaffOffers,
});

function StaffOffers() {
  return <OffersVisaWorkspace />;
}
