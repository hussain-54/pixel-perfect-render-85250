import { describe, expect, it } from "vitest";
import {
  assertSafeHref,
  documentsHaveUnpublishedChanges,
  validateAnnouncementWrite,
  validateDocumentDraft,
  validateHeaderDraft,
} from "./cms-rules";
import { DEFAULT_CMS_HEADER } from "./cms-defaults";

describe("cms-rules", () => {
  it("rejects javascript hrefs", () => {
    expect(assertSafeHref("javascript:alert(1)", "Link")).toMatch(/disallowed/i);
    expect(assertSafeHref("/contact", "Link")).toBeNull();
    expect(assertSafeHref("https://globalroots.pk/about", "Link")).toBeNull();
  });

  it("validates header drafts against safe bounds", () => {
    const ok = validateHeaderDraft({
      ...DEFAULT_CMS_HEADER,
      logoHeightPx: 48,
      cta: { label: "Talk to us", href: "/contact" },
    });
    expect(ok.ok).toBe(true);

    const bad = validateHeaderDraft({
      ...DEFAULT_CMS_HEADER,
      logoHeightPx: 120,
    });
    expect(bad.ok).toBe(false);
  });

  it("detects unpublished draft changes", () => {
    expect(documentsHaveUnpublishedChanges({ a: 1 }, { a: 1 })).toBe(false);
    expect(documentsHaveUnpublishedChanges({ a: 1 }, { a: 2 })).toBe(true);
    expect(documentsHaveUnpublishedChanges({ a: 1 }, null)).toBe(true);
  });

  it("requires announcement body and safe CTA", () => {
    expect(
      validateAnnouncementWrite({
        internalTitle: "Open day",
        body: "",
        announcementType: "event",
        styleToken: "navy",
        dismissible: true,
        status: "draft",
        sortOrder: 0,
      }).ok,
    ).toBe(false);

    const ok = validateAnnouncementWrite({
      internalTitle: "Open day",
      body: "Join our weekend counselling open day.",
      announcementType: "event",
      ctaLabel: "Book",
      ctaHref: "/contact",
      styleToken: "royal",
      dismissible: true,
      status: "published",
      sortOrder: 1,
    });
    expect(ok.ok).toBe(true);
  });

  it("validates homepage document drafts", () => {
    const result = validateDocumentDraft("page.home", {
      seo: { title: "Home", description: "Desc" },
      sections: [{ id: "hero", type: "hero", visible: true, sort: 1, title: "Hello" }],
    });
    expect(result.ok).toBe(true);
  });
});
