import { describe, expect, it } from "vitest";
import { mayServePublicCatalogDemo, resolvePublicCatalogSource } from "./public-catalog-rules";

describe("public catalog rules", () => {
  it("never allows demo fixtures in production", () => {
    expect(mayServePublicCatalogDemo({ PROD: true, DEV: false })).toBe(false);
  });

  it("allows labelled demo only in non-production DEV", () => {
    expect(mayServePublicCatalogDemo({ PROD: false, DEV: true })).toBe(true);
  });

  it("prefers live over demo/unavailable", () => {
    expect(resolvePublicCatalogSource({ liveOk: true, allowDemo: true })).toBe("live");
    expect(resolvePublicCatalogSource({ liveOk: false, allowDemo: true })).toBe("demo");
    expect(resolvePublicCatalogSource({ liveOk: false, allowDemo: false })).toBe("unavailable");
  });
});
