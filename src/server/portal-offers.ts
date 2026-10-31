/**
 * Offers & Visa management — validated workflows only (no free-form status edits).
 * Offer / deposit / CAS-I20 / visa fields stay distinct. No payment or embassy integrations.
 */
import { createServerFn } from "@tanstack/react-start";
import * as db from "@/data/mock";
import {
  appendOfferAudit,
  casForOffer,
  casI20Records,
  conditionsForOffer,
  depositForOffer,
  depositRecords,
  offerAuditHistory,
  offerConditions,
  offerRecords,
  visaForApplication,
  visaMilestones,
} from "@/data/offers-visa";
import { rolesAtLeastAdmin } from "@/lib/roles";
import {
  AuthError,
  requireRoles,
  requireTrustedSession,
  type TrustedSession,
} from "@/server/portal-auth";
import { denyFrontDeskConsultantWorkflows, requireModulePermission } from "@/server/staff-access";
import type { Application, Student } from "@/types";
import type { DepositStatus, OfferStatus, VisaDecision, VisaStage } from "@/types/database";
import {
  CAS_I20_STATUS_LABELS,
  DEPOSIT_STATUS_LABELS,
  OFFER_DEADLINE_ALERT_DAYS,
  OFFER_STATUS_LABELS,
  VISA_STAGE_LABELS,
  casI20TypeForCountry,
  nextCasI20Status,
  nextVisaStage,
  type AcceptOfferInput,
  type AdvanceCasI20Input,
  type AdvanceVisaInput,
  type CasI20Record,
  type CasI20RowView,
  type DeclineOfferInput,
  type DepositRecord,
  type DepositRowView,
  type ExportSummaryPayload,
  type NewOfferInput,
  type OfferConditionRecord,
  type OfferDetailPayload,
  type OfferRecord,
  type OfferRowView,
  type OffersMetricTab,
  type OffersPhaseTab,
  type OffersVisaFilters,
  type OffersVisaPayload,
  type RecordDepositPaidInput,
  type SetConditionMetInput,
  type VisaMilestoneRecord,
  type VisaRowView,
} from "@/types/offers-visa";

function toError(error: unknown): never {
  if (error instanceof AuthError) throw new Error(`${error.status}:${error.message}`);
  throw error instanceof Error ? error : new Error("Authorization failed.");
}

function consultantScopeId(session: TrustedSession): string | null {
  if (session.role === "consultant") return session.consultantId ?? null;
  return null;
}

function visibleStudents(session: TrustedSession): Student[] {
  if (rolesAtLeastAdmin(session.role)) return db.students.filter((s) => !s.archived);
  if (session.role === "consultant") {
    const cid = consultantScopeId(session);
    if (!cid) return [];
    return db.students.filter((s) => s.consultantId === cid && !s.archived);
  }
  return [];
}

function assertStudentVisible(session: TrustedSession, studentId: string) {
  if (!visibleStudents(session).some((s) => s.id === studentId)) {
    throw new AuthError("You do not have access to this student record.", 403);
  }
}

function visibleApplications(session: TrustedSession): Application[] {
  const ids = new Set(visibleStudents(session).map((s) => s.id));
  return db.applications.filter((a) => ids.has(a.studentId));
}

function actorMeta(session: TrustedSession) {
  const cid = consultantScopeId(session);
  const consultant = cid ? db.consultants.find((c) => c.id === cid) : undefined;
  const admin = rolesAtLeastAdmin(session.role);
  return {
    id: consultant?.id ?? session.userId ?? null,
    name: consultant?.name ?? (admin ? "Admin" : session.email),
  };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysTo(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-GB")}`;
  }
}

function conditionsSummary(offerId: string) {
  const list = conditionsForOffer(offerId);
  const total = list.length;
  const met = list.filter((c) => c.met).length;
  if (total === 0) return { total: 0, met: 0, label: "None (Clear)" };
  return { total, met, label: `${met} of ${total} conditions met` };
}

function allConditionsMet(offerId: string) {
  const list = conditionsForOffer(offerId);
  return list.length === 0 || list.every((c) => c.met);
}

function canAcceptOffer(offer: (typeof offerRecords)[number]) {
  if (offer.status !== "awaiting_student" && offer.status !== "conditions_pending") return false;
  if (offer.offerType === "unconditional") return true;
  return allConditionsMet(offer.id);
}

function currentStatusLabel(offer: (typeof offerRecords)[number]): string {
  const deposit = depositForOffer(offer.id);
  if (offer.status === "accepted") {
    if (deposit?.status === "paid") {
      return `Accepted · Deposit Paid (${formatMoney(deposit.amount, deposit.currency)})`;
    }
    if (deposit?.status === "due" || deposit?.status === "overdue") {
      return `Accepted · Deposit ${DEPOSIT_STATUS_LABELS[deposit.status]}`;
    }
    return OFFER_STATUS_LABELS.accepted;
  }
  if (offer.status === "conditions_pending") {
    const { met, total } = conditionsSummary(offer.id);
    if (total > 0 && met === 0) return "Awaiting Docs";
    return "Docs In Progress";
  }
  return OFFER_STATUS_LABELS[offer.status];
}

function toOfferRow(
  offer: (typeof offerRecords)[number],
  students: Student[],
  apps: Application[],
): OfferRowView {
  const st = students.find((s) => s.id === offer.studentId);
  const app = apps.find((a) => a.id === offer.applicationId);
  const cond = conditionsSummary(offer.id);
  const left = daysTo(offer.responseDeadline);
  const overdue = left !== null && left < 0;
  const alert =
    offer.status !== "accepted" &&
    offer.status !== "declined" &&
    offer.status !== "expired" &&
    left !== null &&
    (overdue || left <= OFFER_DEADLINE_ALERT_DAYS);
  const deposit = depositForOffer(offer.id);
  return {
    id: offer.id,
    applicationId: offer.applicationId,
    studentId: offer.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    program: app?.program ?? "—",
    country: app?.country ?? st?.destination ?? "—",
    offerType: offer.offerType,
    offerTypeLabel: offer.offerType === "conditional" ? "Conditional" : "Unconditional",
    status: offer.status,
    currentStatusLabel: currentStatusLabel(offer),
    conditionsTotal: cond.total,
    conditionsMet: cond.met,
    conditionsLabel: cond.label,
    responseDeadline: offer.responseDeadline,
    deadlineAlert: alert,
    deadlineOverdue: overdue,
    daysToDeadline: left,
    depositId: deposit?.id ?? null,
    depositStatus: deposit?.status ?? null,
    depositSummary: deposit
      ? `${DEPOSIT_STATUS_LABELS[deposit.status]} · ${formatMoney(deposit.amount, deposit.currency)}`
      : null,
    canAccept: canAcceptOffer(offer),
  };
}

function toDepositRow(
  dep: (typeof depositRecords)[number],
  students: Student[],
  apps: Application[],
): DepositRowView {
  const offer = offerRecords.find((o) => o.id === dep.offerId);
  const st = students.find((s) => s.id === dep.studentId);
  const app = apps.find((a) => a.id === offer?.applicationId);
  const left = daysTo(dep.dueDate);
  const alert =
    (dep.status === "due" || dep.status === "overdue") &&
    left !== null &&
    (left < 0 || left <= OFFER_DEADLINE_ALERT_DAYS);
  return {
    id: dep.id,
    offerId: dep.offerId,
    studentId: dep.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    applicationId: offer?.applicationId ?? "—",
    amount: dep.amount,
    currency: dep.currency,
    amountLabel: formatMoney(dep.amount, dep.currency),
    status: dep.status,
    statusLabel: DEPOSIT_STATUS_LABELS[dep.status],
    dueDate: dep.dueDate,
    deadlineAlert: alert,
    paidAt: dep.paidAt,
    reference: dep.reference,
  };
}

function toCasRow(
  row: (typeof casI20Records)[number],
  students: Student[],
  apps: Application[],
): CasI20RowView {
  const st = students.find((s) => s.id === row.studentId);
  const app = apps.find((a) => a.id === row.applicationId);
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    country: app?.country ?? st?.destination ?? "—",
    applicationId: row.applicationId,
    offerId: row.offerId,
    recordType: row.recordType,
    status: row.status,
    statusLabel: CAS_I20_STATUS_LABELS[row.status],
    referenceNumber: row.referenceNumber,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    notes: row.notes,
    nextStatus: nextCasI20Status(row.status),
  };
}

function toVisaRow(
  row: (typeof visaMilestones)[number],
  students: Student[],
  apps: Application[],
): VisaRowView {
  const st = students.find((s) => s.id === row.studentId);
  const app = apps.find((a) => a.id === row.applicationId);
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    country: app?.country ?? st?.destination ?? "—",
    applicationId: row.applicationId,
    stage: row.stage,
    stageLabel: VISA_STAGE_LABELS[row.stage],
    decision: row.decision,
    decisionLabel:
      row.decision === "pending" ? "Pending" : row.decision === "approved" ? "Approved" : "Refused",
    filedAt: row.filedAt,
    biometricsAt: row.biometricsAt,
    decisionAt: row.decisionAt,
    nextStage: nextVisaStage(row.stage),
    casI20Id: row.casI20Id,
  };
}

function refreshDepositOverdue() {
  const today = startOfDay(new Date()).getTime();
  for (const dep of depositRecords) {
    if (dep.status !== "due" || !dep.dueDate) continue;
    const due = startOfDay(new Date(dep.dueDate)).getTime();
    if (!Number.isNaN(due) && due < today) dep.status = "overdue";
  }
}

function inMetric(offerId: string, metric: OffersMetricTab): boolean {
  const offer = offerRecords.find((o) => o.id === offerId);
  if (!offer) return false;
  if (metric === "offers_received") {
    return offer.status !== "declined" && offer.status !== "expired";
  }
  if (metric === "conditions_pending") {
    return (
      offer.status === "conditions_pending" ||
      (offer.offerType === "conditional" &&
        !allConditionsMet(offer.id) &&
        offer.status !== "declined")
    );
  }
  if (metric === "deposits_due") {
    const dep = depositForOffer(offer.id);
    return Boolean(dep && (dep.status === "due" || dep.status === "overdue"));
  }
  // visa_in_progress filtered via visa list, not offers
  return false;
}

/* -------------------------------------------------------------------------- */
/* Supabase data-plane presentation helpers (self-contained, no module       */
/* globals — mirror the mock helpers above but take DB-sourced collections   */
/* as parameters).                                                           */
/* -------------------------------------------------------------------------- */

function dbConditionsSummary(conditions: OfferConditionRecord[]) {
  const total = conditions.length;
  const met = conditions.filter((c) => c.met).length;
  if (total === 0) return { total: 0, met: 0, label: "None (Clear)" };
  return { total, met, label: `${met} of ${total} conditions met` };
}

function dbAllConditionsMet(conditions: OfferConditionRecord[]) {
  return conditions.length === 0 || conditions.every((c) => c.met);
}

function dbCanAcceptOffer(offer: OfferRecord, conditions: OfferConditionRecord[]) {
  if (offer.status !== "awaiting_student" && offer.status !== "conditions_pending") return false;
  if (offer.offerType === "unconditional") return true;
  return dbAllConditionsMet(conditions);
}

function dbCurrentStatusLabel(
  offer: OfferRecord,
  deposit: DepositRecord | null,
  conditions: OfferConditionRecord[],
): string {
  if (offer.status === "accepted") {
    if (deposit?.status === "paid") {
      return `Accepted · Deposit Paid (${formatMoney(deposit.amount, deposit.currency)})`;
    }
    if (deposit?.status === "due" || deposit?.status === "overdue") {
      return `Accepted · Deposit ${DEPOSIT_STATUS_LABELS[deposit.status]}`;
    }
    return OFFER_STATUS_LABELS.accepted;
  }
  if (offer.status === "conditions_pending") {
    const { met, total } = dbConditionsSummary(conditions);
    if (total > 0 && met === 0) return "Awaiting Docs";
    return "Docs In Progress";
  }
  return OFFER_STATUS_LABELS[offer.status];
}

function dbToOfferRow(
  offer: OfferRecord,
  students: Student[],
  apps: Application[],
  conditions: OfferConditionRecord[],
  deposit: DepositRecord | null,
): OfferRowView {
  const st = students.find((s) => s.id === offer.studentId);
  const app = apps.find((a) => a.id === offer.applicationId);
  const cond = dbConditionsSummary(conditions);
  const left = daysTo(offer.responseDeadline);
  const overdue = left !== null && left < 0;
  const alert =
    offer.status !== "accepted" &&
    offer.status !== "declined" &&
    offer.status !== "expired" &&
    left !== null &&
    (overdue || left <= OFFER_DEADLINE_ALERT_DAYS);
  return {
    id: offer.id,
    applicationId: offer.applicationId,
    studentId: offer.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    program: app?.program ?? "—",
    country: app?.country ?? st?.destination ?? "—",
    offerType: offer.offerType,
    offerTypeLabel: offer.offerType === "conditional" ? "Conditional" : "Unconditional",
    status: offer.status,
    currentStatusLabel: dbCurrentStatusLabel(offer, deposit, conditions),
    conditionsTotal: cond.total,
    conditionsMet: cond.met,
    conditionsLabel: cond.label,
    responseDeadline: offer.responseDeadline,
    deadlineAlert: alert,
    deadlineOverdue: overdue,
    daysToDeadline: left,
    depositId: deposit?.id ?? null,
    depositStatus: deposit?.status ?? null,
    depositSummary: deposit
      ? `${DEPOSIT_STATUS_LABELS[deposit.status]} · ${formatMoney(deposit.amount, deposit.currency)}`
      : null,
    canAccept: dbCanAcceptOffer(offer, conditions),
  };
}

function dbToDepositRow(
  dep: DepositRecord,
  students: Student[],
  apps: Application[],
  offersById: Map<string, OfferRecord>,
): DepositRowView {
  const offer = offersById.get(dep.offerId);
  const st = students.find((s) => s.id === dep.studentId);
  const app = apps.find((a) => a.id === offer?.applicationId);
  const left = daysTo(dep.dueDate);
  const alert =
    (dep.status === "due" || dep.status === "overdue") &&
    left !== null &&
    (left < 0 || left <= OFFER_DEADLINE_ALERT_DAYS);
  return {
    id: dep.id,
    offerId: dep.offerId,
    studentId: dep.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    applicationId: offer?.applicationId ?? "—",
    amount: dep.amount,
    currency: dep.currency,
    amountLabel: formatMoney(dep.amount, dep.currency),
    status: dep.status,
    statusLabel: DEPOSIT_STATUS_LABELS[dep.status],
    dueDate: dep.dueDate,
    deadlineAlert: alert,
    paidAt: dep.paidAt,
    reference: dep.reference,
  };
}

function dbToCasRow(row: CasI20Record, students: Student[], apps: Application[]): CasI20RowView {
  const st = students.find((s) => s.id === row.studentId);
  const app = apps.find((a) => a.id === row.applicationId);
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    country: app?.country ?? st?.destination ?? "—",
    applicationId: row.applicationId,
    offerId: row.offerId,
    recordType: row.recordType,
    status: row.status,
    statusLabel: CAS_I20_STATUS_LABELS[row.status],
    referenceNumber: row.referenceNumber,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    notes: row.notes,
    nextStatus: nextCasI20Status(row.status),
  };
}

function dbToVisaRow(
  row: VisaMilestoneRecord,
  students: Student[],
  apps: Application[],
): VisaRowView {
  const st = students.find((s) => s.id === row.studentId);
  const app = apps.find((a) => a.id === row.applicationId);
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: st?.name ?? "Student",
    studentCaseId: st?.caseId ?? "—",
    university: app?.university ?? "—",
    country: app?.country ?? st?.destination ?? "—",
    applicationId: row.applicationId,
    stage: row.stage,
    stageLabel: VISA_STAGE_LABELS[row.stage],
    decision: row.decision,
    decisionLabel:
      row.decision === "pending" ? "Pending" : row.decision === "approved" ? "Approved" : "Refused",
    filedAt: row.filedAt,
    biometricsAt: row.biometricsAt,
    decisionAt: row.decisionAt,
    nextStage: nextVisaStage(row.stage),
    casI20Id: row.casI20Id,
  };
}

/** Display-only overdue derivation (not persisted) — mirrors mock's lazy refresh. */
function dbMarkOverdue(deposits: DepositRecord[]): DepositRecord[] {
  const today = startOfDay(new Date()).getTime();
  return deposits.map((dep) => {
    if (dep.status !== "due" || !dep.dueDate) return dep;
    const due = startOfDay(new Date(dep.dueDate)).getTime();
    if (!Number.isNaN(due) && due < today) return { ...dep, status: "overdue" as DepositStatus };
    return dep;
  });
}

function dbInMetric(
  offer: OfferRecord,
  deposit: DepositRecord | null,
  conditions: OfferConditionRecord[],
  metric: OffersMetricTab,
): boolean {
  if (metric === "offers_received") {
    return offer.status !== "declined" && offer.status !== "expired";
  }
  if (metric === "conditions_pending") {
    return (
      offer.status === "conditions_pending" ||
      (offer.offerType === "conditional" &&
        !dbAllConditionsMet(conditions) &&
        offer.status !== "declined")
    );
  }
  if (metric === "deposits_due") {
    return Boolean(deposit && (deposit.status === "due" || deposit.status === "overdue"));
  }
  return false;
}

const createCache = new Map<string, string>();

export const portalGetOffersVisa = createServerFn({ method: "GET" })
  .validator((data: OffersVisaFilters | undefined) => data ?? {})
  .handler(async ({ data }): Promise<OffersVisaPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 1, "offers and visa");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          listVisibleStudentsDb,
          listAppsForStudents,
          listOffersForStudents,
          listDepositsForStudents,
          listCasI20RecordsForStudents,
          listVisaMilestonesForStudents,
          listOfferConditionsForOffers,
        } = await import("@/server/ao-data");
        const client = requireAoSupabaseClient();
        const students = await listVisibleStudentsDb(client, session);
        const studentIds = students.map((s) => s.id);
        const apps = await listAppsForStudents(client, studentIds);
        const [offersRaw, depositsRaw, casI20, visas] = await Promise.all([
          listOffersForStudents(client, studentIds),
          listDepositsForStudents(client, studentIds),
          listCasI20RecordsForStudents(client, studentIds),
          listVisaMilestonesForStudents(client, studentIds),
        ]);
        const deposits = dbMarkOverdue(depositsRaw);
        const conditionsByOffer = new Map<string, OfferConditionRecord[]>();
        const allConditions = await listOfferConditionsForOffers(
          client,
          offersRaw.map((o) => o.id),
        );
        for (const c of allConditions) {
          const list = conditionsByOffer.get(c.offerId) ?? [];
          list.push(c);
          conditionsByOffer.set(c.offerId, list);
        }
        const depositByOffer = new Map(deposits.map((d) => [d.offerId, d] as const));
        const offersById = new Map(offersRaw.map((o) => [o.id, o] as const));

        const offers = offersRaw.map((o) =>
          dbToOfferRow(
            o,
            students,
            apps,
            conditionsByOffer.get(o.id) ?? [],
            depositByOffer.get(o.id) ?? null,
          ),
        );
        const depositRows = deposits.map((d) => dbToDepositRow(d, students, apps, offersById));
        const casRows = casI20.map((c) => dbToCasRow(c, students, apps));
        const visaRows = visas.map((v) => dbToVisaRow(v, students, apps));

        const metricCounts: OffersVisaPayload["metricCounts"] = {
          offers_received: offersRaw.filter((o) =>
            dbInMetric(
              o,
              depositByOffer.get(o.id) ?? null,
              conditionsByOffer.get(o.id) ?? [],
              "offers_received",
            ),
          ).length,
          conditions_pending: offersRaw.filter((o) =>
            dbInMetric(
              o,
              depositByOffer.get(o.id) ?? null,
              conditionsByOffer.get(o.id) ?? [],
              "conditions_pending",
            ),
          ).length,
          deposits_due: depositRows.filter((d) => d.status === "due" || d.status === "overdue")
            .length,
          cas_confirmation_pending: casRows.filter(
            (c) => c.status === "pending" || c.status === "requested",
          ).length,
          visa_in_progress: visaRows.filter((v) => v.decision === "pending").length,
          decisions: visaRows.filter((v) => v.decision === "approved" || v.decision === "refused")
            .length,
        };
        const phaseCounts: OffersVisaPayload["phaseCounts"] = {
          offers: offers.length,
          deposits: depositRows.length,
          cas_i20: casRows.length,
          visa: visaRows.length,
        };

        const metric: OffersMetricTab = data.metric ?? "offers_received";
        const q = data.q?.trim().toLowerCase();

        let offerRows = offers;
        if (
          metric === "offers_received" ||
          metric === "conditions_pending" ||
          metric === "deposits_due"
        ) {
          offerRows = offers.filter((o) =>
            dbInMetric(
              offersById.get(o.id)!,
              depositByOffer.get(o.id) ?? null,
              conditionsByOffer.get(o.id) ?? [],
              metric,
            ),
          );
        } else if (metric === "cas_confirmation_pending") {
          const casStudentIds = new Set(
            casRows
              .filter((c) => c.status === "pending" || c.status === "requested")
              .map((c) => c.studentId),
          );
          offerRows = offers.filter((o) => casStudentIds.has(o.studentId));
        } else if (metric === "visa_in_progress") {
          const visaStudentIds = new Set(
            visaRows.filter((v) => v.decision === "pending").map((v) => v.studentId),
          );
          offerRows = offers.filter((o) => visaStudentIds.has(o.studentId));
        } else if (metric === "decisions") {
          const decidedStudentIds = new Set(
            visaRows
              .filter((v) => v.decision === "approved" || v.decision === "refused")
              .map((v) => v.studentId),
          );
          offerRows = offers.filter((o) => decidedStudentIds.has(o.studentId));
        }

        const matchQ = (parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q));
        const filteredOffers = offerRows.filter((o) =>
          matchQ([o.studentName, o.university, o.program, o.studentCaseId, o.currentStatusLabel]),
        );
        const filteredDeposits = depositRows
          .filter((d) =>
            metric === "deposits_due" ? d.status === "due" || d.status === "overdue" : true,
          )
          .filter((d) =>
            matchQ([d.studentName, d.university, d.studentCaseId, d.statusLabel, d.amountLabel]),
          );
        const filteredCas = casRows
          .filter((c) =>
            metric === "cas_confirmation_pending"
              ? c.status === "pending" || c.status === "requested"
              : true,
          )
          .filter((c) =>
            matchQ([
              c.studentName,
              c.university,
              c.recordType,
              c.statusLabel,
              c.referenceNumber ?? "",
            ]),
          );
        const filteredVisas = visaRows
          .filter((v) => {
            if (metric === "visa_in_progress") return v.decision === "pending";
            if (metric === "decisions")
              return v.decision === "approved" || v.decision === "refused";
            return true;
          })
          .filter((v) => matchQ([v.studentName, v.university, v.stageLabel, v.decisionLabel]));

        const usedAppIds = new Set(offersRaw.map((o) => o.applicationId));
        const applicationsEligible = apps
          .filter((a) => a.status === "Offer Received" && !usedAppIds.has(a.id))
          .map((a) => {
            const st = students.find((s) => s.id === a.studentId);
            return {
              id: a.id,
              studentId: a.studentId,
              studentName: st?.name ?? "Student",
              university: a.university,
              country: a.country,
            };
          });

        return {
          metricCounts,
          phaseCounts,
          offers: filteredOffers,
          deposits: filteredDeposits,
          casI20: filteredCas,
          visas: filteredVisas,
          applicationsEligible,
        };
      }

      refreshDepositOverdue();

      const students = visibleStudents(session);
      const apps = visibleApplications(session);
      const studentIds = new Set(students.map((s) => s.id));

      const offers = offerRecords
        .filter((o) => studentIds.has(o.studentId))
        .map((o) => toOfferRow(o, students, apps));
      const deposits = depositRecords
        .filter((d) => studentIds.has(d.studentId))
        .map((d) => toDepositRow(d, students, apps));
      const casI20 = casI20Records
        .filter((c) => studentIds.has(c.studentId))
        .map((c) => toCasRow(c, students, apps));
      const visas = visaMilestones
        .filter((v) => studentIds.has(v.studentId))
        .map((v) => toVisaRow(v, students, apps));

      const metricCounts: OffersVisaPayload["metricCounts"] = {
        offers_received: offers.filter((o) => inMetric(o.id, "offers_received")).length,
        conditions_pending: offers.filter((o) => inMetric(o.id, "conditions_pending")).length,
        deposits_due: deposits.filter((d) => d.status === "due" || d.status === "overdue").length,
        cas_confirmation_pending: casI20.filter(
          (c) => c.status === "pending" || c.status === "requested",
        ).length,
        visa_in_progress: visas.filter((v) => v.decision === "pending").length,
        decisions: visas.filter((v) => v.decision === "approved" || v.decision === "refused")
          .length,
      };

      const phaseCounts: OffersVisaPayload["phaseCounts"] = {
        offers: offers.length,
        deposits: deposits.length,
        cas_i20: casI20.length,
        visa: visas.length,
      };

      const metric: OffersMetricTab = data.metric ?? "offers_received";
      const phase: OffersPhaseTab = data.phase ?? "offers";
      const q = data.q?.trim().toLowerCase();

      let offerRows = offers;
      if (metric === "offers_received") {
        offerRows = offerRows.filter((o) => inMetric(o.id, "offers_received"));
      } else if (metric === "conditions_pending") {
        offerRows = offerRows.filter((o) => inMetric(o.id, "conditions_pending"));
      } else if (metric === "deposits_due") {
        offerRows = offerRows.filter((o) => inMetric(o.id, "deposits_due"));
      } else if (metric === "cas_confirmation_pending") {
        const casStudentIds = new Set(
          casI20
            .filter((c) => c.status === "pending" || c.status === "requested")
            .map((c) => c.studentId),
        );
        offerRows = offerRows.filter((o) => casStudentIds.has(o.studentId));
      } else if (metric === "visa_in_progress") {
        const visaStudentIds = new Set(
          visas.filter((v) => v.decision === "pending").map((v) => v.studentId),
        );
        offerRows = offerRows.filter((o) => visaStudentIds.has(o.studentId));
      } else if (metric === "decisions") {
        const decidedStudentIds = new Set(
          visas
            .filter((v) => v.decision === "approved" || v.decision === "refused")
            .map((v) => v.studentId),
        );
        offerRows = offerRows.filter((o) => decidedStudentIds.has(o.studentId));
      }

      const matchQ = (parts: string[]) => !q || parts.some((p) => p.toLowerCase().includes(q));

      const filteredOffers = offerRows.filter((o) =>
        matchQ([o.studentName, o.university, o.program, o.studentCaseId, o.currentStatusLabel]),
      );
      const filteredDeposits = deposits
        .filter((d) =>
          metric === "deposits_due" ? d.status === "due" || d.status === "overdue" : true,
        )
        .filter((d) =>
          matchQ([d.studentName, d.university, d.studentCaseId, d.statusLabel, d.amountLabel]),
        );
      const filteredCas = casI20
        .filter((c) =>
          metric === "cas_confirmation_pending"
            ? c.status === "pending" || c.status === "requested"
            : true,
        )
        .filter((c) =>
          matchQ([
            c.studentName,
            c.university,
            c.recordType,
            c.statusLabel,
            c.referenceNumber ?? "",
          ]),
        );
      const filteredVisas = visas
        .filter((v) => {
          if (metric === "visa_in_progress") return v.decision === "pending";
          if (metric === "decisions") return v.decision === "approved" || v.decision === "refused";
          return true;
        })
        .filter((v) => matchQ([v.studentName, v.university, v.stageLabel, v.decisionLabel]));

      const usedAppIds = new Set(offerRecords.map((o) => o.applicationId));
      const applicationsEligible = apps
        .filter((a) => a.status === "Offer Received" && !usedAppIds.has(a.id))
        .map((a) => {
          const st = students.find((s) => s.id === a.studentId);
          return {
            id: a.id,
            studentId: a.studentId,
            studentName: st?.name ?? "Student",
            university: a.university,
            country: a.country,
          };
        });

      // phase unused for filtering lists — UI shows the active phase table; all lists returned filtered by q
      void phase;

      return {
        metricCounts,
        phaseCounts,
        offers: filteredOffers,
        deposits: filteredDeposits,
        casI20: filteredCas,
        visas: filteredVisas,
        applicationsEligible,
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalGetOfferDetail = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<OfferDetailPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 1, "offers and visa");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          assertStudentVisibleDb,
          listAppsForStudents,
          mapOfferRow,
        } = await import("@/server/ao-data");
        const {
          getOfferById,
          listOfferConditions,
          listDeposits,
          listCasI20Records,
          listVisaMilestones,
        } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const offerRow = await getOfferById(client, data.id);
        if (!offerRow) throw new AuthError("Offer not found.", 404);
        const student = await assertStudentVisibleDb(client, session, offerRow.student_id);
        const offer = mapOfferRow(offerRow);
        const apps = await listAppsForStudents(client, [student.id]);
        const [conditionRows, depositRows, casRows, visaRows] = await Promise.all([
          listOfferConditions(client, offer.id),
          listDeposits(client, student.id),
          listCasI20Records(client, student.id),
          listVisaMilestones(client, student.id),
        ]);
        const { mapOfferConditionRow, mapDepositRow, mapCasI20Row, mapVisaMilestoneRow } =
          await import("@/server/ao-data");
        const conditions = conditionRows.map(mapOfferConditionRow);
        const deposit = depositRows.map(mapDepositRow).find((d) => d.offerId === offer.id) ?? null;
        const casI20 = casRows.map(mapCasI20Row).find((c) => c.offerId === offer.id) ?? null;
        const visa =
          visaRows.map(mapVisaMilestoneRow).find((v) => v.applicationId === offer.applicationId) ??
          null;

        const { data: auditRows, error: auditErr } = await client
          .from("audit_events")
          .select("*")
          .eq("entity_id", offer.id)
          .order("created_at", { ascending: false });
        if (auditErr) throw new Error(auditErr.message);
        const { namesForIds } = await import("@/server/ao-data");
        const actorNames = await namesForIds(
          client,
          (auditRows ?? []).map((h) => h.actor_id).filter((x): x is string => Boolean(x)),
        );

        return {
          offer: dbToOfferRow(offer, [student], apps, conditions, deposit),
          conditions,
          deposit,
          casI20,
          visa,
          history: (auditRows ?? []).map((h) => ({
            id: h.id,
            at: h.created_at,
            actorName: (h.actor_id && actorNames.get(h.actor_id)) || "Officer",
            action: h.action,
            note: null,
          })),
        };
      }

      const offer = offerRecords.find((o) => o.id === data.id);
      if (!offer) throw new AuthError("Offer not found.", 404);
      assertStudentVisible(session, offer.studentId);
      const students = visibleStudents(session);
      const apps = visibleApplications(session);
      return {
        offer: toOfferRow(offer, students, apps),
        conditions: conditionsForOffer(offer.id),
        deposit: depositForOffer(offer.id),
        casI20: casForOffer(offer.id),
        visa: visaForApplication(offer.applicationId),
        history: offerAuditHistory
          .filter((h) => h.offerId === offer.id || h.entityId === offer.id)
          .map((h) => ({
            id: h.id,
            at: h.at,
            actorName: h.actorName,
            action: h.action,
            note: h.note,
          })),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalCreateOfferRecord = createServerFn({ method: "POST" })
  .validator((data: NewOfferInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          getScopedApplication,
          assertStudentVisibleDb,
          listAppsForStudents,
          mapOfferRow,
        } = await import("@/server/ao-data");
        const { createOffer, createOfferCondition, listOfferConditions } =
          await import("@/services/db");
        const client = requireAoSupabaseClient();
        const app = await getScopedApplication(client, session, data.applicationId);
        if (app.status !== "Offer Received") {
          throw new AuthError(
            "Offers can only be recorded for applications in Offer Received.",
            400,
          );
        }
        const { data: existingOfferRow, error: existingErr } = await client
          .from("offers")
          .select("id")
          .eq("application_id", app.id)
          .maybeSingle();
        if (existingErr) throw new Error(existingErr.message);
        if (existingOfferRow) {
          throw new AuthError("An offer record already exists for this application.", 400);
        }
        if (data.offerType !== "conditional" && data.offerType !== "unconditional") {
          throw new AuthError("Invalid offer type.", 400);
        }

        const student = await assertStudentVisibleDb(client, session, app.studentId);
        const apps = await listAppsForStudents(client, [student.id]);
        const conditionsInput = (data.conditions ?? []).map((c) => c.trim()).filter(Boolean);
        const status: OfferStatus =
          data.offerType === "conditional" && conditionsInput.length > 0
            ? "conditions_pending"
            : "awaiting_student";

        const createdRow = await createOffer(client, {
          application_id: app.id,
          student_id: app.studentId,
          offer_type: data.offerType,
          status,
          offer_date: data.offerDate ?? new Date().toISOString().slice(0, 10),
          response_deadline: data.responseDeadline?.trim() || null,
          tuition_fee: data.tuitionFee?.trim() || null,
        });

        await Promise.all(
          conditionsInput.map((description, index) =>
            createOfferCondition(client, {
              offer_id: createdRow.id,
              description,
              sort_order: index + 1,
            }),
          ),
        );
        const conditionRows = await listOfferConditions(client, createdRow.id);
        const { mapOfferConditionRow } = await import("@/server/ao-data");
        const conditions = conditionRows.map(mapOfferConditionRow);
        const offer = mapOfferRow(createdRow);

        const { nextJourneyStageIfAdvanced } = await import("@/lib/journey-stage");
        const { data: journeyRow } = await client
          .from("students")
          .select("journey_stage")
          .eq("id", student.id)
          .maybeSingle();
        const nextStage = nextJourneyStageIfAdvanced(journeyRow?.journey_stage, "offer_received");
        if (nextStage) {
          await client.from("students").update({ journey_stage: nextStage }).eq("id", student.id);
        }
        const { writeAudit } = await import("@/services/db");
        await writeAudit(client, {
          action: "offer.create",
          entity_type: "offers",
          entity_id: createdRow.id,
          student_id: student.id,
          metadata: { application_id: app.id, status, journey_stage: nextStage },
        });

        return {
          ok: true as const,
          duplicate: false as const,
          offer: dbToOfferRow(offer, [student], apps, conditions, null),
        };
      }

      const app = visibleApplications(session).find((a) => a.id === data.applicationId);
      if (!app) throw new AuthError("Application not found.", 404);
      if (app.status !== "Offer Received") {
        throw new AuthError("Offers can only be recorded for applications in Offer Received.", 400);
      }
      if (offerRecords.some((o) => o.applicationId === app.id)) {
        throw new AuthError("An offer record already exists for this application.", 400);
      }
      if (data.offerType !== "conditional" && data.offerType !== "unconditional") {
        throw new AuthError("Invalid offer type.", 400);
      }

      if (data.idempotencyKey) {
        const cached = createCache.get(data.idempotencyKey);
        if (cached) {
          const existing = offerRecords.find((o) => o.id === cached);
          if (existing) {
            return {
              ok: true as const,
              duplicate: true as const,
              offer: toOfferRow(existing, visibleStudents(session), visibleApplications(session)),
            };
          }
        }
      }

      const actor = actorMeta(session);
      const id = `off${Date.now().toString(36)}`;
      const conditions = (data.conditions ?? []).map((c) => c.trim()).filter(Boolean);
      const status: OfferStatus =
        data.offerType === "conditional" && conditions.length > 0
          ? "conditions_pending"
          : "awaiting_student";

      const offer = {
        id,
        applicationId: app.id,
        studentId: app.studentId,
        offerType: data.offerType,
        status,
        offerDate: data.offerDate ?? new Date().toISOString().slice(0, 10),
        responseDeadline: data.responseDeadline?.trim() || null,
        tuitionFee: data.tuitionFee?.trim() || null,
        scholarshipNote: null as string | null,
      };
      offerRecords.unshift(offer);

      conditions.forEach((description, index) => {
        offerConditions.push({
          id: `oc-${id}-${index + 1}`,
          offerId: id,
          description,
          met: false,
          metAt: null,
          sortOrder: index + 1,
        });
      });

      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: id,
        entityId: id,
        entity: "Offer",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: "Offer record created",
        note: `${data.offerType}; ${conditions.length} condition(s)`,
      });

      if (data.idempotencyKey) createCache.set(data.idempotencyKey, id);

      return {
        ok: true as const,
        duplicate: false as const,
        offer: toOfferRow(offer, visibleStudents(session), visibleApplications(session)),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalSetOfferConditionMet = createServerFn({ method: "POST" })
  .validator((data: SetConditionMetInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          assertStudentVisibleDb,
          listAppsForStudents,
          mapOfferRow,
          mapOfferConditionRow,
        } = await import("@/server/ao-data");
        const {
          getOfferConditionById,
          getOfferById,
          markOfferConditionMet,
          listOfferConditions,
          listDeposits,
          writeAudit,
        } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const conditionRow = await getOfferConditionById(client, data.conditionId);
        if (!conditionRow) throw new AuthError("Condition not found.", 404);
        const offerRow = await getOfferById(client, conditionRow.offer_id);
        if (!offerRow) throw new AuthError("Offer not found.", 404);
        const student = await assertStudentVisibleDb(client, session, offerRow.student_id);
        const offer = mapOfferRow(offerRow);
        if (offer.offerType !== "conditional") {
          throw new AuthError("Only conditional offers have conditions.", 400);
        }
        if (
          offer.status === "accepted" ||
          offer.status === "declined" ||
          offer.status === "expired"
        ) {
          throw new AuthError("Conditions cannot be changed after acceptance or closure.", 400);
        }

        await markOfferConditionMet(client, conditionRow.id, Boolean(data.met));
        const conditionRows = await listOfferConditions(client, offer.id);
        const conditions = conditionRows.map(mapOfferConditionRow);

        let updatedOfferRow = offerRow;
        if (dbAllConditionsMet(conditions) && offer.status === "conditions_pending") {
          const { updateOfferStatus } = await import("@/services/db");
          updatedOfferRow = await updateOfferStatus(client, offer.id, "awaiting_student");
        } else if (!dbAllConditionsMet(conditions) && offer.status === "awaiting_student") {
          const { updateOfferStatus } = await import("@/services/db");
          updatedOfferRow = await updateOfferStatus(client, offer.id, "conditions_pending");
        }
        const updatedOffer = mapOfferRow(updatedOfferRow);

        // offer_conditions has no audit trigger — write one explicitly for parity with mock history.
        await writeAudit(client, {
          action: data.met ? "offer_condition_met" : "offer_condition_unmet",
          entity_type: "offer_condition",
          entity_id: conditionRow.id,
          student_id: student.id,
          metadata: { offerId: offer.id, description: conditionRow.description },
        });

        const apps = await listAppsForStudents(client, [student.id]);
        const { mapDepositRow } = await import("@/server/ao-data");
        const depositRows = await listDeposits(client, student.id);
        const deposit = depositRows.map(mapDepositRow).find((d) => d.offerId === offer.id) ?? null;
        return {
          ok: true as const,
          offer: dbToOfferRow(updatedOffer, [student], apps, conditions, deposit),
          conditions,
        };
      }

      const condition = offerConditions.find((c) => c.id === data.conditionId);
      if (!condition) throw new AuthError("Condition not found.", 404);
      const offer = offerRecords.find((o) => o.id === condition.offerId);
      if (!offer) throw new AuthError("Offer not found.", 404);
      assertStudentVisible(session, offer.studentId);
      if (offer.offerType !== "conditional") {
        throw new AuthError("Only conditional offers have conditions.", 400);
      }
      if (
        offer.status === "accepted" ||
        offer.status === "declined" ||
        offer.status === "expired"
      ) {
        throw new AuthError("Conditions cannot be changed after acceptance or closure.", 400);
      }

      const actor = actorMeta(session);
      condition.met = Boolean(data.met);
      condition.metAt = data.met ? new Date().toISOString() : null;

      if (allConditionsMet(offer.id) && offer.status === "conditions_pending") {
        offer.status = "awaiting_student";
      } else if (!allConditionsMet(offer.id) && offer.status === "awaiting_student") {
        offer.status = "conditions_pending";
      }

      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: offer.id,
        entityId: condition.id,
        entity: "Offer",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: data.met ? "Condition marked met" : "Condition marked unmet",
        note: condition.description,
      });

      return {
        ok: true as const,
        offer: toOfferRow(offer, visibleStudents(session), visibleApplications(session)),
        conditions: conditionsForOffer(offer.id),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalAcceptOffer = createServerFn({ method: "POST" })
  .validator((data: AcceptOfferInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          assertStudentVisibleDb,
          listAppsForStudents,
          mapOfferRow,
          mapOfferConditionRow,
        } = await import("@/server/ao-data");
        const { getOfferById, listOfferConditions, listDeposits, updateOfferStatus } =
          await import("@/services/db");
        const client = requireAoSupabaseClient();
        const offerRow = await getOfferById(client, data.offerId);
        if (!offerRow) throw new AuthError("Offer not found.", 404);
        const student = await assertStudentVisibleDb(client, session, offerRow.student_id);
        const offer = mapOfferRow(offerRow);
        const apps = await listAppsForStudents(client, [student.id]);
        const conditionRows = await listOfferConditions(client, offer.id);
        const conditions = conditionRows.map(mapOfferConditionRow);
        const depositRows = await listDeposits(client, student.id);
        const { mapDepositRow } = await import("@/server/ao-data");
        const deposit = depositRows.map(mapDepositRow).find((d) => d.offerId === offer.id) ?? null;

        if (offer.status === "accepted") {
          return {
            ok: true as const,
            unchanged: true as const,
            offer: dbToOfferRow(offer, [student], apps, conditions, deposit),
          };
        }
        if (!dbCanAcceptOffer(offer, conditions)) {
          throw new AuthError(
            "Offer cannot be accepted until all configured conditions are met.",
            400,
          );
        }

        const updatedRow = await updateOfferStatus(client, offer.id, "accepted");
        const updatedOffer = mapOfferRow(updatedRow);
        // offers_audit_upd trigger auto-logs the status change.

        return {
          ok: true as const,
          unchanged: false as const,
          offer: dbToOfferRow(updatedOffer, [student], apps, conditions, deposit),
        };
      }

      const offer = offerRecords.find((o) => o.id === data.offerId);
      if (!offer) throw new AuthError("Offer not found.", 404);
      assertStudentVisible(session, offer.studentId);

      if (offer.status === "accepted") {
        return {
          ok: true as const,
          unchanged: true as const,
          offer: toOfferRow(offer, visibleStudents(session), visibleApplications(session)),
        };
      }
      if (!canAcceptOffer(offer)) {
        throw new AuthError(
          "Offer cannot be accepted until all configured conditions are met.",
          400,
        );
      }

      const actor = actorMeta(session);
      offer.status = "accepted";
      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: offer.id,
        entityId: offer.id,
        entity: "Offer",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: "Offer accepted",
        note: "Acceptance validated against condition rules.",
      });

      return {
        ok: true as const,
        unchanged: false as const,
        offer: toOfferRow(offer, visibleStudents(session), visibleApplications(session)),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalDeclineOffer = createServerFn({ method: "POST" })
  .validator((data: DeclineOfferInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          assertStudentVisibleDb,
          listAppsForStudents,
          mapOfferRow,
          mapOfferConditionRow,
        } = await import("@/server/ao-data");
        const { getOfferById, listOfferConditions, listDeposits, updateOfferStatus } =
          await import("@/services/db");
        const client = requireAoSupabaseClient();
        const offerRow = await getOfferById(client, data.offerId);
        if (!offerRow) throw new AuthError("Offer not found.", 404);
        const student = await assertStudentVisibleDb(client, session, offerRow.student_id);
        const offer = mapOfferRow(offerRow);
        if (offer.status === "accepted") {
          throw new AuthError("Accepted offers cannot be declined here.", 400);
        }

        const updatedRow = await updateOfferStatus(client, offer.id, "declined");
        const updatedOffer = mapOfferRow(updatedRow);
        // offers_audit_upd trigger auto-logs the status change (declined note is not persisted — no column for it).

        const apps = await listAppsForStudents(client, [student.id]);
        const conditionRows = await listOfferConditions(client, offer.id);
        const conditions = conditionRows.map(mapOfferConditionRow);
        const depositRows = await listDeposits(client, student.id);
        const { mapDepositRow } = await import("@/server/ao-data");
        const deposit = depositRows.map(mapDepositRow).find((d) => d.offerId === offer.id) ?? null;

        return {
          ok: true as const,
          offer: dbToOfferRow(updatedOffer, [student], apps, conditions, deposit),
        };
      }

      const offer = offerRecords.find((o) => o.id === data.offerId);
      if (!offer) throw new AuthError("Offer not found.", 404);
      assertStudentVisible(session, offer.studentId);
      if (offer.status === "accepted") {
        throw new AuthError("Accepted offers cannot be declined here.", 400);
      }
      const actor = actorMeta(session);
      offer.status = "declined";
      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: offer.id,
        entityId: offer.id,
        entity: "Offer",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: "Offer declined",
        note: data.note?.trim() || null,
      });
      return {
        ok: true as const,
        offer: toOfferRow(offer, visibleStudents(session), visibleApplications(session)),
      };
    } catch (error) {
      toError(error);
    }
  });

export const portalRecordDepositPaid = createServerFn({ method: "POST" })
  .validator((data: RecordDepositPaidInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { requireAoSupabaseClient, assertStudentVisibleDb, mapDepositRow } =
          await import("@/server/ao-data");
        const { writeAudit } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const { data: depRow, error: depErr } = await client
          .from("deposits")
          .select("*")
          .eq("id", data.depositId)
          .maybeSingle();
        if (depErr) throw new Error(depErr.message);
        if (!depRow) throw new AuthError("Deposit not found.", 404);
        const student = await assertStudentVisibleDb(client, session, depRow.student_id);
        const reference = data.reference.trim();
        if (reference.length < 3) {
          throw new AuthError("A payment reference is required to mark a deposit paid.", 400);
        }
        if (depRow.status === "paid") {
          return { ok: true as const, unchanged: true as const, deposit: mapDepositRow(depRow) };
        }
        if (depRow.status === "waived") {
          throw new AuthError("Waived deposits cannot be marked paid.", 400);
        }

        const paidAt = data.paidAt?.trim() || new Date().toISOString();
        const { data: updatedRow, error: updateErr } = await client
          .from("deposits")
          .update({ status: "paid" as DepositStatus, reference, paid_at: paidAt })
          .eq("id", depRow.id)
          .select("*")
          .single();
        if (updateErr) throw new Error(updateErr.message);

        // deposits has no audit trigger — write one explicitly for parity with mock history.
        await writeAudit(client, {
          action: "deposit_marked_paid",
          entity_type: "deposit",
          entity_id: depRow.id,
          student_id: student.id,
          metadata: { offerId: depRow.offer_id, reference },
        });

        return { ok: true as const, unchanged: false as const, deposit: mapDepositRow(updatedRow) };
      }

      const dep = depositRecords.find((d) => d.id === data.depositId);
      if (!dep) throw new AuthError("Deposit not found.", 404);
      assertStudentVisible(session, dep.studentId);
      const reference = data.reference.trim();
      if (reference.length < 3) {
        throw new AuthError("A payment reference is required to mark a deposit paid.", 400);
      }
      if (dep.status === "paid") {
        return { ok: true as const, unchanged: true as const, deposit: dep };
      }
      if (dep.status === "waived") {
        throw new AuthError("Waived deposits cannot be marked paid.", 400);
      }

      const actor = actorMeta(session);
      const status: DepositStatus = "paid";
      dep.status = status;
      dep.reference = reference;
      dep.paidAt = data.paidAt?.trim() || new Date().toISOString();

      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: dep.offerId,
        entityId: dep.id,
        entity: "Deposit",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: "Deposit marked paid",
        note: `Reference ${reference}`,
      });

      return { ok: true as const, unchanged: false as const, deposit: dep };
    } catch (error) {
      toError(error);
    }
  });

export const portalAdvanceCasI20 = createServerFn({ method: "POST" })
  .validator((data: AdvanceCasI20Input) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          assertStudentVisibleDb,
          getScopedApplication,
          mapCasI20Row,
        } = await import("@/server/ao-data");
        const { updateCasI20Status, writeAudit } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const { data: row, error: rowErr } = await client
          .from("cas_i20_records")
          .select("*")
          .eq("id", data.recordId)
          .maybeSingle();
        if (rowErr) throw new Error(rowErr.message);
        if (!row) throw new AuthError("CAS/I-20 record not found.", 404);
        const student = await assertStudentVisibleDb(client, session, row.student_id);

        const app = row.application_id
          ? await getScopedApplication(client, session, row.application_id)
          : null;
        const expected = app ? casI20TypeForCountry(app.country) : null;
        if (!expected || expected !== row.record_type) {
          throw new AuthError("CAS/I-20 tracking is not applicable for this destination.", 400);
        }

        const next = nextCasI20Status(row.status);
        if (!next) throw new AuthError("No further CAS/I-20 status transition is allowed.", 400);

        const extra: { reference_number?: string; issued_at?: string; expires_at?: string | null } =
          {};
        if (next === "issued") {
          const ref = data.referenceNumber?.trim() ?? "";
          if (ref.length < 3) {
            throw new AuthError(
              "A release / reference number is required when issuing CAS/I-20.",
              400,
            );
          }
          extra.reference_number = ref;
          extra.issued_at = data.issuedAt?.trim() || new Date().toISOString().slice(0, 10);
          extra.expires_at = data.expiresAt?.trim() || null;
        }

        const updatedRow = await updateCasI20Status(client, row.id, next, extra);

        // cas_i20_records has no audit trigger — write one explicitly for parity with mock history.
        await writeAudit(client, {
          action: `${row.record_type}_${next}`,
          entity_type: "cas_i20_record",
          entity_id: row.id,
          student_id: student.id,
          metadata: { offerId: row.offer_id, referenceNumber: updatedRow.reference_number },
        });

        return { ok: true as const, record: mapCasI20Row(updatedRow) };
      }

      const row = casI20Records.find((c) => c.id === data.recordId);
      if (!row) throw new AuthError("CAS/I-20 record not found.", 404);
      assertStudentVisible(session, row.studentId);

      const app = db.applications.find((a) => a.id === row.applicationId);
      const expected = app ? casI20TypeForCountry(app.country) : null;
      if (!expected || expected !== row.recordType) {
        throw new AuthError("CAS/I-20 tracking is not applicable for this destination.", 400);
      }

      const next = nextCasI20Status(row.status);
      if (!next) throw new AuthError("No further CAS/I-20 status transition is allowed.", 400);

      if (next === "issued") {
        const ref = data.referenceNumber?.trim() ?? "";
        if (ref.length < 3) {
          throw new AuthError(
            "A release / reference number is required when issuing CAS/I-20.",
            400,
          );
        }
        row.referenceNumber = ref;
        row.issuedAt = data.issuedAt?.trim() || new Date().toISOString().slice(0, 10);
        row.expiresAt = data.expiresAt?.trim() || null;
      }

      const actor = actorMeta(session);
      row.status = next;
      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: row.offerId,
        entityId: row.id,
        entity: "CAS/I-20",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: `${row.recordType} ${next}`,
        note: row.referenceNumber,
      });

      return { ok: true as const, record: row };
    } catch (error) {
      toError(error);
    }
  });

export const portalAdvanceVisa = createServerFn({ method: "POST" })
  .validator((data: AdvanceVisaInput) => data)
  .handler(async ({ data }) => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 2, "offers and visa mutations");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      if (usesSupabaseDataPlane(session)) {
        const { requireAoSupabaseClient, assertStudentVisibleDb, mapVisaMilestoneRow } =
          await import("@/server/ao-data");
        const { updateVisaMilestone } = await import("@/services/db");
        const client = requireAoSupabaseClient();
        const { data: row, error: rowErr } = await client
          .from("visa_milestones")
          .select("*")
          .eq("id", data.milestoneId)
          .maybeSingle();
        if (rowErr) throw new Error(rowErr.message);
        if (!row) throw new AuthError("Visa milestone not found.", 404);
        await assertStudentVisibleDb(client, session, row.student_id);

        const today = new Date().toISOString().slice(0, 10);

        // Recording a final decision without inventing one — only when explicitly provided.
        if (row.stage === "decision" && data.decision && data.decision !== "pending") {
          if (row.decision !== "pending") {
            throw new AuthError("A final visa decision is already recorded.", 400);
          }
          if (data.decision !== "approved" && data.decision !== "refused") {
            throw new AuthError("Decision must be approved or refused.", 400);
          }
          const updatedRow = await updateVisaMilestone(client, row.id, {
            decision: data.decision,
            decision_at: today,
          });
          // visa_milestones_audit trigger auto-logs decision changes.
          return { ok: true as const, milestone: mapVisaMilestoneRow(updatedRow) };
        }

        const next = nextVisaStage(row.stage);
        if (!next) {
          throw new AuthError(
            "Visa stage is complete. Record an explicit Approved or Refused decision if known.",
            400,
          );
        }

        const updatedRow = await updateVisaMilestone(client, row.id, {
          stage: next,
          ...(next === "filed" && !row.filed_at ? { filed_at: today } : {}),
          ...(next === "biometrics" && !row.biometrics_at ? { biometrics_at: today } : {}),
        });
        // visa_milestones_audit trigger auto-logs stage changes.

        return { ok: true as const, milestone: mapVisaMilestoneRow(updatedRow) };
      }

      const row = visaMilestones.find((v) => v.id === data.milestoneId);
      if (!row) throw new AuthError("Visa milestone not found.", 404);
      assertStudentVisible(session, row.studentId);

      const actor = actorMeta(session);
      const today = new Date().toISOString().slice(0, 10);

      // Recording a final decision without inventing one — only when explicitly provided.
      if (row.stage === "decision" && data.decision && data.decision !== "pending") {
        if (row.decision !== "pending") {
          throw new AuthError("A final visa decision is already recorded.", 400);
        }
        if (data.decision !== "approved" && data.decision !== "refused") {
          throw new AuthError("Decision must be approved or refused.", 400);
        }
        row.decision = data.decision;
        row.decisionAt = today;
        appendOfferAudit({
          id: `oa-${Date.now().toString(36)}`,
          offerId: null,
          entityId: row.id,
          entity: "Visa",
          at: new Date().toISOString(),
          actorId: actor.id,
          actorName: actor.name,
          action: `Visa decision: ${data.decision}`,
          note: data.note?.trim() || null,
        });
        return { ok: true as const, milestone: row };
      }

      const next = nextVisaStage(row.stage);
      if (!next) {
        throw new AuthError(
          "Visa stage is complete. Record an explicit Approved or Refused decision if known.",
          400,
        );
      }

      const from: VisaStage = row.stage;
      row.stage = next;
      if (next === "filed" && !row.filedAt) row.filedAt = today;
      if (next === "biometrics" && !row.biometricsAt) row.biometricsAt = today;

      appendOfferAudit({
        id: `oa-${Date.now().toString(36)}`,
        offerId: null,
        entityId: row.id,
        entity: "Visa",
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: `Visa stage: ${from} → ${next}`,
        note: data.note?.trim() || null,
      });

      return { ok: true as const, milestone: row };
    } catch (error) {
      toError(error);
    }
  });

export const portalExportOffersSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<ExportSummaryPayload> => {
    try {
      const session = await requireTrustedSession();
      requireRoles(session, ["consultant", "admin", "super_admin"]);
      denyFrontDeskConsultantWorkflows(session, "offers and visa");
      await requireModulePermission(session, "admissions", 1, "offers and visa");

      const { usesSupabaseDataPlane } = await import("@/server/ao-data");
      let rows: OfferRowView[];
      if (usesSupabaseDataPlane(session)) {
        const {
          requireAoSupabaseClient,
          listVisibleStudentsDb,
          listAppsForStudents,
          listOffersForStudents,
          listDepositsForStudents,
          listOfferConditionsForOffers,
        } = await import("@/server/ao-data");
        const client = requireAoSupabaseClient();
        const students = await listVisibleStudentsDb(client, session);
        const studentIds = students.map((s) => s.id);
        const apps = await listAppsForStudents(client, studentIds);
        const [offersRaw, depositsRaw] = await Promise.all([
          listOffersForStudents(client, studentIds),
          listDepositsForStudents(client, studentIds),
        ]);
        const deposits = dbMarkOverdue(depositsRaw);
        const depositByOffer = new Map(deposits.map((d) => [d.offerId, d] as const));
        const allConditions = await listOfferConditionsForOffers(
          client,
          offersRaw.map((o) => o.id),
        );
        const conditionsByOffer = new Map<string, OfferConditionRecord[]>();
        for (const c of allConditions) {
          const list = conditionsByOffer.get(c.offerId) ?? [];
          list.push(c);
          conditionsByOffer.set(c.offerId, list);
        }
        rows = offersRaw.map((o) =>
          dbToOfferRow(
            o,
            students,
            apps,
            conditionsByOffer.get(o.id) ?? [],
            depositByOffer.get(o.id) ?? null,
          ),
        );
      } else {
        refreshDepositOverdue();
        const students = visibleStudents(session);
        const apps = visibleApplications(session);
        const studentIds = new Set(students.map((s) => s.id));
        rows = offerRecords
          .filter((o) => studentIds.has(o.studentId))
          .map((o) => toOfferRow(o, students, apps));
      }

      const header = [
        "Offer ID",
        "Student",
        "Case ID",
        "University",
        "Country",
        "Offer Type",
        "Conditions",
        "Offer Status",
        "Current Status",
        "Accept Deadline",
        "Deposit",
        "Application ID",
      ];
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [
        header.join(","),
        ...rows.map((r) =>
          [
            r.id,
            r.studentName,
            r.studentCaseId,
            r.university,
            r.country,
            r.offerTypeLabel,
            r.conditionsLabel,
            r.status,
            r.currentStatusLabel,
            r.responseDeadline ?? "",
            r.depositSummary ?? "",
            r.applicationId,
          ]
            .map((c) => escape(String(c)))
            .join(","),
        ),
      ];

      return {
        generatedAt: new Date().toISOString(),
        csv: lines.join("\n"),
        rowCount: rows.length,
      };
    } catch (error) {
      toError(error);
    }
  },
);
