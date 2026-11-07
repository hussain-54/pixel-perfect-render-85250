/**
 * Patches src/routeTree.gen.ts to register blog admin + public routes.
 * Prefer `npx @tanstack/router-cli generate` when available.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve("src/routeTree.gen.ts");
let s = fs.readFileSync(file, "utf8");

if (s.includes("AdminBlogRouteImport") && s.includes("BlogSlugRouteImport")) {
  console.log("routeTree already includes blog routes");
  process.exit(0);
}

const imports = [
  [
    "import { Route as AdminBankingRouteImport } from './routes/admin/banking'",
    "import { Route as AdminBlogRouteImport } from './routes/admin/blog'\nimport { Route as AdminBlogEditRouteImport } from './routes/admin/blog.edit'\nimport { Route as AdminBlogEditPostIdRouteImport } from './routes/admin/blog.edit.$postId'\nimport { Route as AdminBankingRouteImport } from './routes/admin/banking'",
  ],
  [
    "import { Route as AboutRouteImport } from './routes/about'",
    "import { Route as AboutRouteImport } from './routes/about'\nimport { Route as BlogRouteImport } from './routes/blog'\nimport { Route as BlogSlugRouteImport } from './routes/blog.$slug'\nimport { Route as SitemapArticlesDotXmlRouteImport } from './routes/sitemap-articles[.]xml'",
  ],
];

for (const [needle, replacement] of imports) {
  if (!s.includes(needle.split("\n")[0]) && needle.includes("AdminBanking")) {
    // fallback insert near website
    if (!s.includes("AdminBlogRouteImport")) {
      s = s.replace(
        "import { Route as AdminWebsiteRouteImport } from './routes/admin/website'",
        "import { Route as AdminWebsiteRouteImport } from './routes/admin/website'\nimport { Route as AdminBlogRouteImport } from './routes/admin/blog'\nimport { Route as AdminBlogEditRouteImport } from './routes/admin/blog.edit'\nimport { Route as AdminBlogEditPostIdRouteImport } from './routes/admin/blog.edit.$postId'",
      );
    }
    continue;
  }
  if (!s.includes(replacement.split("\n").pop()) && s.includes(needle) && !s.includes(replacement.slice(0, 40))) {
    s = s.replace(needle, replacement);
  }
}

if (!s.includes("AdminBlogRouteImport")) {
  s = s.replace(
    "import { Route as AdminWebsiteRouteImport } from './routes/admin/website'",
    "import { Route as AdminWebsiteRouteImport } from './routes/admin/website'\nimport { Route as AdminBlogRouteImport } from './routes/admin/blog'\nimport { Route as AdminBlogEditRouteImport } from './routes/admin/blog.edit'\nimport { Route as AdminBlogEditPostIdRouteImport } from './routes/admin/blog.edit.$postId'",
  );
}
if (!s.includes("BlogRouteImport")) {
  s = s.replace(
    "import { Route as AboutRouteImport } from './routes/about'",
    "import { Route as AboutRouteImport } from './routes/about'\nimport { Route as BlogRouteImport } from './routes/blog'\nimport { Route as BlogSlugRouteImport } from './routes/blog.$slug'\nimport { Route as SitemapArticlesDotXmlRouteImport } from './routes/sitemap-articles[.]xml'",
  );
}

const consts = `
const AdminBlogRoute = AdminBlogRouteImport.update({
  id: '/blog',
  path: '/blog',
  getParentRoute: () => AdminRouteRoute,
} as any)

const AdminBlogEditRoute = AdminBlogEditRouteImport.update({
  id: '/blog/edit',
  path: '/blog/edit',
  getParentRoute: () => AdminRouteRoute,
} as any)

const AdminBlogEditPostIdRoute = AdminBlogEditPostIdRouteImport.update({
  id: '/blog/edit/$postId',
  path: '/blog/edit/$postId',
  getParentRoute: () => AdminRouteRoute,
} as any)

const BlogRoute = BlogRouteImport.update({
  id: '/blog',
  path: '/blog',
  getParentRoute: () => rootRouteImport,
} as any)

const BlogSlugRoute = BlogSlugRouteImport.update({
  id: '/blog/$slug',
  path: '/blog/$slug',
  getParentRoute: () => rootRouteImport,
} as any)

const SitemapArticlesDotXmlRoute = SitemapArticlesDotXmlRouteImport.update({
  id: '/sitemap-articles.xml',
  path: '/sitemap-articles.xml',
  getParentRoute: () => rootRouteImport,
} as any)
`;

if (!s.includes("AdminBlogRoute = AdminBlogRouteImport")) {
  s = s.replace(
    "const AdminWebsiteRoute = AdminWebsiteRouteImport.update({",
    `${consts}\nconst AdminWebsiteRoute = AdminWebsiteRouteImport.update({`,
  );
}

function ensureMap(after, insert) {
  let idx = 0;
  while (true) {
    const pos = s.indexOf(after, idx);
    if (pos < 0) break;
    const key = insert.split(":")[0];
    if (!s.slice(Math.max(0, pos - 120), pos + after.length + 80).includes(key)) {
      s = s.slice(0, pos) + insert + "\n  " + s.slice(pos);
    }
    idx = pos + after.length + insert.length + 5;
  }
}

ensureMap("'/admin/website': typeof AdminWebsiteRoute", "'/admin/blog': typeof AdminBlogRoute");
ensureMap("'/admin/website': typeof AdminWebsiteRoute", "'/admin/blog/edit': typeof AdminBlogEditRoute");
ensureMap(
  "'/admin/website': typeof AdminWebsiteRoute",
  "'/admin/blog/edit/$postId': typeof AdminBlogEditPostIdRoute",
);
ensureMap("'/about': typeof AboutRoute", "'/blog': typeof BlogRoute");
ensureMap("'/about': typeof AboutRoute", "'/blog/$slug': typeof BlogSlugRoute");
ensureMap("'/about': typeof AboutRoute", "'/sitemap-articles.xml': typeof SitemapArticlesDotXmlRoute");

if (!s.includes("| '/admin/blog'")) {
  s = s.replace("| '/admin/website'", "| '/admin/blog'\n    | '/admin/blog/edit'\n    | '/admin/blog/edit/$postId'\n    | '/admin/website'");
}
if (!s.includes("| '/blog/$slug'")) {
  s = s.replace("| '/about'", "| '/about'\n    | '/blog'\n    | '/blog/$slug'\n    | '/sitemap-articles.xml'");
}

if (!s.includes("'/admin/blog': {")) {
  const websiteBlock = s.match(/'\/admin\/website': \{[\s\S]*?\n    \}/);
  if (websiteBlock) {
    const blogBlocks = [
      websiteBlock[0]
        .replaceAll("/admin/website", "/admin/blog")
        .replaceAll("/website", "/blog")
        .replaceAll("AdminWebsiteRouteImport", "AdminBlogRouteImport"),
      websiteBlock[0]
        .replaceAll("/admin/website", "/admin/blog/edit")
        .replaceAll("/website", "/blog/edit")
        .replaceAll("AdminWebsiteRouteImport", "AdminBlogEditRouteImport"),
      websiteBlock[0]
        .replaceAll("/admin/website", "/admin/blog/edit/$postId")
        .replaceAll("/website", "/blog/edit/$postId")
        .replaceAll("AdminWebsiteRouteImport", "AdminBlogEditPostIdRouteImport"),
    ].join("\n    ");
    s = s.replace(websiteBlock[0], `${blogBlocks}\n    ${websiteBlock[0]}`);
  }
}

if (!s.includes("'/blog/$slug': {")) {
  const aboutBlock = s.match(/'\/about': \{[\s\S]*?\n    \}/);
  if (aboutBlock) {
    const extras = [
      aboutBlock[0]
        .replaceAll("/about", "/blog")
        .replaceAll("AboutRouteImport", "BlogRouteImport"),
      aboutBlock[0]
        .replaceAll("/about", "/blog/$slug")
        .replaceAll("AboutRouteImport", "BlogSlugRouteImport"),
      aboutBlock[0]
        .replaceAll("/about", "/sitemap-articles.xml")
        .replaceAll("AboutRouteImport", "SitemapArticlesDotXmlRouteImport"),
    ].join("\n    ");
    s = s.replace(aboutBlock[0], `${extras}\n    ${aboutBlock[0]}`);
  }
}

// children maps
if (!s.includes("AdminBlogRoute: typeof AdminBlogRoute")) {
  s = s.replace(
    "AdminWebsiteRoute: typeof AdminWebsiteRoute",
    "AdminBlogRoute: typeof AdminBlogRoute\n  AdminBlogEditRoute: typeof AdminBlogEditRoute\n  AdminBlogEditPostIdRoute: typeof AdminBlogEditPostIdRoute\n  AdminWebsiteRoute: typeof AdminWebsiteRoute",
  );
}
if (!s.includes("AdminBlogRoute: AdminBlogRoute,")) {
  s = s.replace(
    "AdminWebsiteRoute: AdminWebsiteRoute,",
    "AdminBlogRoute: AdminBlogRoute,\n  AdminBlogEditRoute: AdminBlogEditRoute,\n  AdminBlogEditPostIdRoute: AdminBlogEditPostIdRoute,\n  AdminWebsiteRoute: AdminWebsiteRoute,",
  );
}
if (!s.includes("BlogRoute: typeof BlogRoute")) {
  s = s.replace(
    "AboutRoute: typeof AboutRoute",
    "AboutRoute: typeof AboutRoute\n  BlogRoute: typeof BlogRoute\n  BlogSlugRoute: typeof BlogSlugRoute\n  SitemapArticlesDotXmlRoute: typeof SitemapArticlesDotXmlRoute",
  );
}
if (!s.includes("BlogRoute: BlogRoute,")) {
  s = s.replace(
    "AboutRoute: AboutRoute,",
    "AboutRoute: AboutRoute,\n  BlogRoute: BlogRoute,\n  BlogSlugRoute: BlogSlugRoute,\n  SitemapArticlesDotXmlRoute: SitemapArticlesDotXmlRoute,",
  );
}

fs.writeFileSync(file, s);
console.log("Patched routeTree.gen.ts with blog routes");
