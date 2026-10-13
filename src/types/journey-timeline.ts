/** Chronological journey timeline derived from persisted workflow records. */

export type TimelineItemStatus =
  | "completed"
  | "current"
  | "pending"
  | "claimed"
  | "rejected"
  | "returned"
  | "overdue";

export type TimelineCategory =
  | "registration"
  | "signup_fee"
  | "activation"
  | "counsellor"
  | "appointment"
  | "assessment"
  | "agreement"
  | "handover"
  | "document"
  | "application"
  | "offer"
  | "university_fee"
  | "visa";

export type JourneyTimelineItem = {
  id: string;
  category: TimelineCategory;
  title: string;
  detail: string | null;
  at: string | null;
  status: TimelineItemStatus;
  responsibleTeam: string | null;
  pendingAction: string | null;
};

export type JourneyTimelinePayload = {
  studentId: string;
  journeyStage: string;
  items: JourneyTimelineItem[];
  pendingActions: JourneyTimelineItem[];
};
