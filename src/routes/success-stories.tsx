import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { CtaBand, SuccessStoryCard } from "@/components/site/blocks";
import { stories } from "@/data/site";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/success-stories")({
  head: () =>
    pageHead({
      path: "/success-stories",
      title: "Success Stories — Global Roots Consultants",
      description:
        "Authentic student journeys guided by Global Roots Consultants — admissions and study-abroad pathways shared for public display.",
    }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Success stories"
        title="Students guided toward global education"
        body="These stories use approved public testimonials already published on this website. We do not invent visa outcomes or present stock photos as real students."
      />
      {stories.length > 0 ? (
        <section className="container-page section-y grid gap-5 sm:grid-cols-2 lg:grid-cols-2 lg:gap-6">
          {stories.map((s) => (
            <SuccessStoryCard key={s.name} story={s} />
          ))}
        </section>
      ) : (
        <section className="container-page section-y">
          <p className="text-sm text-muted-foreground">
            Success stories will appear here once approved public content is available.
          </p>
        </section>
      )}
      <CtaBand />
    </SiteLayout>
  );
}
