import { describe, expect, it } from "vitest";
import {
  buildEditorialChecklist,
  estimateReadingTimeMinutes,
  sanitizeBlogHtml,
  slugifyBlogTitle,
  validateBlogPostWrite,
} from "./blog-rules";

describe("blog-rules", () => {
  it("slugifies titles safely", () => {
    expect(slugifyBlogTitle("Study Abroad in the UK!")).toBe("study-abroad-in-the-uk");
    expect(slugifyBlogTitle("  ")).toBe("article");
  });

  it("estimates reading time from html", () => {
    const words = Array.from({ length: 400 }, () => "word").join(" ");
    expect(estimateReadingTimeMinutes(`<p>${words}</p>`)).toBe(2);
  });

  it("sanitizes dangerous html", () => {
    const clean = sanitizeBlogHtml('<p>Hi</p><script>alert(1)</script><img src="x" onerror="x">');
    expect(clean).toContain("<p>Hi</p>");
    expect(clean.toLowerCase()).not.toContain("<script");
  });

  it("allows draft saves without title content requirements for publish", () => {
    const draft = validateBlogPostWrite({
      title: "",
      slug: "untitled",
      excerpt: "",
      contentJson: {},
      contentHtml: "<p></p>",
      status: "draft",
    });
    expect(draft.ok).toBe(true);

    const published = validateBlogPostWrite({
      title: "Hello",
      slug: "hello",
      excerpt: "",
      contentJson: {},
      contentHtml: "<p></p>",
      status: "published",
    });
    expect(published.ok).toBe(false);
  });

  it("builds editorial checklist progress", () => {
    const empty = buildEditorialChecklist({
      title: "",
      excerpt: "",
      contentHtml: "",
    });
    // Alt text is satisfied when no images are present.
    expect(empty.completed).toBe(1);
    expect(empty.items.find((i) => i.id === "alt")?.done).toBe(true);

    const filled = buildEditorialChecklist({
      title: "Visa tips",
      excerpt: "A short intro for students.",
      contentHtml: "<h2>Start here</h2><p>" + "word ".repeat(40) + "</p>",
      featuredImageUrl: "https://example.com/a.jpg",
      featuredImageAlt: "Campus",
      categoryId: "c1",
      authorId: "a1",
      seoTitle: "Visa tips",
      seoDescription: "Guide",
      slug: "visa-tips",
    });
    expect(filled.completed).toBe(filled.total);
  });
});
