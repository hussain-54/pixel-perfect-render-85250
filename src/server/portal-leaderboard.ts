/**
 * Admin consultant leaderboard — firm-wide counts from authorized Supabase rows.
 * No fake period multipliers. Metric null → "Not available".
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import {
  businessRoleFromSession,
  denyFrontDeskConsultantWorkflows,
  requireModulePermission,
} from "@/server/staff-access";
import { resolveBusinessRoleFromTrustedAppRole, type BusinessRole } from "@/lib/business-permissions";
import {
  attributeEventsToConsultants,
  buildLeaderboardRows,
  canViewConsultantLeaderboard,
  countByConsultantId,
  filterTimedConsultantEvents,
  isLeaderboardMetric,
  isLeaderboardPeriod,
  isSubmittedApplication,
  leaderboardMetricAttribution,
  metricIsPeriodAware,
  resolveLeaderboardWindow,
  type LeaderboardConsultant,
  type LeaderboardMetricBundle,
  type LeaderboardMetricKey,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "@/lib/leaderboard-rules";
import { mapConsultantDeskRow } from "@/lib/consultant-mappers";
import type { ServerSupabase } from "@/server/supabase";

function toError(error: unknown): never {
  if (error instanceof AuthError) {
    throw new Error(`${error.status}:${error.message}`);
  }
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

export type LeaderboardFilters = {
  period?: LeaderboardPeriod;
  metric?: LeaderboardMetricKey;
};

export type LeaderboardPayload = {
  rows: LeaderboardRow[];
  period: LeaderboardPeriod;
  metric: LeaderboardMetricKey;
  window: { start: string | null; end: string };
  periodApplies: boolean;
  attribution: string;
  source: "live" | "unavailable";
  note: string | null;
  metricAvailability: Record<LeaderboardMetricKey, "available" | "unavailable">;
};

async function resolveSessionBusinessRole(session: TrustedSession): Promise<BusinessRole | null> {
  const fromSession = businessRoleFromSession(session);
  if (fromSession) return fromSession;
  const mapped = resolveBusinessRoleFromTrustedAppRole(session.role);
  if (!session.userId || session.source !== "supabase") return mapped;
  try {
    const { requireAoSupabaseClient } = await import("@/server/ao-data");
    const client = requireAoSupabaseClient();
    const { data } = await client
      .from("profiles")
      .select("business_role")
      .eq("id", session.userId)
      .maybeSingle();
    if (data?.business_role) return data.business_role as BusinessRole;
  } catch {
    /* fall through */
  }
  return mapped;
}

function emptyBundle(): LeaderboardMetricBundle {
  return {
    students: null,
    appointmentsCompleted: null,
    applicationsSubmitted: null,
    offers: null,
    visaCases: null,
    completedCases: null,
  };
}

function availabilityFromBundle(
  bundle: LeaderboardMetricBundle,
): Record<LeaderboardMetricKey, "available" | "unavailable"> {
  return {
    students: bundle.students == null ? "unavailable" : "available",
    appointmentsCompleted: bundle.appointmentsCompleted == null ? "unavailable" : "available",
    applicationsSubmitted: bundle.applicationsSubmitted == null ? "unavailable" : "available",
    offers: bundle.offers == null ? "unavailable" : "available",
    visaCases: bundle.visaCases == null ? "unavailable" : "available",
    completedCases: bundle.completedCases == null ? "unavailable" : "available",
  };
}

async function loadConsultants(
  client: ServerSupabase,
): Promise<LeaderboardConsultant[]> {
  const { listConsultants } = await import("@/services/db");
  const desks = await listConsultants(client);
  if (!desks.length) return [];
  const ids = desks.map((d) => d.id);
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id,full_name,email")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  return desks.map((desk) => {
    const ui = mapConsultantDeskRow(desk, {
      profile: profileById.get(desk.id) ?? null,
      studentCount: 0,
    });
    return {
      id: ui.id,
      name: ui.name,
      department: ui.department,
      status: ui.status,
    };
  });
}

async function loadMetricBundle(
  client: ServerSupabase,
  consultantIds: string[],
  start: string | null,
  end: string,
): Promise<LeaderboardMetricBundle> {
  const bundle = emptyBundle();
  if (!consultantIds.length) {
    return {
      students: new Map(),
      appointmentsCompleted: new Map(),
      applicationsSubmitted: new Map(),
      offers: new Map(),
      visaCases: new Map(),
      completedCases: new Map(),
    };
  }

  const [
    studentsRes,
    completedRes,
    appointmentsRes,
    applicationsRes,
    offersRes,
    visasRes,
  ] = await Promise.all([
    client
      .from("students")
      .select("assigned_consultant_id")
      .is("archived_at", null)
      .in("assigned_consultant_id", consultantIds),
    client
      .from("students")
      .select("assigned_consultant_id")
      .is("archived_at", null)
      .eq("journey_stage", "completed")
      .in("assigned_consultant_id", consultantIds),
    client
      .from("appointments")
      .select("consultant_id,scheduled_at,status")
      .eq("status", "completed")
      .in("consultant_id", consultantIds),
    client
      .from("applications")
      .select("owned_by_consultant_id,stage,submitted_at,created_at")
      .in("owned_by_consultant_id", consultantIds),
    client.from("offers").select("id,application_id,student_id,offer_date,created_at"),
    client
      .from("visa_milestones")
      .select("id,student_id,application_id,filed_at,created_at"),
  ]);

  if (!studentsRes.error) {
    bundle.students = countByConsultantId(
      (studentsRes.data ?? []).map((r) => r.assigned_consultant_id),
    );
  }
  if (!completedRes.error) {
    bundle.completedCases = countByConsultantId(
      (completedRes.data ?? []).map((r) => r.assigned_consultant_id),
    );
  }
  if (!appointmentsRes.error) {
    bundle.appointmentsCompleted = filterTimedConsultantEvents(
      (appointmentsRes.data ?? []).map((r) => ({
        consultantId: r.consultant_id,
        dateRaw: r.scheduled_at,
      })),
      start,
      end,
    );
  }
  if (!applicationsRes.error) {
    const submitted = (applicationsRes.data ?? []).filter((r) =>
      isSubmittedApplication({ stage: r.stage, submittedAt: r.submitted_at }),
    );
    bundle.applicationsSubmitted = filterTimedConsultantEvents(
      submitted.map((r) => ({
        consultantId: r.owned_by_consultant_id,
        dateRaw: r.submitted_at ?? r.created_at,
      })),
      start,
      end,
    );
  }

  // Offers / visas need attribution maps (no consultant FK on those tables).
  const appIds = new Set<string>();
  const studentIds = new Set<string>();
  for (const o of offersRes.data ?? []) {
    if (o.application_id) appIds.add(o.application_id);
    if (o.student_id) studentIds.add(o.student_id);
  }
  for (const v of visasRes.data ?? []) {
    if (v.application_id) appIds.add(v.application_id);
    if (v.student_id) studentIds.add(v.student_id);
  }

  let appOwner = new Map<string, string | null>();
  let studentOwner = new Map<string, string | null>();

  if (!offersRes.error || !visasRes.error) {
    const appIdList = [...appIds];
    const studentIdList = [...studentIds];
    const [appOwnerRes, studentOwnerRes] = await Promise.all([
      appIdList.length
        ? client.from("applications").select("id,owned_by_consultant_id").in("id", appIdList)
        : Promise.resolve({ data: [] as { id: string; owned_by_consultant_id: string | null }[], error: null }),
      studentIdList.length
        ? client
            .from("students")
            .select("id,assigned_consultant_id")
            .in("id", studentIdList)
        : Promise.resolve({
            data: [] as { id: string; assigned_consultant_id: string | null }[],
            error: null,
          }),
    ]);

    if (!appOwnerRes.error) {
      appOwner = new Map(
        (appOwnerRes.data ?? []).map((r) => [r.id, r.owned_by_consultant_id]),
      );
    }
    if (!studentOwnerRes.error) {
      studentOwner = new Map(
        (studentOwnerRes.data ?? []).map((r) => [r.id, r.assigned_consultant_id]),
      );
    }
  }

  if (!offersRes.error) {
    const subjectToConsultant = new Map<string, string | null>();
    for (const o of offersRes.data ?? []) {
      const owner =
        (o.application_id ? appOwner.get(o.application_id) : null) ??
        (o.student_id ? studentOwner.get(o.student_id) : null) ??
        null;
      subjectToConsultant.set(o.id, owner);
    }
    bundle.offers = attributeEventsToConsultants(
      (offersRes.data ?? []).map((o) => ({
        subjectId: o.id,
        dateRaw: o.offer_date ?? o.created_at,
      })),
      subjectToConsultant,
      start,
      end,
    );
  }

  if (!visasRes.error) {
    const subjectToConsultant = new Map<string, string | null>();
    for (const v of visasRes.data ?? []) {
      const owner =
        (v.application_id ? appOwner.get(v.application_id) : null) ??
        (v.student_id ? studentOwner.get(v.student_id) : null) ??
        null;
      subjectToConsultant.set(v.id, owner);
    }
    bundle.visaCases = attributeEventsToConsultants(
      (visasRes.data ?? []).map((v) => ({
        subjectId: v.id,
        dateRaw: v.filed_at ?? v.created_at,
      })),
      subjectToConsultant,
      start,
      end,
    );
  }

  return bundle;
}

export const portalGetConsultantLeaderboard = createServerFn({ method: "GET" })
  .validator((data: LeaderboardFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<LeaderboardPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "consultant leaderboard");

      const businessRole = await resolveSessionBusinessRole(session);
      if (!canViewConsultantLeaderboard({ appRole: session.role, businessRole })) {
        throw new AuthError(
          "You do not have permission to view the firm consultant leaderboard.",
          403,
        );
      }

      // Firm-wide aggregates require students + reports view; matrix still enforced.
      await requireModulePermission(session, "reports", 1, "consultant leaderboard");
      await requireModulePermission(session, "students", 1, "consultant leaderboard");

      const period: LeaderboardPeriod = isLeaderboardPeriod(data.period) ? data.period : "month";
      const metric: LeaderboardMetricKey = isLeaderboardMetric(data.metric)
        ? data.metric
        : "students";
      const window = resolveLeaderboardWindow(period);
      const periodApplies = metricIsPeriodAware(metric);
      const attribution = leaderboardMetricAttribution(metric);

      const { usesSupabaseDataPlane, requireAoSupabaseClient } = await import("@/server/ao-data");
      if (!usesSupabaseDataPlane(session)) {
        return {
          rows: [],
          period,
          metric,
          window,
          periodApplies,
          attribution,
          source: "unavailable",
          note: "Consultant leaderboard requires the live data plane. Demo metrics are not shown.",
          metricAvailability: availabilityFromBundle(emptyBundle()),
        };
      }

      const client = requireAoSupabaseClient();
      let consultants: LeaderboardConsultant[] = [];
      try {
        consultants = await loadConsultants(client);
      } catch (e) {
        throw new AuthError(
          e instanceof Error ? e.message : "Could not load consultants.",
          500,
        );
      }

      if (!consultants.length) {
        return {
          rows: [],
          period,
          metric,
          window,
          periodApplies,
          attribution,
          source: "live",
          note: "No consultant desks found to rank.",
          metricAvailability: availabilityFromBundle({
            students: new Map(),
            appointmentsCompleted: new Map(),
            applicationsSubmitted: new Map(),
            offers: new Map(),
            visaCases: new Map(),
            completedCases: new Map(),
          }),
        };
      }

      // Period window for event metrics; snapshot metrics ignore start/end in builders.
      const eventStart = periodApplies ? window.start : null;
      const eventEnd = window.end;
      const bundle = await loadMetricBundle(
        client,
        consultants.map((c) => c.id),
        eventStart,
        eventEnd,
      );

      // Snapshot metrics always use unbounded loads already (no date filter in query).
      const rows = buildLeaderboardRows(consultants, bundle, metric);
      const unavailableCount = Object.values(availabilityFromBundle(bundle)).filter(
        (v) => v === "unavailable",
      ).length;

      return {
        rows,
        period,
        metric,
        window,
        periodApplies,
        attribution,
        source: "live",
        note:
          unavailableCount > 0
            ? `${unavailableCount} metric source(s) could not be loaded under current access; those show as Not available.`
            : periodApplies
              ? `Counts use ${window.start ?? "…"} → ${window.end}. Attribution: ${attribution}`
              : attribution,
        metricAvailability: availabilityFromBundle(bundle),
      };
    } catch (error) {
      toError(error);
    }
  });
