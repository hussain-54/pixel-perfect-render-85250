import uk from "@/assets/dest-uk.jpg";
import canada from "@/assets/dest-canada.jpg";
import germany from "@/assets/dest-germany.jpg";
import usa from "@/assets/dest-usa.jpg";
import italy from "@/assets/dest-italy.jpg";
import france from "@/assets/dest-france.jpg";
import japan from "@/assets/dest-japan.jpg";
import malaysia from "@/assets/dest-malaysia.jpg";
import nz from "@/assets/dest-nz.jpg";
import finland from "@/assets/dest-finland.jpg";

/**
 * Destination imagery is reused for countries without a dedicated photo yet.
 * Dedicated assets exist for: UK, France, Germany, Italy, Finland, Canada, USA,
 * Malaysia, New Zealand, Japan. Other countries reuse regional fallback photos.
 */
const img = {
  uk,
  france,
  germany,
  italy,
  finland,
  canada,
  usa,
  malaysia,
  nz,
  europe: germany,
  nordic: finland,
  mediterranean: italy,
  asia: malaysia,
  eastAsia: japan,
  oceania: nz,
} as const;

export type Destination = {
  name: string;
  img: string;
  desc: string;
  work: string;
  intake: string;
};

/** Full study destinations — top 10 listed first for homepage “Top Study Destinations”. */
export const destinations: Destination[] = [
  {
    name: "UK",
    img: img.uk,
    desc: "One-year master's degrees, world-ranked universities and a 2-year Graduate Route visa.",
    work: "2 years post-study",
    intake: "Sep · Jan",
  },
  {
    name: "France",
    img: img.france,
    desc: "Grandes écoles, low public tuition and a gateway to the European job market.",
    work: "2 years APS",
    intake: "Sep · Jan",
  },
  {
    name: "Ireland",
    img: img.uk,
    desc: "English-taught degrees, welcoming campuses and strong post-study work opportunities.",
    work: "Up to 2 years",
    intake: "Sep · Jan",
  },
  {
    name: "Austria",
    img: img.europe,
    desc: "Affordable public universities in the heart of Europe with growing English programmes.",
    work: "12 months",
    intake: "Oct · Mar",
  },
  {
    name: "Germany",
    img: img.germany,
    desc: "Low or no tuition at public universities with excellent engineering programs.",
    work: "18 months",
    intake: "Oct · Apr",
  },
  {
    name: "Italy",
    img: img.italy,
    desc: "Historic universities, regional scholarships and affordable English-taught degrees.",
    work: "12 months",
    intake: "Sep · Feb",
  },
  {
    name: "Hungary",
    img: img.europe,
    desc: "Stipendium Hungaricum and affordable European degrees across a wide range of fields.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "Lithuania",
    img: img.nordic,
    desc: "Modern Baltic universities with competitive tuition and English-taught programmes.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "Sweden",
    img: img.nordic,
    desc: "Innovation-focused universities with strong research culture and quality of life.",
    work: "Up to 1 year",
    intake: "Aug · Jan",
  },
  {
    name: "Finland",
    img: img.finland,
    desc: "Top-rated education system, innovation focus and a strong welfare state.",
    work: "2 years",
    intake: "Aug · Jan",
  },
  {
    name: "Czech Republic",
    img: img.europe,
    desc: "Central European universities with affordable tuition and growing English offerings.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "Belgium",
    img: img.france,
    desc: "Multilingual campuses and strong European networks for business and science.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "Netherlands",
    img: img.europe,
    desc: "Highly international universities with a wide range of English-taught degrees.",
    work: "Orientation year",
    intake: "Sep · Feb",
  },
  {
    name: "New Zealand",
    img: img.oceania,
    desc: "Small classes, practical learning and post-study work rights of up to 3 years.",
    work: "Up to 3 years",
    intake: "Feb · Jul",
  },
  {
    name: "Slovenia",
    img: img.mediterranean,
    desc: "Compact European study destination with accessible tuition and scenic campuses.",
    work: "Varies",
    intake: "Oct · Feb",
  },
  {
    name: "Latvia",
    img: img.nordic,
    desc: "Baltic universities offering English programmes at competitive costs.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "Malta",
    img: img.mediterranean,
    desc: "English-speaking island destination within the EU for business and hospitality studies.",
    work: "Varies",
    intake: "Oct · Feb",
  },
  {
    name: "Romania",
    img: img.europe,
    desc: "Affordable European degrees with established medicine and engineering pathways.",
    work: "Varies",
    intake: "Oct · Feb",
  },
  {
    name: "Bulgaria",
    img: img.europe,
    desc: "Cost-effective European study options with English-taught medical programmes.",
    work: "Varies",
    intake: "Oct · Feb",
  },
  {
    name: "Canada",
    img: img.canada,
    desc: "Affordable, welcoming and a clear pathway from study permit to permanent residence.",
    work: "Up to 3 years PGWP",
    intake: "Sep · Jan · May",
  },
  {
    name: "USA",
    img: img.usa,
    desc: "The world's largest higher-education system with unmatched research and STEM OPT.",
    work: "1–3 years OPT",
    intake: "Aug · Jan",
  },
  {
    name: "UAE",
    img: img.asia,
    desc: "International branch campuses and career-focused programmes in a global hub.",
    work: "Varies",
    intake: "Sep · Jan",
  },
  {
    name: "Malaysia",
    img: img.malaysia,
    desc: "Branch campuses of UK and Australian universities at a fraction of the cost.",
    work: "Limited",
    intake: "Jan · May · Sep",
  },
  {
    name: "Cyprus",
    img: img.mediterranean,
    desc: "English-taught programmes in a Mediterranean setting with growing international intake.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "Turkey",
    img: img.mediterranean,
    desc: "Wide programme choice across public and private universities with competitive fees.",
    work: "Varies",
    intake: "Sep · Feb",
  },
  {
    name: "South Korea",
    img: img.eastAsia,
    desc: "Technology-forward universities with expanding English-taught graduate options.",
    work: "Varies",
    intake: "Mar · Sep",
  },
];

/** Homepage “Top Study Destinations” — first 10 of the official list. */
export const topDestinations = destinations.slice(0, 10);

export const programCategories = [
  { name: "Business & Management", count: 1240, examples: "MBA, Finance, Marketing, Supply Chain" },
  {
    name: "Computer Science & IT",
    count: 980,
    examples: "Software Engineering, Cyber Security, Cloud",
  },
  { name: "Engineering", count: 860, examples: "Mechanical, Civil, Electrical, Robotics" },
  {
    name: "Medicine & Health Sciences",
    count: 540,
    examples: "MBBS, Public Health, Nursing, Pharmacy",
  },
  {
    name: "Social Sciences",
    count: 610,
    examples: "Psychology, Economics, International Relations",
  },
  { name: "Arts & Design", count: 320, examples: "Architecture, Graphic Design, Film" },
  {
    name: "Hospitality & Tourism",
    count: 210,
    examples: "Hotel Management, Events, Culinary Arts",
  },
  { name: "Data Science & AI", count: 450, examples: "Machine Learning, Analytics, Robotics AI" },
];

export const services = [
  {
    title: "Career & Study Counseling",
    body: "One-to-one sessions to align your academic profile, budget and career goals with the right path.",
  },
  {
    title: "University Selection",
    body: "A data-driven shortlist of universities that match your grades, budget and ambitions.",
  },
  {
    title: "Application Processing",
    body: "We prepare, review and submit complete applications so nothing is missed.",
  },
  {
    title: "Scholarship Guidance",
    body: "Identify funding you qualify for and craft competitive scholarship essays.",
  },
  {
    title: "Student Visa Assistance",
    body: "End-to-end visa filing with document checks and embassy-ready files.",
  },
  {
    title: "Documentation Support",
    body: "SOPs, CVs and recommendation letters refined by experienced editors.",
  },
  {
    title: "Interview Preparation",
    body: "Mock university and visa interviews with detailed feedback.",
  },
  {
    title: "Pre-Departure Guidance",
    body: "Accommodation, travel, banking and arrival briefings before you fly.",
  },
];

export const visaSteps = [
  {
    title: "Document Preparation",
    body: "A country-specific checklist and a full review of every document before submission.",
  },
  {
    title: "Application Guidance",
    body: "Accurate online forms, appointment booking and biometrics scheduling.",
  },
  {
    title: "Financial Documentation",
    body: "Bank statements, sponsorship letters and funds evidence that meet embassy rules.",
  },
  {
    title: "Interview Preparation",
    body: "Mock embassy interviews with the questions officers actually ask.",
  },
  {
    title: "Visa Application Support",
    body: "Tracking, follow-ups and guidance until your passport is returned.",
  },
];

export const howItWorks = [
  { title: "Free consultation", body: "Tell us your goals and we map out your options." },
  { title: "Shortlist & documents", body: "We shortlist universities and prepare your file." },
  { title: "Apply & receive offers", body: "We submit applications and manage responses." },
  { title: "Visa & departure", body: "We file your visa and prepare you to travel." },
];

export const whyUs = [
  {
    title: "Direct university partnerships",
    body: "Official representation with 2,000+ institutions across 30+ countries.",
  },
  {
    title: "SECP Registered",
    body: "Global Roots Consultants is SECP Registered — a verified, professionally run consultancy.",
  },
  {
    title: "Transparent case tracking",
    body: "Follow every stage of your journey in your personal student portal.",
  },
  {
    title: "Experienced counselors",
    body: "Trained consultants with years of country-specific study-abroad experience.",
  },
];

/** Homepage featured scholarships — titles only; no invented amounts or deadlines. */
export const featuredScholarships = [
  {
    name: "France Eiffel Scholarship",
    country: "France",
    summary: "French government excellence programme for international postgraduate students.",
  },
  {
    name: "Hungarian Stipendium Scholarship",
    country: "Hungary",
    summary:
      "Government scholarship supporting international students across Hungarian universities.",
  },
  {
    name: "Regional & University-Specific Scholarships",
    country: "Multiple",
    summary: "Funding opportunities offered by regions and partner universities worldwide.",
  },
  {
    name: "Bright Scholarships",
    country: "Multiple",
    summary: "Merit-focused scholarship pathways for eligible international applicants.",
  },
];

export const stories = [
  {
    name: "Ali Raza",
    from: "Lahore",
    to: "University of Manchester, UK",
    program: "MSc Data Science",
    quote:
      "Global Roots made the whole process clear. I always knew exactly what was happening and what to do next.",
  },
  {
    name: "Fatima Noor",
    from: "Karachi",
    to: "University of Toronto, Canada",
    program: "MEng Civil Engineering",
    quote: "My consultant helped me secure a scholarship I didn't even know I qualified for.",
  },
  {
    name: "Hamza Sheikh",
    from: "Islamabad",
    to: "TU Munich, Germany",
    program: "MSc Mechanical Engineering",
    quote:
      "The visa interview preparation was outstanding. I walked into the embassy fully confident.",
  },
  {
    name: "Zainab Iqbal",
    from: "Faisalabad",
    to: "Monash University, Australia",
    program: "Master of Public Health",
    quote: "Professional, honest and always available. I recommend them to every friend.",
  },
];

export const faqs = [
  {
    q: "Is the first consultation really free?",
    a: "Yes. Your first consultation is completely free and carries no obligation.",
  },
  {
    q: "When should I start my application?",
    a: "Ideally 9–12 months before your intended intake, so there is time for tests, applications, scholarships and visa.",
  },
  {
    q: "Do I need IELTS to study abroad?",
    a: "Most universities require an English test, but some accept Medium of Instruction letters or alternatives like PTE, TOEFL or Duolingo.",
  },
  {
    q: "Can I study abroad with a study gap?",
    a: "Yes. Gaps can be justified with work experience or other evidence; we help you present it correctly.",
  },
  {
    q: "How long does a student visa take?",
    a: "It varies by country — typically 3 to 8 weeks after biometrics. We give you realistic timelines for your destination.",
  },
];

export const resources = [
  {
    title: "UK Graduate Route explained: work 2 years after study",
    tag: "Visa",
    date: "2026-09-18",
    read: "6 min",
  },
  {
    title: "How to write a Statement of Purpose that gets noticed",
    tag: "Applications",
    date: "2026-09-05",
    read: "8 min",
  },
  {
    title: "Fully funded scholarships for Pakistani students in 2027",
    tag: "Scholarships",
    date: "2026-08-28",
    read: "10 min",
  },
  {
    title: "Canada study permit: proof of funds checklist",
    tag: "Visa",
    date: "2026-08-14",
    read: "5 min",
  },
  {
    title: "IELTS vs PTE vs Duolingo: which test should you take?",
    tag: "Tests",
    date: "2026-07-30",
    read: "7 min",
  },
  {
    title: "Studying in Germany for free: what you really pay",
    tag: "Destinations",
    date: "2026-07-12",
    read: "6 min",
  },
];

/** Primary Global Roots company statistics. */
export const stats = [
  { value: "2,000+", label: "Universities" },
  { value: "30+", label: "Countries" },
  { value: "500+", label: "Students Guided" },
  { value: "SECP", label: "Registered" },
];

export const trustSignals = [
  "Official university representatives",
  "SECP Registered",
  "British Council trained counselors",
  "Our Office — Saleemi Chowk, Faisalabad",
];
