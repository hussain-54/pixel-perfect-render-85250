import { describe, expect, it } from "vitest";
import {
  mapPermissionMatrixChannelStatus,
  permissionMatrixChangeAffectsBusinessRole,
  shouldInvalidateEffectiveAccessForMatrixEvent,
  STAFF_EFFECTIVE_ACCESS_QUERY_KEY,
} from "./permission-matrix-realtime-rules";

describe("permission matrix Realtime invalidation rules", () => {
  it("scopes events to the viewer business role", () => {
    expect(
      permissionMatrixChangeAffectsBusinessRole(
        { business_role: "front_desk_student_affairs", module: "banking_finance" },
        "front_desk_student_affairs",
      ),
    ).toBe(true);
    expect(
      permissionMatrixChangeAffectsBusinessRole(
        { business_role: "counsellor_consultant", module: "banking_finance" },
        "front_desk_student_affairs",
      ),
    ).toBe(false);
    expect(
      permissionMatrixChangeAffectsBusinessRole(
        { business_role: "front_desk_student_affairs" },
        null,
      ),
    ).toBe(false);
  });

  it("invalidates on grant/update/revoke for matching role only", () => {
    expect(
      shouldInvalidateEffectiveAccessForMatrixEvent({
        businessRole: "front_desk_student_affairs",
        newRow: {
          business_role: "front_desk_student_affairs",
          module: "digital_marketing",
          permission_level: 1,
        },
      }),
    ).toBe(true);

    expect(
      shouldInvalidateEffectiveAccessForMatrixEvent({
        businessRole: "front_desk_student_affairs",
        oldRow: {
          business_role: "front_desk_student_affairs",
          module: "banking_finance",
          permission_level: 1,
        },
        newRow: {
          business_role: "front_desk_student_affairs",
          module: "banking_finance",
          permission_level: 0,
        },
      }),
    ).toBe(true);

    expect(
      shouldInvalidateEffectiveAccessForMatrixEvent({
        businessRole: "front_desk_student_affairs",
        newRow: {
          business_role: "accounts_banking_finance",
          module: "banking_finance",
          permission_level: 3,
        },
      }),
    ).toBe(false);
  });

  it("fails closed without a business role (no broad invalidation)", () => {
    expect(
      shouldInvalidateEffectiveAccessForMatrixEvent({
        businessRole: null,
        newRow: { business_role: "front_desk_student_affairs", module: "banking_finance" },
      }),
    ).toBe(false);
  });

  it("maps channel statuses for live / reconnect / offline fallback", () => {
    expect(mapPermissionMatrixChannelStatus("SUBSCRIBED")).toBe("live");
    expect(mapPermissionMatrixChannelStatus("CHANNEL_ERROR")).toBe("reconnecting");
    expect(mapPermissionMatrixChannelStatus("TIMED_OUT")).toBe("reconnecting");
    expect(mapPermissionMatrixChannelStatus("CLOSED")).toBe("offline");
    expect(mapPermissionMatrixChannelStatus("JOINING")).toBe("connecting");
  });

  it("keeps the staff effective-access query key stable for Admin invalidation", () => {
    expect(STAFF_EFFECTIVE_ACCESS_QUERY_KEY).toEqual(["staff", "effective-access"]);
  });
});
