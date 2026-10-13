import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PUBLIC_INDEXABLE_PATHS,
  SITE_OG_IMAGE,
  SITE_ORIGIN,
  absoluteUrl,
  buildSitemapXml,
  pageHead,
} from "./seo";

describe("seo helpers", () => {
  it("uses the confirmed production origin", () => {
    expect(SITE_ORIGIN).toBe("https://globalroots.pk");
    expect(absoluteUrl("/")).toBe("https://globalroots.pk/");
    expect(absoluteUrl("/contact")).toBe("https://globalroots.pk/contact");
  });

  it("gives each indexable page its own canonical (not the homepage)", () => {
    const home = pageHead({
      path: "/",
      title: "Home",
      description: "Home desc",
    });
    const contact = pageHead({
      path: "/contact",
      title: "Contact",
      description: "Contact desc",
    });
    expect(home.links[0]?.href).toBe("https://globalroots.pk/");
    expect(contact.links[0]?.href).toBe("https://globalroots.pk/contact");
    expect(contact.links[0]?.href).not.toBe(home.links[0]?.href);
  });

  it("includes Open Graph and Twitter image metadata", () => {
    const head = pageHead({
      path: "/about",
      title: "About",
      description: "About desc",
    });
    const props = Object.fromEntries(
      head.meta
        .filter((m): m is { property: string; content: string } => "property" in m)
        .map((m) => [m.property, m.content]),
    );
    const names = Object.fromEntries(
      head.meta
        .filter((m): m is { name: string; content: string } => "name" in m)
        .map((m) => [m.name, m.content]),
    );
    expect(props["og:image"]).toBe(SITE_OG_IMAGE);
    expect(names["twitter:image"]).toBe(SITE_OG_IMAGE);
    expect(names["twitter:card"]).toBe("summary_large_image");
  });

  it("omits canonical and sets noindex for non-indexable pages", () => {
    const head = pageHead({
      path: "/sign-in",
      title: "Sign In",
      description: "Auth",
      indexable: false,
    });
    expect(head.links).toEqual([]);
    expect(
      head.meta.some((m) => "name" in m && m.name === "robots" && m.content === "noindex,nofollow"),
    ).toBe(true);
  });

  it("excludes portal and auth paths from the public indexable list", () => {
    for (const blocked of [
      "/staff",
      "/admin",
      "/student",
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/reset-password",
      "/change-password",
    ]) {
      expect(PUBLIC_INDEXABLE_PATHS).not.toContain(blocked);
    }
  });

  it("keeps public/sitemap.xml aligned with PUBLIC_INDEXABLE_PATHS", () => {
    const disk = readFileSync(resolve(process.cwd(), "public/sitemap.xml"), "utf8");
    const generated = buildSitemapXml();
    expect(disk).toBe(generated);
    for (const path of PUBLIC_INDEXABLE_PATHS) {
      expect(disk).toContain(`<loc>${absoluteUrl(path)}</loc>`);
    }
  });
});
