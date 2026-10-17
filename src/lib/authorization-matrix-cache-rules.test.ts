import { describe, expect, it } from "vitest";
import {
  AUTHORIZATION_MATRIX_CACHE_TTL_MS,
  readAuthorizationMatrixCache,
  writeAuthorizationMatrixCache,
} from "./authorization-matrix-cache-rules";

describe("authorization matrix org cache", () => {
  it("returns cached matrix within TTL and expires after", () => {
    const entry = writeAuthorizationMatrixCache({ source: "database" as const }, 5000);
    expect(readAuthorizationMatrixCache(entry, 5000 + AUTHORIZATION_MATRIX_CACHE_TTL_MS - 1)).toEqual(
      { source: "database" },
    );
    expect(
      readAuthorizationMatrixCache(entry, 5000 + AUTHORIZATION_MATRIX_CACHE_TTL_MS + 1),
    ).toBeNull();
  });
});
