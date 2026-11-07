import { createFileRoute } from "@tanstack/react-router";
import { listPublishedBlogSitemapPaths } from "@/services";
import { buildSitemapXml } from "@/lib/seo";

/** Dynamic sitemap of published, indexable blog articles. */
export const Route = createFileRoute("/sitemap-articles.xml")({
  server: {
    handlers: {
      GET: async () => {
        const paths = await listPublishedBlogSitemapPaths();
        const body = buildSitemapXml([], paths);
        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
