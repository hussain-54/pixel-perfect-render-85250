/**
 * Public “Universities to Explore” catalogue for the homepage carousel.
 * These are destinations for exploration — not a verified partnership inventory.
 * Logo assets: only commit official files after brand-permission review.
 */

export type ExploreUniversityLogoStatus =
  | "verified_local"
  | "pending_review"
  | "text_fallback";

export type ExploreUniversity = {
  id: string;
  name: string;
  country: string;
  /** Official institutional website (for verification / consultant reference). */
  website: string;
  /** Local asset under /public when logoStatus is verified_local. */
  logoPath: string | null;
  logoStatus: ExploreUniversityLogoStatus;
};

export const EXPLORE_UNIVERSITIES_SECTION = {
  eyebrow: "University destinations",
  title: "Universities to Explore",
  body: "A curated set of institutions students commonly explore with Global Roots. Confirm current options, intakes, and any partnership arrangements with a consultant — this is not a live partnership inventory.",
} as const;

/** All 60 supplied institutions — names and accents preserved. */
export const exploreUniversities: ExploreUniversity[] = [
  // United Kingdom (1–18)
  {
    id: "eu-uk-greenwich",
    name: "University of Greenwich",
    country: "United Kingdom",
    website: "https://www.gre.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-northeastern-london",
    name: "Northeastern University London",
    country: "United Kingdom",
    website: "https://www.nulondon.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-northumbria",
    name: "Northumbria University Newcastle",
    country: "United Kingdom",
    website: "https://www.northumbria.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-cranfield",
    name: "Cranfield University",
    country: "United Kingdom",
    website: "https://www.cranfield.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-ntu",
    name: "Nottingham Trent University",
    country: "United Kingdom",
    website: "https://www.ntu.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-sussex",
    name: "University of Sussex",
    country: "United Kingdom",
    website: "https://www.sussex.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-oxford-brookes",
    name: "Oxford Brookes University",
    country: "United Kingdom",
    website: "https://www.brookes.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-exeter",
    name: "University of Exeter",
    country: "United Kingdom",
    website: "https://www.exeter.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-bangor",
    name: "Bangor University",
    country: "United Kingdom",
    website: "https://www.bangor.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-brighton",
    name: "University of Brighton",
    country: "United Kingdom",
    website: "https://www.brighton.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-kent",
    name: "University of Kent",
    country: "United Kingdom",
    website: "https://www.kent.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-mmu",
    name: "Manchester Metropolitan University",
    country: "United Kingdom",
    website: "https://www.mmu.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-surrey",
    name: "University of Surrey",
    country: "United Kingdom",
    website: "https://www.surrey.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-aberdeen",
    name: "University of Aberdeen",
    country: "United Kingdom",
    website: "https://www.abdn.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-royal-holloway",
    name: "Royal Holloway, University of London",
    country: "United Kingdom",
    website: "https://www.royalholloway.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-london-met",
    name: "London Metropolitan University",
    country: "United Kingdom",
    website: "https://www.londonmet.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-st-marys",
    name: "St Mary's University, London",
    country: "United Kingdom",
    website: "https://www.stmarys.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-uk-aston",
    name: "Aston University",
    country: "United Kingdom",
    website: "https://www.aston.ac.uk/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Ireland (19)
  {
    id: "eu-ie-dcu",
    name: "Dublin City University",
    country: "Ireland",
    website: "https://www.dcu.ie/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Sweden (20–24)
  {
    id: "eu-se-linnaeus",
    name: "Linnaeus University",
    country: "Sweden",
    website: "https://lnu.se/en/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-se-skovde",
    name: "University of Skövde",
    country: "Sweden",
    website: "https://www.his.se/en/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-se-university-west",
    name: "University West",
    country: "Sweden",
    website: "https://www.hv.se/en/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-se-kristianstad",
    name: "Kristianstad University",
    country: "Sweden",
    website: "https://www.hkr.se/en/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-se-karlstad",
    name: "Karlstad University",
    country: "Sweden",
    website: "https://www.kau.se/en",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // South Korea (25–28)
  {
    id: "eu-kr-kyungdong",
    name: "Kyungdong University",
    country: "South Korea",
    website: "https://www.kduniv.ac.kr/eng/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-kr-woosong",
    name: "Woosong University",
    country: "South Korea",
    website: "https://english.wsu.ac.kr/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-kr-korean-bible",
    name: "Korean Bible University",
    country: "South Korea",
    website: "https://www.bible.ac.kr/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-kr-namseoul",
    name: "Namseoul University",
    country: "South Korea",
    website: "https://www.nsu.ac.kr/eng/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Germany (29–35)
  {
    id: "eu-de-srh-berlin",
    name: "SRH University, Berlin Campus",
    country: "Germany",
    website: "https://www.srh-berlin.de/en/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-de-bsbi",
    name: "Berlin School of Business and Innovation (BSBI)",
    country: "Germany",
    website: "https://www.berlinsbi.com/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-de-arden-berlin",
    name: "Arden University Berlin Study Center",
    country: "Germany",
    website: "https://arden.ac.uk/our-locations/berlin",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-de-macromedia",
    name: "Macromedia University of Applied Sciences",
    country: "Germany",
    website: "https://www.macromedia-fachhochschule.de/en/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-de-ue",
    name: "University of Europe for Applied Sciences",
    country: "Germany",
    website: "https://www.ue-germany.com/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-de-gisma",
    name: "GISMA University of Applied Sciences",
    country: "Germany",
    website: "https://www.gisma.com/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-de-constructor",
    name: "Constructor University",
    country: "Germany",
    website: "https://constructor.university/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Türkiye (36–39)
  {
    id: "eu-tr-bahcesehir",
    name: "Bahçeşehir University",
    country: "Türkiye",
    website: "https://bau.edu.tr/en",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-tr-aydin",
    name: "Istanbul Aydın University",
    country: "Türkiye",
    website: "https://www.aydin.edu.tr/en-us/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-tr-kultur",
    name: "Istanbul Kültür University",
    country: "Türkiye",
    website: "https://www.iku.edu.tr/en",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-tr-istinye",
    name: "İstinye University",
    country: "Türkiye",
    website: "https://www.istinye.edu.tr/en",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Netherlands (40–41)
  {
    id: "eu-nl-srh-haarlem",
    name: "SRH Haarlem University of Applied Sciences",
    country: "Netherlands",
    website: "https://www.srh.nl/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-nl-erasmus",
    name: "Erasmus University Rotterdam",
    country: "Netherlands",
    website: "https://www.eur.nl/en",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Canada (42–50)
  {
    id: "eu-ca-dalhousie",
    name: "Dalhousie University",
    country: "Canada",
    website: "https://www.dal.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-victoria",
    name: "University of Victoria",
    country: "Canada",
    website: "https://www.uvic.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-northeastern",
    name: "Northeastern University",
    country: "Canada",
    website: "https://toronto.northeastern.edu/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-cbu",
    name: "Cape Breton University",
    country: "Canada",
    website: "https://www.cbu.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-unb",
    name: "University of New Brunswick",
    country: "Canada",
    website: "https://www.unb.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-lakehead",
    name: "Lakehead University",
    country: "Canada",
    website: "https://www.lakeheadu.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-ontario-tech",
    name: "Ontario Tech University",
    country: "Canada",
    website: "https://ontariotechu.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-trent",
    name: "Trent University",
    country: "Canada",
    website: "https://www.trentu.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-ca-huron",
    name: "Huron University",
    country: "Canada",
    website: "https://huronatwestern.ca/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  // Malaysia (51–60)
  {
    id: "eu-my-tarumt",
    name: "TAR UMT (Tunku Abdul Rahman University of Management and Technology)",
    country: "Malaysia",
    website: "https://www.tarc.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-sunway",
    name: "Sunway University Malaysia",
    country: "Malaysia",
    website: "https://university.sunway.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-usm",
    name: "Universiti Sains Malaysia (USM)",
    country: "Malaysia",
    website: "https://www.usm.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-apu",
    name: "APU, Asia Pacific University of Technology & Innovation",
    country: "Malaysia",
    website: "https://www.apu.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-ucsi",
    name: "UCSI University",
    country: "Malaysia",
    website: "https://www.ucsiuniversity.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-uow",
    name: "University of Wollongong Malaysia",
    country: "Malaysia",
    website: "https://www.uow.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-lincoln",
    name: "Lincoln University College, Malaysia",
    country: "Malaysia",
    website: "https://www.lincoln.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-unirazak",
    name: "Universiti Tun Abdul Razak (UNIRAZAK)",
    country: "Malaysia",
    website: "https://www.unirazak.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-unikl",
    name: "University of Kuala Lumpur (UniKL)",
    country: "Malaysia",
    website: "https://www.unikl.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
  {
    id: "eu-my-swinburne",
    name: "Swinburne University of Technology, Malaysia",
    country: "Malaysia",
    website: "https://www.swinburne.edu.my/",
    logoPath: null,
    logoStatus: "pending_review",
  },
];

export function exploreUniversitiesAwaitingLogos(): ExploreUniversity[] {
  return exploreUniversities.filter((u) => u.logoStatus !== "verified_local" || !u.logoPath);
}

export function exploreUniversitiesWithVerifiedLogos(): ExploreUniversity[] {
  return exploreUniversities.filter((u) => u.logoStatus === "verified_local" && Boolean(u.logoPath));
}

/** Split into two interleaved rows for opposing marquee directions. */
export function splitExploreUniversitiesForCarousel(list: readonly ExploreUniversity[] = exploreUniversities): {
  rowA: ExploreUniversity[];
  rowB: ExploreUniversity[];
} {
  const rowA: ExploreUniversity[] = [];
  const rowB: ExploreUniversity[] = [];
  list.forEach((u, i) => {
    if (i % 2 === 0) rowA.push(u);
    else rowB.push(u);
  });
  return { rowA, rowB };
}
