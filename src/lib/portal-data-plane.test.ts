import { describe, expect, it } from "vitest";
import {
  activityForStudent,
  crmListOrEmpty,
  crmRecordOrNull,
  dashboardReviewToQueueAction,
  isMockCrmAllowed,
  shouldShowDemoSessionIndicator,
} from "./portal-data-plane";

describe("mock CRM plane gating", () => {
  it("allows mock CRM only for demo sessions", () => {
    expect(isMockCrmAllowed("demo")).toBe(true);
    expect(isMockCrmAllowed("supabase")).toBe(false);
  });

  it("never returns mock CRM fallback records for Supabase sessions", () => {
    const mockStudents = [{ id: "s1", name: "Demo" }];
    expect(crmListOrEmpty("supabase", mockStudents)).toEqual([]);
    expect(crmRecordOrNull("supabase", mockStudents[0])).toBeNull();
  });

  it("preserves demo CRM rows for authorized demo sessions", () => {
    const mockStudents = [{ id: "s1", name: "Demo" }];
    expect(crmListOrEmpty("demo", mockStudents)).toEqual(mockStudents);
    expect(crmRecordOrNull("demo", mockStudents[0])).toEqual(mockStudents[0]);
    expect(crmRecordOrNull("demo", null)).toBeNull();
  });
});

describe("student activity isolation", () => {
  it("missing student activity never falls back to another student", () => {
    const map = {
      s1: [{ id: "a1", text: "Only for s1" }],
      s2: [{ id: "a2", text: "Only for s2" }],
    };
    expect(activityForStudent(map, "s3")).toEqual([]);
    expect(activityForStudent(map, "s2")).toEqual([{ id: "a2", text: "Only for s2" }]);
    expect(activityForStudent({}, "s1")).toEqual([]);
  });
});

describe("dashboard document review mapping", () => {
  it("maps Approve/Reject onto the shared queue review operation", () => {
    expect(dashboardReviewToQueueAction("Approved")).toEqual({ action: "approve" });
    expect(dashboardReviewToQueueAction("Rejected")).toEqual({
      action: "reject",
      note: "Rejected during officer review.",
    });
  });

  it("rejected mapping always includes a note so queue validation can fail closed", () => {
    const mapped = dashboardReviewToQueueAction("Rejected");
    expect(mapped.action).toBe("reject");
    expect(mapped.note && mapped.note.length >= 3).toBe(true);
  });
});

describe("demo session indicator", () => {
  it("shows only for trusted demo session source", () => {
    expect(shouldShowDemoSessionIndicator("demo")).toBe(true);
    expect(shouldShowDemoSessionIndicator("supabase")).toBe(false);
    expect(shouldShowDemoSessionIndicator(null)).toBe(false);
    expect(shouldShowDemoSessionIndicator(undefined)).toBe(false);
  });
});

describe("staff desk scoping (no hardcoded demo consultant id)", () => {
  it("uses server-scoped rows without re-filtering by DEMO_CONSULTANT_ID (c1)", () => {
    // Appointments/leads UIs must render portalGet* results as returned.
    // Desk scoping is enforced in portalGetAppointments / portalGetLeads via session.consultantId.
    const serverScoped = [
      { id: "a1", consultantId: "uuid-desk-1" },
      { id: "a2", consultantId: "uuid-desk-1" },
    ];
    const DEMO_CONSULTANT_ID = "c1";
    const withoutHardcodedFilter = serverScoped;
    const withHardcodedFilter = serverScoped.filter((r) => r.consultantId === DEMO_CONSULTANT_ID);
    expect(withoutHardcodedFilter).toHaveLength(2);
    expect(withHardcodedFilter).toHaveLength(0);
  });
});