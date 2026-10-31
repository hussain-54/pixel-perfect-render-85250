import { createFileRoute } from "@tanstack/react-router";
import { OffersVisaWorkspace } from "@/components/portal/OffersVisaWorkspace";
import { enforceSpecialtyStaffModuleBeforeLoad } from "@/lib/staff-specialty-before-load";
import { useCounsellorWorkbenchRealtime } from "@/lib/use-counsellor-workbench-realtime";
import {
  OFFERS_METRIC_TABS,
  OFFERS_PHASE_TABS,
  type OffersMetricTab,
  type OffersPhaseTab,
} from "@/types/offers-visa";

export type OffersSearch = {
  metric?: OffersMetricTab;
  phase?: OffersPhaseTab;
  q?: string;
  studentId?: string;
};

const METRIC_KEYS = new Set<string>(OFFERS_METRIC_TABS.map((t) => t.key));
const PHASE_KEYS = new Set<string>(OFFERS_PHASE_TABS.map((t) => t.key));

export const Route = createFileRoute("/staff/offers")({
  beforeLoad: ({ context }) => enforceSpecialtyStaffModuleBeforeLoad(context, "admissions"),
  validateSearch: (raw: Record<string, unknown>): OffersSearch => {
    const out: OffersSearch = {};
    const metric = raw["metric"];
    if (typeof metric === "string" && METRIC_KEYS.has(metric)) {
      out.metric = metric as OffersMetricTab;
    }
    const phase = raw["phase"];
    if (typeof phase === "string" && PHASE_KEYS.has(phase)) {
      out.phase = phase as OffersPhaseTab;
    }
    const q = raw["q"];
    if (typeof q === "string" && q.trim()) out.q = q.trim();
    const studentId = raw["studentId"];
    if (typeof studentId === "string" && studentId.trim()) {
      out.studentId = studentId.trim();
    }
    return out;
  },
  component: StaffOffers,
});

function StaffOffers() {
  const search = Route.useSearch();
  useCounsellorWorkbenchRealtime(true);
  return (
    <OffersVisaWorkspace
      {...(search.metric ? { initialMetric: search.metric } : {})}
      {...(search.phase ? { initialPhase: search.phase } : {})}
      {...(search.q ? { initialQ: search.q } : {})}
      {...(search.studentId ? { initialStudentId: search.studentId } : {})}
    />
  );
}
