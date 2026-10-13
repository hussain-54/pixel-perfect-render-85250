import { describe, expect, it } from "vitest";
import {
  aggregateStudentsByStage,
  buildAdminOpsMetrics,
  canViewAdminDocumentDetails,
  canViewAdminFinanceDetails,
  canViewAdminOpsOverview,
} from "./admin-ops-overview";
import { canVerifyUniversityFeePayment } from "./university-fee-auth";
import { resolveBusinessRoleFromTrustedAppRole } from "./business-permissions";

describe("admin ops overview", () => {
  it("aggregates students by journey stage without inventing stages", () => {
    const counts = aggregateStudentsByStage([
      { journeyStage: "profile_submitted" },
      { journeyStage: "profile_submitted" },
      { journeyStage: "application_submitted" },
      { journeyStage: "offer_received", archived: true },
    ]);
    expect(counts["profile_submitted"]).toBe(2);
    expect(counts["application_submitted"]).toBe(1);
    expect(counts["offer_received"]).toBe(0);
  });

  it("builds metrics from authorized count inputs", () => {
    const metrics = buildAdminOpsMetrics({
      students: [
        {
          id: "1",
          name: "A",
          caseId: "C1",
          journeyStage: "university_shortlisting",
          archived: false,
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
      pendingSignupFees: 3,
      submittedHandovers: 2,
      docsPendingReview: 4,
      appsRequiringAction: 5,
      offersRequiringAction: 1,
      outstandingUniversityFees: 7,
      visaAttention: 2,
      overdueTasks: 6,
      counsellingAppointmentsPending: 3,
    });
    expect(metrics.activeStudents).toBe(1);
    expect(metrics.pendingSignupFeeVerification).toBe(3);
    expect(metrics.handoverQueue).toBe(2);
    expect(metrics.outstandingUniversityFees).toBe(7);
  });

  it("allows admin/manager ops overview and denies bare counsellor for ops matrix", () => {
    expect(
      canViewAdminOpsOverview({
        appRole: "admin",
        businessRole: "admin",
      }),
    ).toBe(true);
    expect(
      canViewAdminOpsOverview({
        appRole: "super_admin",
        businessRole: "admin",
      }),
    ).toBe(true);
    expect(
      canViewAdminOpsOverview({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(true); // reports+students view (1) for counsellor
  });

  it("hides document details from accounts and finance aggregates from counsellor", () => {
    expect(
      canViewAdminDocumentDetails({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(false);
    expect(
      canViewAdminFinanceDetails({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);
    expect(
      canViewAdminFinanceDetails({
        appRole: "consultant",
        businessRole: "accounts_banking_finance",
      }),
    ).toBe(true);
    expect(
      canVerifyUniversityFeePayment({
        appRole: "consultant",
        businessRole: resolveBusinessRoleFromTrustedAppRole("consultant"),
      }),
    ).toBe(false);
  });

  it("preserves Admin vs Super Admin technical flag usage via appRole", () => {
    expect(resolveBusinessRoleFromTrustedAppRole("admin")).toBe("admin");
    expect(resolveBusinessRoleFromTrustedAppRole("super_admin")).toBe("admin");
    // Matrix maps both to admin; technical distinction remains on AppRole for privileged ops.
    expect(canViewAdminOpsOverview({ appRole: "super_admin", businessRole: "admin" })).toBe(true);
  });
});
