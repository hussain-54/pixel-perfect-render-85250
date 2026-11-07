import { createFileRoute } from "@tanstack/react-router";
import { BlogPostEditorPage } from "@/components/blog/BlogPostEditorPage";

export const Route = createFileRoute("/admin/blog_/edit")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : "",
  }),
  component: AdminBlogEditorRoute,
});

function AdminBlogEditorRoute() {
  const { id } = Route.useSearch();
  return <BlogPostEditorPage postId={id || undefined} />;
}
