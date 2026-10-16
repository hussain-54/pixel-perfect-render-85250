import { describe, expect, it } from "vitest";
import { crmListOrEmpty } from "./portal-data-plane";
import {
  ADMIN_ROSTER_PAGE_SIZE,
  adminRosterUsesStudentsDirectory,
  adminStudentsRosterFilters,
  adminStudentsRosterQueryKey,
  resolveAdminRosterViewState,
} from "./admin-students-roster";
import type { StudentDirectoryResult } from "@/types/portal-officer";
import type { StageKey } from "@/types";

const sampleResult = (rows: number, total?: number): StudentDirectoryResult => ({
  rows: Array.from({ length: rows }, (_, i) => ({
    id: `s${i}`,
    caseId: `C-${i}`,
    name: `Student ${i}`,
    destination: "UK",
    intake: "Fall",
    consultantId: "c1",
    consultantName: "Ada",
    appsSubmitted: 0,
    appsTotal: 1,
    stage: "profile_submitted" as StageKey,
    stageLabel: "Profile Submitted",
    archived: false,
    lastActivity: "2026-01-01",
  })),
  total: total ?? rows,
  page: 1,
  pageSize: ADMIN_ROSTER_PAGE_SIZE,
  filterOptions: {
    countries: [],
    intakes: [],
    stages: [],
    consultants: [],
    canFilterByConsultant: true,
    canRegister: true,
    canExport: true,
  },
});

describe("admin students roster data path", () => {
  it("selects the students directory path (not crmListOrEmpty / getStudents)", () => {
    expect(adminRosterUsesStudentsDirectory()).toBe(true);
    // Document why getStudents is unsafe on live: empty array, not an error.
    expect(crmListOrEmpty("supabase", [{ id: "would-be-hidden" }])).toEqual([]);
  });

  it("requests the directory page size cap for the admin roster", () => {
    expect(adminStudentsRosterFilters(1)).toEqual({
      page: 1,
      pageSize: ADMIN_ROSTER_PAGE_SIZE,
      archived: false,
    });
    expect(ADMIN_ROSTER_PAGE_SIZE).toBe(50);
    expect(adminStudentsRosterQueryKey(adminStudentsRosterFilters(2))).toEqual([
      "admin",
      "students-directory",
      adminStudentsRosterFilters(2),
    ]);
  });

  it("keeps loading, permission, error, empty, and rows distinct", () => {
    expect(
      resolveAdminRosterViewState({
        isLoading: true,
        isError: false,
        errorMessage: "",
        data: undefined,
      }).kind,
    ).toBe("loading");

    expect(
      resolveAdminRosterViewState({
        isLoading: false,
        isError: true,
        errorMessage: "403:You do not have permission to view this data.",
        data: undefined,
      }),
    ).toEqual({
      kind: "permission",
      message: "403:You do not have permission to view this data.",
    });

    expect(
      resolveAdminRosterViewState({
        isLoading: false,
        isError: true,
        errorMessage: "500:relation students missing",
        data: undefined,
      }).kind,
    ).toBe("error");

    expect(
      resolveAdminRosterViewState({
        isLoading: false,
        isError: false,
        errorMessage: "",
        data: sampleResult(0, 0),
      }),
    ).toEqual({ kind: "empty", total: 0 });

    const withRows = sampleResult(2, 2);
    expect(
      resolveAdminRosterViewState({
        isLoading: false,
        isError: false,
        errorMessage: "",
        data: withRows,
      }),
    ).toEqual({ kind: "rows", result: withRows });
  });

  it("never maps a failed query to empty rows", () => {
    const state = resolveAdminRosterViewState({
      isLoading: false,
      isError: true,
      errorMessage: "network failed",
      data: sampleResult(0, 0),
    });
    expect(state.kind).toBe("error");
    expect(state.kind === "empty").toBe(false);
  });
});
