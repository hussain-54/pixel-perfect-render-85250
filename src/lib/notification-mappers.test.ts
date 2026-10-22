import { describe, expect, it } from "vitest";
import {
  audienceForAppRole,
  formatNotificationTime,
  mapNotificationRow,
} from "./notification-mappers";

describe("notification mappers (Phase 4)", () => {
  it("maps app roles to inbox audiences", () => {
    expect(audienceForAppRole("student")).toBe("student");
    expect(audienceForAppRole("consultant")).toBe("staff");
    expect(audienceForAppRole("admin")).toBe("admin");
    expect(audienceForAppRole("super_admin")).toBe("admin");
  });

  it("maps DB rows without inventing body text", () => {
    const now = Date.parse("2026-10-14T12:00:00.000Z");
    const n = mapNotificationRow(
      {
        id: "n1",
        title: "Document approved",
        body: null,
        read_at: null,
        created_at: "2026-10-14T10:00:00.000Z",
      },
      "student",
      now,
    );
    expect(n).toEqual({
      id: "n1",
      audience: "student",
      title: "Document approved",
      body: "",
      time: "2 hours ago",
      read: false,
      createdAt: "2026-10-14T10:00:00.000Z",
      linkPath: null,
      studentId: null,
    });
  });

  it("marks read when read_at is set", () => {
    const n = mapNotificationRow(
      {
        id: "n2",
        title: "Fee verified",
        body: "Signup fee verified.",
        read_at: "2026-10-14T11:00:00.000Z",
        created_at: "2026-10-10T12:00:00.000Z",
      },
      "admin",
      Date.parse("2026-10-14T12:00:00.000Z"),
    );
    expect(n.read).toBe(true);
    expect(n.body).toBe("Signup fee verified.");
    expect(n.time).toBe("4 days ago");
  });

  it("formats invalid timestamps as raw strings", () => {
    expect(formatNotificationTime("not-a-date")).toBe("not-a-date");
  });

  it("preserves mapper contract fields for service consumers", () => {
    const n = mapNotificationRow(
      {
        id: "uuid-1",
        title: "Title",
        body: "  Body  ",
        read_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        link_path: "/student/documents",
      },
      "student",
      Date.parse("2026-01-20T00:00:00.000Z"),
    );
    expect(n).toMatchObject({
      id: "uuid-1",
      audience: "student",
      title: "Title",
      body: "Body",
      read: false,
    });
    expect(typeof n.time).toBe("string");
    expect(n.time.length).toBeGreaterThan(0);
  });
});
