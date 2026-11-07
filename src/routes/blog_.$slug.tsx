import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Linkedin, Link2, Twitter } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { CtaBand } from "@/components/site/blocks";
import { fmtDate } from "@/components/common";
import { getPublishedBlogPost, listPublishedBlogPosts } from "@/services";
import { SITE_NAME, SITE_OG_IMAGE, absoluteUrl, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/blog_/$slug")({
  loader: async ({ params }) => {
    const article = await getPublishedBlogPost(params.slug);
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const article = loaderData?.article;
    if (!article) {
      return pageHead({
        path: "/blog",
        title: "Article — Global Roots Consultants",
        description: "Blog article from Global Roots Consultants.",
        indexable: false,
      });
    }
    const path = article.canonicalPath || `/blog/${article.slug}`;
    const title = article.seoTitle || article.ogTitle || `${article.title} — ${SITE_NAME}`;
    const description =
      article.seoDescription ||
      article.ogDescription ||
      article.excerpt ||
      "Read this article from Global Roots Consultants.";
    const image = article.ogImageUrl || article.featuredImageUrl || SITE_OG_IMAGE;
    const head = pageHead({
      path,
      title,
      description,
      indexable: article.robotsIndex,
      image,
      type: "article",
    });
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description,
      image: image.startsWith("http") ? image : absoluteUrl(image),
      datePublished: article.publishedAt,
      author: article.authorName
        ? { "@type": "Person", name: article.authorName }
        : { "@type": "Organization", name: SITE_NAME },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        logo: { "@type": "ImageObject", url: SITE_OG_IMAGE },
      },
      mainEntityOfPage: absoluteUrl(path),
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
        {
          "@type": "ListItem",
          position: 3,
          name: article.title,
          item: absoluteUrl(path),
        },
      ],
    };
    return {
      ...head,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbLd),
        },
      ],
    };
  },
  component: BlogArticlePage,
});

function BlogArticlePage() {
  const { article } = Route.useLoaderData();
  const shareUrl = absoluteUrl(article.canonicalPath || `/blog/${article.slug}`);
  const shareText = encodeURIComponent(article.title);

  const relatedQ = useQuery({
    queryKey: ["public", "blog-related", article.categorySlug, article.id],
    queryFn: () =>
      listPublishedBlogPosts({
        page: 1,
        pageSize: 4,
        category: article.categorySlug || undefined,
      }),
  });

  const related = (relatedQ.data?.rows ?? []).filter((r) => r.id !== article.id).slice(0, 3);

  return (
    <SiteLayout>
      <article className="container-page section-y">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/" className="hover:text-royal">
            Home
          </Link>
          <span className="mx-1.5">/</span>
          <Link to="/blog" className="hover:text-royal">
            Blog
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-navy line-clamp-1">{article.title}</span>
        </nav>

        <header className="mx-auto mt-8 max-w-3xl">
          {article.categoryName ? (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
              {article.categoryName}
            </p>
          ) : null}
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-navy md:text-5xl">
            {article.title}
          </h1>
          {article.excerpt ? (
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{article.excerpt}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {article.authorName ? <span>{article.authorName}</span> : null}
            <span aria-hidden>·</span>
            <time dateTime={article.publishedAt}>{fmtDate(article.publishedAt)}</time>
            <span aria-hidden>·</span>
            <span>{article.readingTimeMinutes} min read</span>
          </div>
        </header>

        {article.featuredImageUrl ? (
          <figure className="mx-auto mt-10 max-w-4xl">
            <img
              src={article.featuredImageUrl}
              alt={article.featuredImageAlt || article.title}
              className="max-h-[520px] w-full object-cover"
            />
            {article.featuredImageAlt ? (
              <figcaption className="mt-2 text-center text-xs text-muted-foreground">
                {article.featuredImageAlt}
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        <div
          className="prose prose-navy mx-auto mt-10 max-w-3xl prose-headings:font-display prose-img:mx-auto prose-img:max-w-full prose-img:h-auto prose-table:block prose-table:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        {article.tagNames.length ? (
          <div className="mx-auto mt-10 max-w-3xl flex flex-wrap gap-2">
            {(article.tagNames as string[]).map((tag: string) => (
              <span
                key={tag}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {(article.authorName || article.authorBio) && (
          <aside className="mx-auto mt-12 max-w-3xl border-t border-border pt-8">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-royal">
              Author
            </p>
            <div className="mt-3 flex gap-4">
              {article.authorAvatarUrl ? (
                <img
                  src={article.authorAvatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : null}
              <div>
                <p className="font-semibold text-navy">{article.authorName}</p>
                {article.authorBio ? (
                  <p className="mt-1 text-sm text-muted-foreground">{article.authorBio}</p>
                ) : null}
              </div>
            </div>
          </aside>
        )}

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center gap-3 border-t border-border pt-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Share
          </span>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-navy hover:bg-accent"
            aria-label="Share on Facebook"
          >
            <Facebook className="h-4 w-4" />
          </a>
          <a
            href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-navy hover:bg-accent"
            aria-label="Share on X"
          >
            <Twitter className="h-4 w-4" />
          </a>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-navy hover:bg-accent"
            aria-label="Share on LinkedIn"
          >
            <Linkedin className="h-4 w-4" />
          </a>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-navy hover:bg-accent"
            aria-label="Copy link"
            onClick={() => void navigator.clipboard.writeText(shareUrl)}
          >
            <Link2 className="h-4 w-4" />
          </button>
          <Link to="/blog" className="ml-auto text-sm font-semibold text-royal hover:underline">
            ← Back to blog
          </Link>
        </div>

        {related.length > 0 ? (
          <section className="mx-auto mt-16 max-w-4xl border-t border-border pt-10">
            <h2 className="font-display text-2xl font-semibold text-navy">Related articles</h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-3">
              {related.map((post) => (
                <li key={post.id}>
                  <Link to="/blog/$slug" params={{ slug: post.slug }} className="group block">
                    {post.featuredImageUrl ? (
                      <img
                        src={post.featuredImageUrl}
                        alt={post.featuredImageAlt || post.title}
                        className="aspect-[16/10] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[16/10] w-full bg-muted" />
                    )}
                    <h3 className="mt-3 text-sm font-semibold text-navy group-hover:text-royal">
                      {post.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmtDate(post.publishedAt)} · {post.readingTimeMinutes} min
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {relatedQ.isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading related articles…</p>
        ) : null}
      </article>
      <CtaBand />
    </SiteLayout>
  );
}
