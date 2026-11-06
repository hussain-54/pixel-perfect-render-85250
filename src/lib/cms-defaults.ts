/**
 * Safe hardcoded defaults matching the live GlobalRoots public site.
 * Used as fallback when CMS is unavailable or a document is unpublished.
 */
import { siteContact, socialLinks } from "@/data/contact";
import { mainNavigation } from "@/data/navigation";
import { stats, trustSignals, whyUs } from "@/data/site";
import type {
  CmsFooterSettings,
  CmsHeaderSettings,
  CmsNavSettings,
  CmsPageContent,
  CmsSeoSettings,
  CmsThemeSettings,
} from "@/lib/cms-types";

export const DEFAULT_CMS_HEADER: CmsHeaderSettings = {
  sticky: true,
  showUtilityBar: true,
  logoUrl: null,
  logoHeightPx: 40,
  backgroundToken: "white",
  cta: { label: "Free Consultation", href: "/contact" },
  secondaryCta: null,
  hoverTextToken: "navy",
  hoverBgToken: "accent",
  transitionMs: 200,
};

export const DEFAULT_CMS_NAV: CmsNavSettings = {
  items: mainNavigation.map((item) => {
    if (item.type === "link") {
      return {
        id: item.id,
        label: item.label,
        type: "link" as const,
        href: item.to,
        visible: true,
        openInNewTab: false,
      };
    }
    return {
      id: item.id,
      label: item.label,
      type: "mega" as const,
      megaId: item.id,
      visible: true,
      openInNewTab: false,
    };
  }),
};

export const DEFAULT_CMS_FOOTER: CmsFooterSettings = {
  brandName: siteContact.brandName,
  description:
    "Global Education & Visa Consultants. Guiding students from first conversation to first day on campus.",
  registration: siteContact.registration,
  copyright: `© ${new Date().getFullYear()} ${siteContact.brandName}. All rights reserved.`,
  phoneDisplay: siteContact.phone.display,
  emailDisplay: siteContact.email.display,
  addressDisplay: siteContact.location.fullDisplay,
  whatsappHref: siteContact.whatsapp.placeholder ? "" : siteContact.whatsapp.href,
  socialLinks: socialLinks.map((s) => ({ id: s.id, label: s.label, href: s.href })),
  columns: [
    {
      id: "study",
      heading: "Study Abroad",
      visible: true,
      links: [
        { label: "Destinations", href: "/destinations" },
        { label: "Scholarships", href: "/scholarships" },
      ],
    },
    {
      id: "services",
      heading: "Services",
      visible: true,
      links: [
        { label: "All Services", href: "/services" },
        { label: "Student Visa", href: "/student-visa" },
        { label: "Consultation", href: "/contact" },
      ],
    },
    {
      id: "company",
      heading: "Company",
      visible: true,
      links: [
        { label: "About Us", href: "/about" },
        { label: "Success Stories", href: "/success-stories" },
        { label: "Resources", href: "/resources" },
      ],
    },
  ],
  backgroundToken: "navy",
  textToken: "navy-foreground",
};

export const DEFAULT_CMS_THEME: CmsThemeSettings = {
  accentToken: "royal",
  buttonVariant: "default",
  radiusToken: "md",
  sectionSpacingToken: "default",
};

export const DEFAULT_CMS_SEO_GLOBAL: CmsSeoSettings = {
  title: "Global Roots Consultants | Global Education & Visa Consultants",
  description:
    "Discover world-class universities, scholarships and expert guidance from application to visa with Global Roots Consultants.",
  ogImagePath: "/brand/global-roots-logo.png",
};

export const DEFAULT_CMS_HOME: CmsPageContent = {
  seo: {
    title: DEFAULT_CMS_SEO_GLOBAL.title,
    description: DEFAULT_CMS_SEO_GLOBAL.description,
    ogImagePath: DEFAULT_CMS_SEO_GLOBAL.ogImagePath,
    canonicalPath: "/",
  },
  sections: [
    {
      id: "hero",
      type: "hero",
      visible: true,
      sort: 10,
      eyebrow: "Global Education & Visa Consultants",
      title: "Your Global Education Journey Starts Here.",
      body: "Discover universities abroad and get clear guidance from application through visa — starting with a free consultation.",
      imageUrl: null,
      backgroundToken: "navy",
      primaryCta: { label: "Book Free Consultation", href: "/contact" },
      secondaryCta: { label: "Explore Study Destinations", href: "/destinations" },
      items: stats.map((s) => ({ value: s.value, label: s.label })),
    },
    {
      id: "trust",
      type: "trust",
      visible: true,
      sort: 20,
      items: trustSignals.map((signal) => ({ text: signal })),
    },
    {
      id: "destinations",
      type: "destinations",
      visible: true,
      sort: 30,
      eyebrow: "Top study destinations",
      title: "Where will your degree take you?",
      primaryCta: { label: "All destinations", href: "/destinations" },
    },
    {
      id: "european_destinations",
      type: "european_destinations",
      visible: true,
      sort: 40,
      eyebrow: "European destinations",
      title: "Study in Europe with confidence",
      body: "Explore English-taught programmes, scholarships, and post-study pathways across key European destinations.",
      backgroundToken: "surface",
      primaryCta: { label: "All destinations", href: "/destinations" },
    },
    {
      id: "why_us",
      type: "why_us",
      visible: true,
      sort: 50,
      eyebrow: "Why Global Roots",
      title: "A consultancy built on trust and results",
      backgroundToken: "surface",
      items: whyUs.map((w) => ({ title: w.title, body: w.body })),
    },
    {
      id: "partners",
      type: "partners",
      visible: true,
      sort: 60,
      title: "Partnered universities",
    },
    {
      id: "programs",
      type: "programs",
      visible: true,
      sort: 70,
      eyebrow: "Popular programs",
      title: "Find the field that fits your future",
      backgroundToken: "surface",
      primaryCta: { label: "All programs", href: "/programs" },
    },
    {
      id: "scholarships",
      type: "scholarships",
      visible: true,
      sort: 80,
      eyebrow: "Featured Scholarships",
      title: "Funding that makes it possible",
      body: "Sample funding highlights for exploration — confirm eligibility and deadlines with a consultant.",
      primaryCta: { label: "All scholarships", href: "/scholarships" },
    },
    {
      id: "services",
      type: "services",
      visible: true,
      sort: 90,
      eyebrow: "Our services",
      title: "End-to-end support, from first idea to first lecture",
      backgroundToken: "navy",
    },
    {
      id: "visa",
      type: "visa",
      visible: true,
      sort: 100,
      eyebrow: "Student visa support",
      title: "Embassy-ready files, every time",
      body: "Our visa officers handle the details that decide outcomes.",
      primaryCta: { label: "Talk to a Visa Consultant", href: "/student-visa" },
    },
    {
      id: "reviews",
      type: "reviews",
      visible: true,
      sort: 110,
      title: "Google reviews",
    },
    {
      id: "faq",
      type: "faq",
      visible: true,
      sort: 120,
      eyebrow: "FAQ",
      title: "Common questions",
    },
    {
      id: "cta",
      type: "cta",
      visible: true,
      sort: 130,
      title: "Ready to start?",
      body: "Book a free consultation with Global Roots Consultants.",
      primaryCta: { label: "Book Free Consultation", href: "/contact" },
    },
    {
      id: "map",
      type: "map",
      visible: true,
      sort: 140,
      title: "Visit our office",
    },
  ],
};

export const DEFAULT_CMS_PAGE_SHELL = (title: string, path: string): CmsPageContent => ({
  seo: {
    title: `${title} | Global Roots Consultants`,
    description: DEFAULT_CMS_SEO_GLOBAL.description,
    canonicalPath: path,
  },
  sections: [
    {
      id: "intro",
      type: "custom_content",
      visible: true,
      sort: 10,
      title,
      body: "Content is managed from Admin → Website Management. Until published, the existing page layout remains the public fallback.",
    },
  ],
});

export function defaultPayloadForKey(key: string): unknown {
  switch (key) {
    case "site.header":
      return DEFAULT_CMS_HEADER;
    case "site.nav":
      return DEFAULT_CMS_NAV;
    case "site.footer":
      return DEFAULT_CMS_FOOTER;
    case "site.theme":
      return DEFAULT_CMS_THEME;
    case "page.home":
      return DEFAULT_CMS_HOME;
    case "page.about":
      return DEFAULT_CMS_PAGE_SHELL("About Us", "/about");
    case "page.services":
      return DEFAULT_CMS_PAGE_SHELL("Services", "/services");
    case "page.contact":
      return DEFAULT_CMS_PAGE_SHELL("Contact Us", "/contact");
    case "page.destinations":
      return DEFAULT_CMS_PAGE_SHELL("Study Destinations", "/destinations");
    case "seo.global":
      return DEFAULT_CMS_SEO_GLOBAL;
    default:
      return {};
  }
}
