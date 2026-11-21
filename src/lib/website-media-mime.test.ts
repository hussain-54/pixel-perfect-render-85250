import { describe, expect, it } from "vitest";
import {
  isAllowedWebsiteMediaMime,
  websiteMediaMimeRejectMessage,
  WEBSITE_MEDIA_ALLOWED_MIME,
} from "./website-media-mime";

describe("website-media MIME allowlist", () => {
  it("allows raster image types only", () => {
    for (const mime of WEBSITE_MEDIA_ALLOWED_MIME) {
      expect(isAllowedWebsiteMediaMime(mime)).toBe(true);
    }
  });

  it("rejects SVG and non-image types", () => {
    expect(isAllowedWebsiteMediaMime("image/svg+xml")).toBe(false);
    expect(isAllowedWebsiteMediaMime("image/svg")).toBe(false);
    expect(isAllowedWebsiteMediaMime("text/html")).toBe(false);
    expect(isAllowedWebsiteMediaMime("application/pdf")).toBe(false);
    expect(isAllowedWebsiteMediaMime("")).toBe(false);
  });

  it("surfaces an SVG-specific reject message", () => {
    expect(websiteMediaMimeRejectMessage("image/svg+xml")).toMatch(/SVG/i);
    expect(websiteMediaMimeRejectMessage("image/png")).toMatch(/JPEG/);
  });
});
