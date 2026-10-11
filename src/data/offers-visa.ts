/**
 * In-memory offers / deposits / CAS-I20 / visa tracking for demo portal.
 * Linked to mock students + applications. No payment gateway or embassy integrations.
 */
import { appendAuditEvent } from "@/data/immutable-audit";
import type {
  CasI20Record,
  DepositRecord,
  OfferConditionRecord,
  OfferRecord,
  VisaMilestoneRecord,
} from "@/types/offers-visa";

export const offerRecords: OfferRecord[] = [
  {
    id: "off1",
    applicationId: "APP-3011",
    studentId: "s8",
    offerType: "unconditional",
    status: "awaiting_student",
    offerDate: "2026-09-28",
    responseDeadline: "2026-10-20",
    tuitionFee: "EUR 2,800 / year",
    scholarshipNote: null,
  },
  {
    id: "off2",
    applicationId: "APP-3008",
    studentId: "s4",
    offerType: "conditional",
    status: "conditions_pending",
    offerDate: "2026-10-01",
    responseDeadline: "2026-11-05",
    tuitionFee: null,
    scholarshipNote: null,
  },
  {
    id: "off3",
    applicationId: "APP-3012",
    studentId: "s11",
    offerType: "conditional",
    status: "conditions_pending",
    offerDate: "2026-10-03",
    responseDeadline: "2026-11-15",
    tuitionFee: "GBP 24,500",
    scholarshipNote: null,
  },
  {
    id: "off4",
    applicationId: "APP-3013",
    studentId: "s12",
    offerType: "unconditional",
    status: "accepted",
    offerDate: "2026-09-10",
    responseDeadline: "2026-09-30",
    tuitionFee: "GBP 18,000",
    scholarshipNote: null,
  },
];

export const offerConditions: OfferConditionRecord[] = [
  {
    id: "oc1",
    offerId: "off2",
    description: "Final Bachelor transcript with official stamp",
    met: true,
    metAt: "2026-10-04T10:00:00.000Z",
    sortOrder: 1,
  },
  {
    id: "oc2",
    offerId: "off2",
    description: "German language certificate (B2) or exemption letter",
    met: false,
    metAt: null,
    sortOrder: 2,
  },
  {
    id: "oc3",
    offerId: "off3",
    description: "Updated IELTS TRF meeting programme minimum",
    met: false,
    metAt: null,
    sortOrder: 1,
  },
];

export const depositRecords: DepositRecord[] = [
  {
    id: "dep1",
    offerId: "off4",
    studentId: "s12",
    amount: 2000,
    currency: "GBP",
    status: "paid",
    dueDate: "2026-10-05",
    paidAt: "2026-09-28T14:20:00.000Z",
    reference: "REF-ESX-9921",
    notes: "Tuition deposit recorded against University of Essex offer.",
  },
  {
    id: "dep2",
    offerId: "off1",
    studentId: "s8",
    amount: 500,
    currency: "EUR",
    status: "due",
    dueDate: "2026-10-25",
    paidAt: null,
    reference: null,
    notes: "Enrolment deposit due after acceptance — not yet paid.",
  },
];

export const casI20Records: CasI20Record[] = [
  {
    id: "cas1",
    studentId: "s12",
    applicationId: "APP-3013",
    offerId: "off4",
    recordType: "CAS",
    status: "issued",
    referenceNumber: "E4G9K2L8M1",
    issuedAt: "2026-10-02",
    expiresAt: "2026-12-31",
    notes: "CAS released after deposit confirmation.",
  },
  {
    id: "cas2",
    studentId: "s11",
    applicationId: "APP-3012",
    offerId: "off3",
    recordType: "CAS",
    status: "requested",
    referenceNumber: null,
    issuedAt: null,
    expiresAt: null,
    notes: "CAS request lodged; awaiting university release.",
  },
];

export const visaMilestones: VisaMilestoneRecord[] = [
  {
    id: "vm1",
    studentId: "s12",
    applicationId: "APP-3013",
    casI20Id: "cas1",
    stage: "biometrics",
    decision: "pending",
    filedAt: "2026-10-05",
    biometricsAt: "2026-10-12",
    decisionAt: null,
    notes: "Biometrics appointment booked.",
  },
  {
    id: "vm2",
    studentId: "s11",
    applicationId: "APP-3012",
    casI20Id: "cas2",
    stage: "doc_prep",
    decision: "pending",
    filedAt: null,
    biometricsAt: null,
    decisionAt: null,
    notes: "Document preparation while CAS request is outstanding.",
  },
  {
    id: "vm3",
    studentId: "s8",
    applicationId: "APP-3011",
    casI20Id: null,
    stage: "filed",
    decision: "pending",
    filedAt: "2026-10-01",
    biometricsAt: null,
    decisionAt: null,
    notes: "Italy — no CAS/I-20. Visa filed; biometrics not recorded.",
  },
];

export type OfferAuditEntry = {
  id: string;
  offerId: string | null;
  entityId: string;
  entity: "Offer" | "Deposit" | "CAS/I-20" | "Visa";
  at: string;
  actorId: string | null;
  actorName: string;
  action: string;
  note: string | null;
};

export const offerAuditHistory: OfferAuditEntry[] = [
  {
    id: "oa1",
    offerId: "off4",
    entityId: "off4",
    entity: "Offer",
    at: "2026-09-22T11:00:00.000Z",
    actorId: "c1",
    actorName: "Ayesha Khan",
    action: "Offer accepted",
    note: "All acceptance rules satisfied (unconditional).",
  },
  {
    id: "oa2",
    offerId: "off4",
    entityId: "dep1",
    entity: "Deposit",
    at: "2026-09-28T14:20:00.000Z",
    actorId: "c1",
    actorName: "Ayesha Khan",
    action: "Deposit marked paid",
    note: "Reference REF-ESX-9921",
  },
  {
    id: "oa3",
    offerId: "off4",
    entityId: "cas1",
    entity: "CAS/I-20",
    at: "2026-10-02T09:30:00.000Z",
    actorId: "c1",
    actorName: "Ayesha Khan",
    action: "CAS issued",
    note: "E4G9K2L8M1",
  },
];

export function conditionsForOffer(offerId: string) {
  return offerConditions
    .filter((c) => c.offerId === offerId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function depositForOffer(offerId: string) {
  return depositRecords.find((d) => d.offerId === offerId) ?? null;
}

export function casForOffer(offerId: string) {
  return casI20Records.find((c) => c.offerId === offerId) ?? null;
}

export function visaForApplication(applicationId: string) {
  return visaMilestones.find((v) => v.applicationId === applicationId) ?? null;
}

export function appendOfferAudit(entry: OfferAuditEntry) {
  offerAuditHistory.unshift(entry);
  const offer = entry.offerId ? offerRecords.find((o) => o.id === entry.offerId) : null;
  appendAuditEvent({
    id: `al-off-${entry.id}`,
    actorId: entry.actorId,
    actorName: entry.actorName,
    action: entry.action,
    entityType: entry.entity,
    entityId: entry.entityId,
    applicationId: offer?.applicationId ?? null,
    studentId: offer?.studentId ?? null,
    detail: entry.note,
    createdAt: entry.at,
  });
  return entry;
}

