/**
 * Pure builder: chronological student journey from persisted record snapshots.
 * Does not invent completed events — only emits items backed by source rows
 * (plus explicit pending gaps derived from missing/failed records).
 */
import type {
  JourneyTimelineItem,
  JourneyTimelinePayload,
  TimelineItemStatus,
} from "@/types/journey-timeline";

export type TimelineStudentSnap = {
  id: string;
  createdAt: string;
  portalActivatedAt: string | null;
  assignedConsultantId: string | null;
  journeyStage: string;
  inquirySource?: string | null;
};

export type TimelineSignupFeeSnap = {
  id: string;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  amount?: number | null;
  currency?: string | null;
};

export type TimelineAppointmentSnap = {
  id: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
};

export type TimelineAssessmentSnap = {
  id: string;
  assessedAt: string | null;
  createdAt: string;
};

export type TimelineAgreementSnap = {
  id: string;
  consented: boolean;
  createdAt: string;
  sessionDate: string | null;
};

export type TimelineHandoverSnap = {
  id: string;
  status: string;
  handedOverAt: string;
  summary: string | null;
};

export type TimelineDocumentSnap = {
  id: string;
  label: string;
  status: string;
  createdAt: string;
  updatedAt: string | null;
};

export type TimelineApplicationSnap = {
  id: string;
  university: string;
  program: string;
  stage: string;
  createdAt: string;
  submittedAt: string | null;
};

export type TimelineOfferSnap = {
  id: string;
  status: string;
  offerType: string;
  createdAt: string;
  offerDate: string | null;
};

export type TimelineUniversityFeeSnap = {
  id: string;
  kind: string;
  label: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: string;
  verifiedAt: string | null;
  dueDate: string | null;
};

export type TimelineVisaSnap = {
  id: string;
  stage: string;
  decision: string | null;
  createdAt: string;
  updatedAt: string | null;
};

export type StudentJourneyTimelineSource = {
  student: TimelineStudentSnap;
  signupFee: TimelineSignupFeeSnap | null;
  appointments: TimelineAppointmentSnap[];
  assessments: TimelineAssessmentSnap[];
  agreements: TimelineAgreementSnap[];
  handovers: TimelineHandoverSnap[];
  documents: TimelineDocumentSnap[];
  applications: TimelineApplicationSnap[];
  offers: TimelineOfferSnap[];
  universityFees: TimelineUniversityFeeSnap[];
  visas: TimelineVisaSnap[];
  /** ISO now for overdue checks (injectable for tests). */
  nowIso?: string;
};

function feeStatus(status: string): TimelineItemStatus {
  if (status === "verified" || status === "waived") return "completed";
  if (status === "claimed") return "claimed";
  if (status === "rejected") return "rejected";
  return "pending";
}

function docStatus(status: string): TimelineItemStatus {
  const s = status.toLowerCase();
  if (s === "approved" || s.includes("approved")) return "completed";
  if (s === "rejected" || s.includes("rejected")) return "rejected";
  if (s.includes("correction") || s.includes("reupload")) return "pending";
  return "pending";
}

function handoverStatus(status: string): TimelineItemStatus {
  if (status === "accepted") return "completed";
  if (status === "returned") return "returned";
  return "pending";
}

function isOverdue(dueDate: string | null, status: string, now: Date): boolean {
  if (!dueDate) return false;
  if (status === "verified" || status === "waived" || status === "paid") return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < now.getTime();
}

/** Build chronological timeline; sort by `at` ascending (nulls last within same day). */
export function buildStudentJourneyTimeline(
  source: StudentJourneyTimelineSource,
): JourneyTimelinePayload {
  const now = new Date(source.nowIso ?? Date.now());
  const items: JourneyTimelineItem[] = [];
  const s = source.student;

  items.push({
    id: `reg-${s.id}`,
    category: "registration",
    title: "Inquiry / registration",
    detail: s.inquirySource ? `Source: ${s.inquirySource}` : "Front Desk registration recorded",
    at: s.createdAt,
    status: "completed",
    responsibleTeam: "Front Desk",
    pendingAction: null,
  });

  if (source.signupFee) {
    const fee = source.signupFee;
    const st = feeStatus(fee.status);
    items.push({
      id: `signup-fee-${fee.id}`,
      category: "signup_fee",
      title: "Signup fee",
      detail: `${fee.status}${fee.amount != null ? ` · ${fee.currency ?? ""} ${fee.amount}` : ""}`,
      at: fee.verifiedAt ?? fee.createdAt,
      status: st,
      responsibleTeam:
        st === "claimed" || st === "pending" ? "Accounts / Finance" : "Accounts / Finance",
      pendingAction:
        st === "claimed" || st === "pending"
          ? "Awaiting Accounts verification (claimed is not verified)"
          : st === "rejected"
            ? "Resubmit payment evidence to Front Desk / Accounts"
            : null,
    });
  }

  if (s.portalActivatedAt) {
    items.push({
      id: `activation-${s.id}`,
      category: "activation",
      title: "Student portal activated",
      detail: "Portal access unlocked after authorized fee verification or waiver",
      at: s.portalActivatedAt,
      status: "completed",
      responsibleTeam: "Accounts / Admin",
      pendingAction: null,
    });
  } else if (
    source.signupFee &&
    ["verified", "waived"].includes(source.signupFee.status) === false
  ) {
    items.push({
      id: `activation-pending-${s.id}`,
      category: "activation",
      title: "Portal activation",
      detail: "Not activated until signup fee is verified or waived",
      at: null,
      status: "pending",
      responsibleTeam: "Accounts / Admin",
      pendingAction: "Complete signup fee verification to unlock the portal",
    });
  }

  if (s.assignedConsultantId) {
    items.push({
      id: `counsellor-${s.id}`,
      category: "counsellor",
      title: "Counsellor assigned",
      detail: "Case assigned to a counsellor",
      at: s.createdAt,
      status: "completed",
      responsibleTeam: "Front Desk / Counsellor",
      pendingAction: null,
    });
  }

  for (const a of source.appointments) {
    const st =
      a.status === "completed" || a.status === "Confirmed" || a.status === "completed"
        ? "completed"
        : a.status === "cancelled" || a.status === "Cancelled"
          ? "rejected"
          : "pending";
    items.push({
      id: `appt-${a.id}`,
      category: "appointment",
      title: "Counselling appointment",
      detail: `Status: ${a.status}`,
      at: a.scheduledAt ?? a.createdAt,
      status: st === "completed" ? "completed" : st === "rejected" ? "rejected" : "pending",
      responsibleTeam: "Counsellor",
      pendingAction: st === "pending" ? "Attend or confirm your counselling appointment" : null,
    });
  }

  for (const a of source.assessments) {
    items.push({
      id: `assessment-${a.id}`,
      category: "assessment",
      title: "Counsellor assessment",
      detail: "Assessment recorded on file",
      at: a.assessedAt ?? a.createdAt,
      status: "completed",
      responsibleTeam: "Counsellor",
      pendingAction: null,
    });
  }

  for (const ag of source.agreements) {
    items.push({
      id: `agreement-${ag.id}`,
      category: "agreement",
      title: "Counselling agreement / consent",
      detail: ag.consented ? "Consent recorded" : "Agreement without consent",
      at: ag.sessionDate ?? ag.createdAt,
      status: ag.consented ? "completed" : "pending",
      responsibleTeam: "Counsellor",
      pendingAction: ag.consented ? null : "Provide counselling consent",
    });
  }

  for (const h of source.handovers) {
    const st = handoverStatus(h.status);
    items.push({
      id: `handover-${h.id}`,
      category: "handover",
      title: "Admission handover",
      detail: h.summary?.slice(0, 160) ?? `Status: ${h.status}`,
      at: h.handedOverAt,
      status: st,
      responsibleTeam: st === "pending" ? "Admission Team" : "Admission Team",
      pendingAction:
        st === "pending"
          ? "Admission Team acceptance pending"
          : st === "returned"
            ? "Address returned handover notes with your counsellor"
            : null,
    });
  }

  for (const d of source.documents) {
    const st = docStatus(d.status);
    items.push({
      id: `doc-${d.id}`,
      category: "document",
      title: `Document: ${d.label || "File"}`,
      detail: `Status: ${d.status}`,
      at: d.updatedAt ?? d.createdAt,
      status: st,
      responsibleTeam: st === "pending" ? "Admission Team / Documents" : "Admission Team",
      pendingAction:
        st === "rejected" || (st === "pending" && /correction|reupload|needs/i.test(d.status))
          ? "Upload or correct the requested document"
          : st === "pending"
            ? "Awaiting document verification"
            : null,
    });
  }

  for (const app of source.applications) {
    const rejected = app.stage === "rejected" || app.stage === "withdrawn";
    const submitted =
      Boolean(app.submittedAt) || ["submitted", "offer_received"].includes(app.stage);
    items.push({
      id: `app-${app.id}`,
      category: "application",
      title: `Application: ${app.university}`,
      detail: `${app.program} · ${app.stage}`,
      at: app.submittedAt ?? app.createdAt,
      status: rejected ? "rejected" : submitted ? "completed" : "pending",
      responsibleTeam: "Admission Team",
      pendingAction: rejected
        ? null
        : submitted
          ? null
          : "Complete outstanding application requirements",
    });
  }

  for (const o of source.offers) {
    const st =
      o.status === "accepted"
        ? "completed"
        : o.status === "declined" || o.status === "expired"
          ? "rejected"
          : "pending";
    items.push({
      id: `offer-${o.id}`,
      category: "offer",
      title: `Offer (${o.offerType})`,
      detail: `Status: ${o.status}`,
      at: o.offerDate ?? o.createdAt,
      status: st,
      responsibleTeam: "Admission Team",
      pendingAction:
        st === "pending" ? "Review offer conditions and respond by the deadline" : null,
    });
  }

  for (const f of source.universityFees) {
    let st = feeStatus(f.status);
    if (isOverdue(f.dueDate, f.status, now)) st = "overdue";
    items.push({
      id: `ufee-${f.id}`,
      category: "university_fee",
      title: `University fee: ${f.label || f.kind}`,
      detail: `${f.currency} ${f.amount} · ${f.status}${f.kind ? ` · ${f.kind}` : ""}`,
      at: f.verifiedAt ?? f.createdAt,
      status: st,
      responsibleTeam: "Accounts / Finance",
      pendingAction:
        st === "claimed" || st === "pending" || st === "overdue"
          ? "Provide payment evidence; Accounts must verify (claimed ≠ verified)"
          : st === "rejected"
            ? "Resolve rejected university fee payment"
            : null,
    });
  }

  for (const v of source.visas) {
    const decided = v.decision && v.decision !== "pending";
    const refused = v.decision === "refused";
    items.push({
      id: `visa-${v.id}`,
      category: "visa",
      title: "Visa milestone",
      detail: `Stage: ${v.stage}${v.decision ? ` · ${v.decision}` : ""}`,
      at: v.updatedAt ?? v.createdAt,
      status: refused ? "rejected" : decided ? "completed" : "pending",
      responsibleTeam: "Admission Team",
      pendingAction: decided ? null : "Complete visa documentation with your officer",
    });
  }

  items.sort((a, b) => {
    if (!a.at && !b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at.localeCompare(b.at);
  });

  const pendingActions = items.filter((i) => i.pendingAction);

  return {
    studentId: s.id,
    journeyStage: s.journeyStage,
    items,
    pendingActions,
  };
}

/** Student may only receive a timeline for their own linked student id. */
export function assertTimelineOwner(input: {
  sessionStudentId: string | null | undefined;
  timelineStudentId: string | null | undefined;
  isStaff: boolean;
}): boolean {
  if (input.isStaff) return Boolean(input.timelineStudentId);
  if (!input.sessionStudentId || !input.timelineStudentId) return false;
  return input.sessionStudentId === input.timelineStudentId;
}
