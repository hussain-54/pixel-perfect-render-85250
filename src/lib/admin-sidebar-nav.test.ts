import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Contract: Admin sidebar lists exactly the approved 13 items in order. */
const EXPECTED_SIDEBAR = [
  "Dashboard",
  "Students",
  "Counselling",
  "Admissions",
  "Documents",
  "Fees & Payments",
  "Banking & Finance",
  "HR & Attendance",
  "Digital Marketing",
  "Orders / Sales / Purchase",
  "Reports",
  "Users & Roles",
  "Settings",
] as const;

describe("admin sidebar nav contract", () => {
  it("defines exactly the 13 approved labels in order", () => {
    const src = readFileSync(join(process.cwd(), "src/routes/admin/route.tsx"), "utf8");
    const labels = [...src.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual([...EXPECTED_SIDEBAR]);
  });

  it("does not list sub-features in the main adminNav array", () => {
    const src = readFileSync(join(process.cwd(), "src/routes/admin/route.tsx"), "utf8");
    for (const forbidden of [
      "Leads",
      "Universities",
      "Programs",
      "Scholarships",
      "Consultants",
      "Leaderboard",
      "Import / Export",
      "Notifications",
      "Audit logs",
      "Office Ops",
    ]) {
      expect(src).not.toContain(`label: "${forbidden}"`);
    }
  });
});
