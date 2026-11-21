/**
 * Static SQL contract tests — reads migration files only. Never applies SQL.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const mig = (name: string) =>
  readFileSync(join(process.cwd(), "supabase", "migrations", name), "utf8");

describe("CMS foundation migration static contracts (not applied here)", () => {
  const sql = mig("20261108120000_website_cms_foundation.sql");

  it("exposes public published readers only via named RPCs", () => {
    expect(sql).toMatch(/get_cms_public_documents/);
    expect(sql).toMatch(/get_cms_public_announcements/);
  });

  it("gates mutate helpers on is_admin via can_mutate_cms", () => {
    expect(sql).toMatch(/can_mutate_cms/);
    expect(sql).toMatch(/is_admin\s*\(/);
  });

  it("historical: website-media SVG allowlist (superseded by harden migration when applied)", () => {
    expect(sql).toMatch(/image\/svg\+xml/);
  });
});

describe("Blog foundation migration static contracts (not applied here)", () => {
  const sql = mig("20261108140000_blog_platform_foundation.sql");

  it("defines promote_scheduled_blog_posts", () => {
    expect(sql).toMatch(/promote_scheduled_blog_posts/);
  });

  it("historical KNOWN RISK: grant execute on promote_scheduled to authenticated (superseded by harden)", () => {
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.promote_scheduled_blog_posts\s*\(\s*\)\s+to\s+authenticated/i,
    );
  });

  it("publishes only via published status / published readers", () => {
    expect(sql).toMatch(/get_published_blog_posts/);
    expect(sql).toMatch(/status\s*=\s*'published'/);
  });
});

describe("Finance desk foundation migration static contracts (not applied here)", () => {
  const sql = mig("20261108160000_finance_desk_foundation.sql");

  it("enables RLS and role helpers for desk tables", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/can_view_finance_desk/);
    expect(sql).toMatch(/can_mutate_finance_desk/);
    expect(sql).toMatch(/finance_desk_entries/);
  });
});

describe("Blog promote + media harden migration contracts (NOT EXECUTED here)", () => {
  const sql = mig("20261122120000_blog_promote_and_media_harden.sql");

  it("gates promote updates with can_mutate_cms or service_role", () => {
    expect(sql).toMatch(/can_mutate_cms\s*\(/);
    expect(sql).toMatch(/service_role/);
    expect(sql).toMatch(/return 0/);
  });

  it("revokes promote EXECUTE from authenticated", () => {
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.promote_scheduled_blog_posts\s*\(\s*\)\s+from\s+authenticated/i,
    );
  });

  it("grants promote EXECUTE only to service_role", () => {
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.promote_scheduled_blog_posts\s*\(\s*\)\s+to\s+service_role/i,
    );
  });

  it("drops SVG from website-media allowed_mime_types", () => {
    expect(sql).toMatch(/website-media/);
    expect(sql).toMatch(/allowed_mime_types/);
    expect(sql).not.toMatch(/image\/svg\+xml/);
    expect(sql).toMatch(/image\/jpeg/);
    expect(sql).toMatch(/image\/png/);
    expect(sql).toMatch(/image\/webp/);
    expect(sql).toMatch(/image\/gif/);
  });
});
