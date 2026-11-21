---
name: globalroots-cms-editorial-management
description: >-
  Manage GlobalRoots Website CMS and Blog platform — draft/publish, SEO, media,
  TipTap sanitization, and admin editorial workflows. Use for CMS/blog features
  or public content rendering.
---

# GlobalRoots CMS & Editorial Management

## Purpose / triggers

Apply when changing Admin Website CMS, Blog editor/publish, public blog pages, announcements, revisions, or SEO/sitemap for content.

## Repo inspection steps

1. CMS: `admin/website.tsx`, `portal-cms.ts`, migration `20261108120000_website_cms_foundation.sql`, `cms-rules` / `cms-types`.
2. Blog: `admin/blog*.tsx`, `blog.tsx`, `blog_.$slug.tsx`, `portal-blog.ts`, TipTap editor, `20261108140000_blog_platform_foundation.sql`.
3. Public render: sanitize HTML (`isomorphic-dompurify`); published-only queries for anonymous readers.
4. Media upload: authz + storage path constraints in `portalUploadBlogMedia`.
5. SEO: `src/lib/seo.ts`, sitemap/robots under `public/` if present.

## Execution steps

1. Draft vs publish must be server-enforced; public endpoints list published only.
2. Keep TipTap SSR-safe (`immediatelyRender: false` where required).
3. Revisions/restore go through authorized server fns.
4. Do not ship unpublished content via client filters alone.

## Quality / security constraints

- XSS: sanitize on display; limit upload MIME/size.
- Permission: digital_marketing / admin matrix levels for mutate.

## Testing requirements

- `cms-rules.test.ts`, `blog-rules.test.ts`, SEO tests.
- Manual publish → public slug visibility checklist.

## Deliverables

- Editorial workflow status; SEO/media risks; migration apply note.

## Never-do

- No service-role in client
- No RLS weakening to expose drafts publicly
- No mock “published” without DB publish
- No prod reset
- No push without approval
