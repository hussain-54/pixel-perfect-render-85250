import { describe, expect, it } from "vitest";
import {
  campaignConversionMetrics,
  campaignInquiryMetrics,
  canAttributeInquiryCampaign,
  canMutateMarketing,
  canReopenCompletedCampaign,
  canViewMarketing,
  formatMetricValue,
  isValidCampaignStatusTransition,
  validateCampaignCreate,
  validateCampaignId,
} from "./marketing-rules";

describe("digital marketing rules", () => {
  it("allows digital manager to mutate; counsellor and Front Desk denied", () => {
    expect(canMutateMarketing({ appRole: "consultant", businessRole: "digital_manager" })).toBe(
      true,
    );
    expect(
      canMutateMarketing({ appRole: "consultant", businessRole: "counsellor_consultant" }),
    ).toBe(false);
    expect(canViewMarketing({ appRole: "consultant", businessRole: "counsellor_consultant" })).toBe(
      false,
    );
    // Product deny overrides matrix View=1 for Front Desk.
    expect(
      canViewMarketing({ appRole: "consultant", businessRole: "front_desk_student_affairs" }),
    ).toBe(false);
    expect(
      canMutateMarketing({ appRole: "consultant", businessRole: "front_desk_student_affairs" }),
    ).toBe(false);
    expect(
      canAttributeInquiryCampaign({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canAttributeInquiryCampaign({ appRole: "consultant", businessRole: "digital_manager" }),
    ).toBe(true);
  });

  it("keeps Admin and Super Admin able to mutate; Super Admin alone reopens completed", () => {
    expect(canMutateMarketing({ appRole: "admin", businessRole: null })).toBe(true);
    expect(canMutateMarketing({ appRole: "super_admin", businessRole: null })).toBe(true);
    expect(canReopenCompletedCampaign("admin")).toBe(false);
    expect(canReopenCompletedCampaign("super_admin")).toBe(true);
    expect(
      isValidCampaignStatusTransition({
        from: "completed",
        to: "active",
        appRole: "admin",
      }),
    ).toBe(false);
    expect(
      isValidCampaignStatusTransition({
        from: "completed",
        to: "active",
        appRole: "super_admin",
      }),
    ).toBe(true);
  });

  it("rejects invalid campaign IDs and accepts null clear", () => {
    expect(validateCampaignId("not-a-uuid").ok).toBe(false);
    expect(validateCampaignId(null)).toEqual({ ok: true, id: null });
    expect(validateCampaignId("550e8400-e29b-41d4-a716-446655440000")).toEqual({
      ok: true,
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("validates campaign dates and name", () => {
    expect(validateCampaignCreate({ name: "" }).ok).toBe(false);
    expect(
      validateCampaignCreate({
        name: "Spring Ads",
        startsOn: "2026-06-01",
        endsOn: "2026-05-01",
      }).ok,
    ).toBe(false);
    expect(validateCampaignCreate({ name: "Spring Ads", startsOn: "2026-05-01" }).ok).toBe(true);
  });

  it("derives campaign metrics only from linked persisted inquiries", () => {
    const m = campaignInquiryMetrics(
      [
        { campaignId: "c1", status: "new" },
        { campaignId: "c1", status: "assigned" },
        { campaignId: "c2", status: "new" },
        { campaignId: null, status: "new" },
      ],
      "c1",
    );
    expect(m.inquiries).toBe(2);
    expect(m.newCount).toBe(1);
    expect(m.assignedCount).toBe(1);
  });

  it("distinguishes unavailable conversion from zero", () => {
    expect(
      campaignConversionMetrics({
        inquiryEmails: ["a@example.com"],
        studentEmails: null,
      }),
    ).toEqual({
      registeredStudents: null,
      unavailableReason: "Student match data unavailable on this plane",
    });
    expect(formatMetricValue(null)).toBe("N/A");
    expect(
      campaignConversionMetrics({
        inquiryEmails: ["a@example.com", "b@example.com"],
        studentEmails: ["a@example.com"],
      }).registeredStudents,
    ).toBe(1);
    expect(
      campaignConversionMetrics({
        inquiryEmails: ["x@example.com"],
        studentEmails: [],
      }).registeredStudents,
    ).toBe(0);
    expect(formatMetricValue(0)).toBe("0");
  });
});
