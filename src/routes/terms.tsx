import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { siteContact } from "@/data/contact";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  head: () =>
    pageHead({
      path: "/terms",
      title: "Terms of Use — Global Roots Consultants",
      description:
        "Terms governing use of the Global Roots Consultants website and public information.",
    }),
  component: Page,
});

function Page() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Legal"
        title="Terms of Use"
        body="These terms govern use of the Global Roots Consultants public website. They are a practical baseline and should be reviewed by the business owner or counsel before launch."
      />
      <section className="container-page section-y max-w-3xl space-y-8 text-sm leading-relaxed text-muted-foreground">
        <p className="border border-border bg-surface px-4 py-3 text-navy">
          <strong className="font-semibold">Owner review required:</strong> confirm governing law,
          company legal entity name, fee/refund language, and any regulated-service disclaimers
          before treating this page as final. This site does not invent certifications or guarantees.
        </p>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Acceptance</h2>
          <p>
            By using this website you agree to these terms and our{" "}
            <Link to="/privacy" className="font-medium text-royal hover:underline">
              Privacy Policy
            </Link>
            . If you do not agree, please do not use the site.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Services described</h2>
          <p>
            Content on this website describes education and visa consultancy services offered by
            Global Roots Consultants. University, scholarship, and programme listings may include
            sample or illustrative entries and are not a guarantee of admission, funding, or visa
            approval. Final advice is provided through a consultation with our team.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">No professional guarantee</h2>
          <p>
            We do not guarantee university offers, scholarship awards, or visa outcomes. Decisions
            rest with institutions and government authorities. Information on this site is general
            and may change without notice.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Accounts and portals</h2>
          <p>
            If you create an account or access a student, staff, or admin portal, you must keep
            login credentials confidential and use the portal only for authorised purposes.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Acceptable use</h2>
          <p>
            You may not misuse this website, attempt unauthorised access, submit false information,
            or use content for unlawful purposes. We may suspend access that harms the service or
            other users.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Contact</h2>
          <p>
            Questions about these terms:{" "}
            <a className="font-medium text-royal hover:underline" href={siteContact.email.href}>
              {siteContact.email.display}
            </a>
            . Office: {siteContact.location.fullDisplay}.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-semibold text-navy">Governing law</h2>
          <p>
            [Owner: specify governing law and dispute forum — e.g. laws of Pakistan / courts of
            Faisalabad — after legal review.]
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}