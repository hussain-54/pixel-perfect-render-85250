import { describe, expect, it } from "vitest";
import {
  countStudentsByConsultantId,
  emptyConsultantMetrics,
  mapConsultantDeskRow,
  mapConsultantStatus,
} from "./consultant-mappers";
import type { ConsultantRow } from "@/types/database";

const desk = {
  id: "c1",
  department: "UK & Europe",
  desk: "UK desk",
  job_title: "Senior Consultant",
  status: "active",
  phone: "+92 300",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
} as ConsultantRow;

describe("consultant mappers (live desk → UI)", () => {
  it("maps status and profile name/email", () => {
    expect(mapConsultantStatus("active")).toBe("Active");
    expect(mapConsultantStatus("inactive")).toBe("Inactive");
    const ui = mapConsultantDeskRow(desk, {
      profile: { full_name: "Ayesha Khan", email: "ayesha@example.com" },
      studentCount: 12,
    });
    expect(ui.name).toBe("Ayesha Khan");
    expect(ui.email).toBe("ayesha@example.com");
    expect(ui.role).toBe("Senior Consultant");
    expect(ui.department).toBe("UK & Europe");
    expect(ui.status).toBe("Active");
    expect(ui.metrics.students).toBe(12);
    expect(ui.metrics.offers).toBe(0);
  });

  it("falls back safely when profile name is missing", () => {
    const ui = mapConsultantDeskRow(desk, { profile: { full_name: "  ", email: null } });
    expect(ui.name).toBe("UK desk");
    expect(ui.email).toBe("");
  });

  it("counts assigned students without inventing metrics", () => {
    expect(emptyConsultantMetrics(3).students).toBe(3);
    const counts = countStudentsByConsultantId([
      { assigned_consultant_id: "c1" },
      { assigned_consultant_id: "c1" },
      { assigned_consultant_id: null },
      { assigned_consultant_id: "c2" },
    ]);
    expect(counts.get("c1")).toBe(2);
    expect(counts.get("c2")).toBe(1);
  });
});
