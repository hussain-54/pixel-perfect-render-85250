import { describe, expect, it } from "vitest";
import { resolveCrmListStudentIds } from "./student-crm-scope";

describe("resolveCrmListStudentIds", () => {
  it("students only see their own id; reject mismatched client studentId", () => {
    expect(
      resolveCrmListStudentIds({
        role: "student",
        ownStudentId: "s1",
        requestedStudentId: undefined,
        visibleStudentIds: [],
      }),
    ).toEqual({ ok: true, studentIds: ["s1"] });

    expect(
      resolveCrmListStudentIds({
        role: "student",
        ownStudentId: "s1",
        requestedStudentId: "s2",
        visibleStudentIds: [],
      }).ok,
    ).toBe(false);

    expect(
      resolveCrmListStudentIds({
        role: "student",
        ownStudentId: null,
        requestedStudentId: null,
        visibleStudentIds: [],
      }).ok,
    ).toBe(false);
  });

  it("staff scoped to requested visible student or all visible ids", () => {
    expect(
      resolveCrmListStudentIds({
        role: "consultant",
        ownStudentId: null,
        requestedStudentId: "s2",
        visibleStudentIds: ["s1", "s2"],
      }),
    ).toEqual({ ok: true, studentIds: ["s2"] });

    expect(
      resolveCrmListStudentIds({
        role: "consultant",
        ownStudentId: null,
        requestedStudentId: "s9",
        visibleStudentIds: ["s1", "s2"],
      }).ok,
    ).toBe(false);

    expect(
      resolveCrmListStudentIds({
        role: "admin",
        ownStudentId: null,
        requestedStudentId: null,
        visibleStudentIds: ["s1", "s2"],
      }),
    ).toEqual({ ok: true, studentIds: ["s1", "s2"] });
  });
});
