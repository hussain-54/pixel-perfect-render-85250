/**
 * Centralized public-site navigation.
 * Only links to routes that exist in this project.
 *
 * Missing (not linked — add later if pages are built):
 * - Eligibility Calculator, Study Plan, Resume Builder, University Comparison tool
 * - Blog, Videos
 * - Destinations: South Korea, Turkey (not in site data)
 * - Dedicated scholarship-type / study-level detail pages
 */
import { destinations, topDestinations, programCategories, services } from "@/data/site";
import { universities, scholarships } from "@/data/mock";

export type AppPath =
  | "/"
  | "/about"
  | "/contact"
  | "/destinations"
  | "/programs"
  | "/resources"
  | "/scholarships"
  | "/services"
  | "/student-visa"
  | "/success-stories"
  | "/universities"
  | "/sign-in"
  | "/sign-up"
  | "/forgot-password"
  | "/student/dashboard"
  | "/staff/dashboard"
  | "/admin/dashboard";

export type NavLink = {
  label: string;
  to: AppPath;
  search?: { q?: string; country?: string };
  hash?: string;
  description?: string;
};

export type MegaColumn = {
  heading: string;
  links: NavLink[];
};

export type MegaCta = {
  title: string;
  body?: string;
  primary: NavLink;
  secondary?: NavLink;
};

export type MegaMenuId =
  "programs" | "universities" | "scholarships" | "destinations" | "services" | "resources";

export type MainNavItem =
  | { id: "home"; label: string; type: "link"; to: AppPath }
  | { id: MegaMenuId; label: string; type: "mega" }
  | { id: "success"; label: string; type: "link"; to: AppPath };

export const mainNavigation: MainNavItem[] = [
  { id: "home", label: "Home", type: "link", to: "/" },
  { id: "programs", label: "Programs", type: "mega" },
  { id: "universities", label: "Universities", type: "mega" },
  { id: "scholarships", label: "Scholarships", type: "mega" },
  { id: "destinations", label: "Study Destinations", type: "mega" },
  { id: "services", label: "Services", type: "mega" },
  { id: "success", label: "Success Stories", type: "link", to: "/success-stories" },
  { id: "resources", label: "Resources", type: "mega" },
];

const studyLevels: NavLink[] = [
  { label: "Bachelor's", to: "/programs" },
  { label: "Master's", to: "/programs" },
  { label: "PhD / Doctorate", to: "/programs" },
  { label: "Diploma & Certificate", to: "/programs" },
  { label: "Foundation", to: "/programs" },
  { label: "Short Courses", to: "/programs" },
];

export const programMenu: { columns: MegaColumn[]; cta: MegaCta } = {
  columns: [
    { heading: "Study Levels", links: studyLevels },
    {
      heading: "Popular Fields",
      links: [
        "Business & Management",
        "Computer Science & IT",
        "Engineering",
        "Medicine & Health Sciences",
        "Data Science & AI",
        "Social Sciences",
        "Arts & Design",
        "Hospitality & Tourism",
      ]
        .filter((name) => programCategories.some((p) => p.name === name))
        .map((name) => ({
          label: name,
          to: "/programs" as const,
        })),
    },
    {
      heading: "Quick Links",
      links: [
        { label: "Explore All Programs", to: "/programs" },
        { label: "Find a Program", to: "/programs" },
        { label: "Book Free Consultation", to: "/contact" },
      ],
    },
  ],
  cta: {
    title: "Not sure which program fits?",
    body: "A senior consultant can map your profile to the right field and destination.",
    primary: { label: "Book Free Consultation", to: "/contact" },
    secondary: { label: "Browse Programs", to: "/programs" },
  },
};

const destSlug = (name: string) => name.toLowerCase().replace(/\s/g, "-");

export const universityMenu: { columns: MegaColumn[]; cta: MegaCta } = {
  columns: [
    {
      heading: "Study by Country",
      links: destinations.map((d) => ({
        label: d.name,
        to: "/universities" as const,
        search: { country: d.name },
      })),
    },
    {
      heading: "Featured Universities",
      links: universities.slice(0, 8).map((u) => ({
        label: u.name,
        to: "/universities" as const,
        search: { q: u.name },
        description: `${u.city}, ${u.country}`,
      })),
    },
  ],
  cta: {
    title: "Can't find the right university?",
    body: "Get free guidance from a Global Roots consultant.",
    primary: { label: "Get Free Guidance", to: "/contact" },
    secondary: { label: "View All Universities", to: "/universities" },
  },
};

export const scholarshipMenu: { columns: MegaColumn[]; cta: MegaCta } = {
  columns: [
    {
      heading: "Scholarship Types",
      links: [
        { label: "France Eiffel Scholarship", to: "/scholarships" },
        { label: "Hungarian Stipendium Scholarship", to: "/scholarships" },
        { label: "Regional & University-Specific", to: "/scholarships" },
        { label: "Bright Scholarships", to: "/scholarships" },
        { label: "Fully Funded", to: "/scholarships" },
        { label: "University Scholarships", to: "/scholarships" },
      ],
    },
    {
      heading: "Featured & Popular",
      links: scholarships.slice(0, 8).map((s) => ({
        label: s.name,
        to: "/scholarships" as const,
        description: `${s.country} · ${s.funding}`,
      })),
    },
    {
      heading: "Quick Links",
      links: [
        { label: "All Scholarships", to: "/scholarships" },
        { label: "Scholarship Finder", to: "/scholarships" },
        { label: "Talk to a Consultant", to: "/contact" },
      ],
    },
  ],
  cta: {
    title: "Need help finding funding?",
    body: "We'll match you with scholarships you can realistically win.",
    primary: { label: "Talk to a Consultant", to: "/contact" },
    secondary: { label: "Browse Scholarships", to: "/scholarships" },
  },
};

export const destinationMenu: { columns: MegaColumn[]; cta: MegaCta } = {
  columns: [
    {
      heading: "Top Destinations",
      links: topDestinations.map((d) => ({
        label: `Study in ${d.name}`,
        to: "/destinations" as const,
        hash: destSlug(d.name),
        description: d.desc.split(".")[0] + ".",
      })),
    },
    {
      heading: "More Destinations",
      links: destinations.slice(10).map((d) => ({
        label: `Study in ${d.name}`,
        to: "/destinations" as const,
        hash: destSlug(d.name),
        description: d.desc.split(".")[0] + ".",
      })),
    },
  ],
  cta: {
    title: "Compare destinations with an expert",
    primary: { label: "Explore All Destinations", to: "/destinations" },
    secondary: { label: "Book Consultation", to: "/contact" },
  },
};

const studyAbroadServices = services
  .filter((s) =>
    [
      "Career & Study Counseling",
      "University Selection",
      "Application Processing",
      "Scholarship Guidance",
    ].includes(s.title),
  )
  .map((s) => ({
    label: s.title === "Career & Study Counseling" ? "Study Counseling" : s.title,
    to: "/services" as const,
  }));

export const serviceMenu: { columns: MegaColumn[]; cta: MegaCta } = {
  columns: [
    {
      heading: "Study Abroad Services",
      links: [...studyAbroadServices, { label: "Program Selection", to: "/programs" }],
    },
    {
      heading: "Visa Services",
      links: [
        { label: "Student Visa Assistance", to: "/student-visa" },
        { label: "Visa Documentation", to: "/student-visa" },
        { label: "Interview Preparation", to: "/student-visa" },
        { label: "Visa Application Support", to: "/student-visa" },
        { label: "Pre-Departure Guidance", to: "/student-visa" },
      ],
    },
    {
      heading: "Student Support",
      links: [
        { label: "Accommodation Guidance", to: "/services" },
        { label: "Travel Guidance", to: "/services" },
        { label: "Pre-Departure Support", to: "/services" },
        { label: "Documentation Support", to: "/services" },
      ],
    },
  ],
  cta: {
    title: "Ready when you are",
    primary: { label: "Book Free Consultation", to: "/contact" },
    secondary: { label: "View All Services", to: "/services" },
  },
};

export const resourceMenu: { columns: MegaColumn[]; cta: MegaCta } = {
  columns: [
    {
      heading: "Guides",
      links: [
        { label: "Study Abroad Guide", to: "/resources" },
        { label: "Visa Guide", to: "/student-visa" },
        { label: "Application Guide", to: "/resources" },
        { label: "Scholarship Guide", to: "/scholarships" },
      ],
    },
    {
      heading: "Explore",
      links: [
        { label: "All Resources", to: "/resources" },
        { label: "Success Stories", to: "/success-stories" },
        { label: "Universities", to: "/universities" },
        { label: "Scholarships", to: "/scholarships" },
      ],
    },
    {
      heading: "Get Help",
      links: [
        { label: "Book Consultation", to: "/contact" },
        { label: "About Global Roots", to: "/about" },
        { label: "Student Visa Support", to: "/student-visa" },
      ],
    },
  ],
  cta: {
    title: "Start with the right reading",
    primary: { label: "Explore Resources", to: "/resources" },
    secondary: { label: "Book Consultation", to: "/contact" },
  },
};

export const megaMenus: Record<MegaMenuId, { columns: MegaColumn[]; cta: MegaCta }> = {
  programs: programMenu,
  universities: universityMenu,
  scholarships: scholarshipMenu,
  destinations: destinationMenu,
  services: serviceMenu,
  resources: resourceMenu,
};

/** Single entry point — role is resolved after authentication. */
export const loginLinks: NavLink[] = [{ label: "Sign In", to: "/sign-in" }];

export type SearchHit = {
  label: string;
  group: "Universities" | "Programs" | "Scholarships" | "Destinations" | "Resources";
  to: AppPath;
  search?: { q?: string; country?: string };
  hash?: string;
  meta?: string;
};

/** Client-only search index over existing marketing data. */
export function buildSearchIndex(): SearchHit[] {
  const hits: SearchHit[] = [
    ...universities.map((u) => ({
      label: u.name,
      group: "Universities" as const,
      to: "/universities" as const,
      search: { q: u.name },
      meta: `${u.city}, ${u.country}`,
    })),
    ...programCategories.map((p) => ({
      label: p.name,
      group: "Programs" as const,
      to: "/programs" as const,
      meta: `${p.count} programs`,
    })),
    ...scholarships.map((s) => ({
      label: s.name,
      group: "Scholarships" as const,
      to: "/scholarships" as const,
      meta: `${s.country} · ${s.funding}`,
    })),
    ...destinations.map((d) => ({
      label: d.name,
      group: "Destinations" as const,
      to: "/destinations" as const,
      hash: destSlug(d.name),
      meta: d.work,
    })),
    {
      label: "Guides & insights",
      group: "Resources",
      to: "/resources",
      meta: "Articles and checklists",
    },
    {
      label: "Success Stories",
      group: "Resources",
      to: "/success-stories",
      meta: "Student journeys",
    },
  ];
  return hits;
}

export function filterSearch(query: string, limit = 12): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return buildSearchIndex().slice(0, limit);
  return buildSearchIndex()
    .filter(
      (h) =>
        h.label.toLowerCase().includes(q) ||
        h.meta?.toLowerCase().includes(q) ||
        h.group.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
