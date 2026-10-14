import { describe, expect, it } from "vitest";
import {
  canAssignConsultationLead,
  canUpdateConsultationLeadStatus,
  filterLeadsForDeskScope,
  isEligibleLeadAssigneeStatus,
  leadStatusToDbValue,
  mapConsultationRequestToLead,
  mapLeadSource,
  mapLeadStatus,
  parseLeadStatusInput,
} from "./lead-mappers";

describe("lead mappers (consultation_requests → Lead)", () => {
  it("maps known statuses and defaults unknown display mapping to New", () => {
    expect(mapLeadStatus("new")).toBe("New");
    expect(mapLeadStatus("consultation_booked")).toBe("Consultation Booked");
    expect(mapLeadStatus("Consultation Booked")).toBe("Consultation Booked");
    expect(mapLeadStatus("lost")).toBe("Lost");
    expect(mapLeadStatus("weird")).toBe("New");
  });

  it("parses only allow-listed status inputs for mutations", () => {
    expect(parseLeadStatusInput("Contacted")).toBe("Contacted");
    expect(parseLeadStatusInput("consultation_booked")).toBe("Consultation Booked");
    expect(parseLeadStatusInput("lost")).toBe("Lost");
    expect(parseLeadStatusInput("weird")).toBeNull();
    expect(parseLeadStatusInput("")).toBeNull();
    expect(leadStatusToDbValue("Consultation Booked")).toBe("consultation_booked");
  });

  it("prefers attribution_source then original then Website", () => {
    expect(
      mapLeadSource({
        id: "1",
        full_name: "A",
        email: "a@b.c",
        phone: "12345678",
        destination: null,
        study_level: null,
        program: null,
        status: "new",
        assigned_consultant_id: null,
        attribution_source: "Facebook",
        original_attribution_source: "Google",
        created_at: "2026-10-01T00:00:00Z",
      }),
    ).toBe("Facebook");
    expect(
      mapLeadSource({
        id: "1",
        full_name: "A",
        email: "a@b.c",
        phone: "12345678",
        destination: null,
        study_level: null,
        program: null,
        status: "new",
        assigned_consultant_id: null,
        attribution_source: null,
        original_attribution_source: "Instagram",
        created_at: "2026-10-01T00:00:00Z",
      }),
    ).toBe("Instagram");
    expect(
      mapLeadSource({
        id: "1",
        full_name: "A",
        email: "a@b.c",
        phone: "12345678",
        destination: null,
        study_level: null,
        program: null,
        status: "new",
        assigned_consultant_id: null,
        created_at: "2026-10-01T00:00:00Z",
      }),
    ).toBe("Website");
  });

  it("maps row to Lead without inventing contact fields", () => {
    const lead = mapConsultationRequestToLead({
      id: "uuid-1",
      full_name: "Rabia Aslam",
      email: "rabia@example.com",
      phone: "+92 300 0000000",
      destination: "Canada",
      study_level: "Undergraduate",
      program: null,
      status: "contacted",
      assigned_consultant_id: "desk-1",
      attribution_source: "Website",
      created_at: "2026-09-30T15:00:00.000Z",
    });
    expect(lead).toEqual({
      id: "uuid-1",
      name: "Rabia Aslam",
      email: "rabia@example.com",
      phone: "+92 300 0000000",
      country: "Canada",
      program: "Undergraduate",
      source: "Website",
      consultantId: "desk-1",
      status: "Contacted",
      created: "2026-09-30",
    });
  });

  it("scopes desk consultants to assigned leads; admin/manager see all", () => {
    const rows = [
      { id: "a", assigned_consultant_id: "desk-1" },
      { id: "b", assigned_consultant_id: null },
      { id: "c", assigned_consultant_id: "desk-2" },
    ];
    expect(filterLeadsForDeskScope(rows, { isAdmin: true, deskId: null }).map((r) => r.id)).toEqual(
      ["a", "b", "c"],
    );
    expect(
      filterLeadsForDeskScope(rows, { isAdmin: false, isManager: true, deskId: null }).map(
        (r) => r.id,
      ),
    ).toEqual(["a", "b", "c"]);
    expect(
      filterLeadsForDeskScope(rows, { isAdmin: false, deskId: "desk-1" }).map((r) => r.id),
    ).toEqual(["a"]);
    expect(filterLeadsForDeskScope(rows, { isAdmin: false, deskId: null })).toEqual([]);
  });

  it("authorizes assignment for admin/manager only; status for desk owner", () => {
    expect(canAssignConsultationLead({ appRole: "admin", businessRole: null })).toBe(true);
    expect(canAssignConsultationLead({ appRole: "consultant", businessRole: "manager" })).toBe(
      true,
    );
    expect(
      canAssignConsultationLead({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
      }),
    ).toBe(false);

    expect(
      canUpdateConsultationLeadStatus({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
        deskId: "desk-1",
        assignedConsultantId: "desk-1",
      }),
    ).toBe(true);
    expect(
      canUpdateConsultationLeadStatus({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
        deskId: "desk-1",
        assignedConsultantId: "desk-2",
      }),
    ).toBe(false);
    expect(
      canUpdateConsultationLeadStatus({
        appRole: "consultant",
        businessRole: "counsellor_consultant",
        deskId: "desk-1",
        assignedConsultantId: null,
      }),
    ).toBe(false);
    expect(isEligibleLeadAssigneeStatus("active")).toBe(true);
    expect(isEligibleLeadAssigneeStatus("inactive")).toBe(false);
  });
});
