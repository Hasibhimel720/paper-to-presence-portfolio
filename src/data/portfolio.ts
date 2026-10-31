// Central content config — edit projects, experience, services and contact details here.
// To use a real image for a project, set `cover` (and optional `gallery`) to an image URL.

import type { Category, CaseSection, Project, Tone } from "@/lib/cms/schema";

export type { CaseSection, Category, Project, Tone } from "@/lib/cms/schema";

export const categories: ("All Projects" | Category)[] = [
  "All Projects",
  "Brand Identity",
  "Packaging Design",
  "Product Advertising",
  "Corporate Branding",
  "Motion & Visual Design",
];

export const site = {
  name: "Hasib Himel",
  fullName: "Hasibuzzaman Himel",
  role: "Brand Identity & Product Designer",
  location: "Bangladesh",
  availability: "Available for select projects", // editable
  available: true,
  email: "", // add your public email, e.g. "hello@example.com"
  whatsapp: "", // only add if you want it shown
  behance: "https://www.behance.net/hasibhimel72",
  linkedin: "https://www.linkedin.com/in/hasibhimel072",
};

const packagingSections = (name: string): CaseSection[] => [
  { title: "Overview", body: `[Add a short overview of the ${name} project — the product, the brand and what the packaging needed to achieve.]` },
  { title: "Design challenge", body: "[Describe the challenge: shelf competition, information hierarchy, print constraints or brand consistency.]" },
  { title: "Label & hierarchy", body: "[Explain how the product name, variant, key claims and mandatory information were organised.]", visual: `Replace with ${name} label detail` },
  { title: "Packaging applications", body: "[Show the final packaging across sizes, variants or formats.]", visual: `Replace with ${name} packaging mockups` },
];

const identitySections = (name: string): CaseSection[] => [
  { title: "Overview", body: `[Add an overview of ${name} — who the brand is and what the identity had to communicate.]` },
  { title: "Logo rationale", body: "[Explain the concept behind the mark, its construction and why it fits the brand.]", visual: `Replace with ${name} logo construction` },
  { title: "Typography & color", body: "[Describe the typefaces and color system chosen and how they work together.]" },
  { title: "Brand applications", body: "[Show the identity applied to stationery, signage, packaging or digital touchpoints.]", visual: `Replace with ${name} brand applications` },
];

export const projects: Project[] = [
  {
    slug: "garden-green-fresh-tea",
    title: "Garden Green Fresh Tea",
    category: "Packaging Design",
    type: "Packaging Design",
    description: "Fresh, garden-inspired packaging designed to give a tea product a clear and recognisable shelf presence.",
    tone: "tea",
    placeholder: "Replace with Garden Green Fresh Tea packaging images",
    behance: site.behance,
    sections: packagingSections("Garden Green Fresh Tea"),
  },
  {
    slug: "ghee-jar-label",
    title: "Ghee Jar Label",
    category: "Packaging Design",
    type: "Label Design",
    description: "A warm, appetising jar label balancing traditional character with clear product information.",
    tone: "ghee",
    placeholder: "Replace with Ghee Jar Label project images",
    behance: site.behance,
    sections: packagingSections("Ghee Jar Label"),
  },
  {
    slug: "nakano-international",
    title: "Nakano International",
    category: "Brand Identity",
    type: "Logo Redesign",
    description: "A logo redesign giving the company a more confident, modern and consistent visual identity.",
    tone: "steel",
    placeholder: "Replace with Nakano International identity presentation",
    behance: site.behance,
    sections: identitySections("Nakano International"),
    palette: ["var(--tone-steel)", "var(--foreground)", "var(--tone-ink)"],
  },
  {
    slug: "black-tea-packaging",
    title: "Black Tea Packaging",
    category: "Packaging Design",
    type: "Packaging Design",
    description: "Rich, bold packaging that communicates depth of flavour and stands out among everyday tea brands.",
    tone: "black",
    placeholder: "Replace with Black Tea packaging images",
    behance: site.behance,
    sections: packagingSections("Black Tea"),
  },
  {
    slug: "various-lentils-packaging",
    title: "Various Lentils Packaging",
    category: "Packaging Design",
    type: "Packaging Range",
    description: "A cohesive packaging range for multiple lentil varieties, with clear variant differentiation.",
    tone: "lentil",
    placeholder: "Replace with Various Lentils packaging images",
    behance: site.behance,
    sections: packagingSections("Various Lentils"),
  },
  {
    slug: "luxury-jewellery-brand",
    title: "Luxury Jewellery Brand",
    category: "Brand Identity",
    type: "Branding",
    description: "An elegant brand identity crafted to express refinement, craft and premium value.",
    tone: "gold",
    placeholder: "Replace with Luxury Jewellery brand images",
    behance: site.behance,
    sections: identitySections("the Luxury Jewellery Brand"),
    palette: ["var(--tone-gold)", "var(--tone-ink)", "var(--foreground)"],
  },
  {
    slug: "proven-logo",
    title: "Proven",
    category: "Brand Identity",
    type: "Logo Design",
    description: "A clean, purposeful logo built for clarity and recognition across applications.",
    tone: "ink",
    placeholder: "Replace with Proven logo presentation",
    behance: site.behance,
    sections: identitySections("Proven"),
    palette: ["var(--tone-ink)", "var(--foreground)", "var(--primary)"],
  },
  {
    slug: "animated-texture-transition",
    title: "Animated Texture Transition",
    category: "Motion & Visual Design",
    type: "Motion Design",
    description: "Animated texture transitions created for digital media and social content.",
    tone: "motion",
    placeholder: "Replace with Animated Texture Transition video or stills",
    behance: site.behance,
    sections: [
      { title: "Overview", body: "[Describe the purpose of the animation and where it was used.]" },
      { title: "Art direction", body: "[Explain the textures, motion style, timing and rhythm.]", visual: "Replace with animation stills or embedded video" },
    ],
  },
  {
    slug: "product-advertising",
    title: "Product Advertising Visuals",
    category: "Product Advertising",
    type: "Advertising",
    description: "Selected product-focused advertising and campaign visuals for consumer brands.",
    tone: "ink",
    placeholder: "Replace with selected product advertising visuals",
    sections: [
      { title: "Art direction", body: "[Describe the visual concept, composition and product presentation.]", visual: "Replace with campaign key visual" },
      { title: "Campaign visuals", body: "[Show adaptations across social media, print or digital formats.]", visual: "Replace with campaign adaptations" },
    ],
  },
  {
    slug: "corporate-branding",
    title: "Corporate Branding & Profiles",
    category: "Corporate Branding",
    type: "Corporate Branding",
    description: "Company profiles, presentations and brand communication materials.",
    tone: "steel",
    placeholder: "Replace with company profile / corporate branding images",
    sections: [
      { title: "Overview", body: "[Describe the company and the communication materials designed.]" },
      { title: "Applications", body: "[Show profile spreads, stationery or presentation slides.]", visual: "Replace with company profile spreads" },
    ],
  },
];

export const featuredSlugs = [
  "garden-green-fresh-tea",
  "ghee-jar-label",
  "nakano-international",
  "black-tea-packaging",
  "various-lentils-packaging",
  "luxury-jewellery-brand",
];

export const services = [
  { n: "01", title: "Brand Identity Design", body: "Distinctive visual identities and a consistent visual language.", items: ["Logo design", "Identity systems", "Typography & color systems", "Brand guidelines", "Brand applications"] },
  { n: "02", title: "Product Packaging Design", body: "Thoughtful packaging that communicates product value and strengthens recognition.", items: ["Product packaging", "Labels", "Layouts", "Mockups", "Print-ready artwork"] },
  { n: "03", title: "Product Advertising", body: "Compelling commercial visuals that put the product first.", items: ["Product ads", "Campaign visuals", "Promotional graphics", "Digital ad creatives", "Product compositions"] },
  { n: "04", title: "Corporate Branding", body: "Consistent, confident business communication.", items: ["Company profiles", "Presentations", "Stationery", "Brand communication", "Corporate promotions"] },
  { n: "05", title: "Motion & Visual Design", body: "Selected animation and motion graphics for brands.", items: ["Motion graphics", "Animated assets", "Social animations", "Short promos"] },
];

// Verify and edit positions/dates — placeholders are shown in brackets.
export const experience = [
  { company: "RRP Group", role: "Brand Identity / Graphic Designer", type: "[Employment type]", location: "[Location]", dates: "[Start — End]", body: "[Add responsibilities: brand identity, packaging and commercial visuals.]" },
  { company: "Ruby Tech", role: "Graphic Designer", type: "[Employment type]", location: "[Location]", dates: "[Start — End]", body: "[Add responsibilities: product advertising and electronics branding.]" },
  { company: "Gheewaali", role: "Graphic Designer", type: "[Employment type]", location: "[Location]", dates: "[Start — End]", body: "[Add responsibilities: food packaging, labels and social content.]" },
];

export const process = [
  { n: "01", title: "Discover", body: "Understand the brand, audience, goals, product and requirements." },
  { n: "02", title: "Define", body: "Establish creative direction, visual approach and priorities." },
  { n: "03", title: "Design", body: "Develop concepts, explore visual directions and build the design system." },
  { n: "04", title: "Refine", body: "Review the work, improve details and incorporate agreed feedback." },
  { n: "05", title: "Deliver", body: "Prepare final assets and production-ready files." },
];

export const faqs = [
  { q: "What information do you need to start a project?", a: "A short overview of your brand or product, your goals, target audience, any existing brand assets, and your expected timeline. Details can be shared through the contact form." },
  { q: "Do you design both brand identities and packaging?", a: "Yes. I work on brand identity and on extending it into packaging, labels and product presentation, so everything stays consistent." },
  { q: "Can you work with an existing brand?", a: "Yes. I can design new packaging, advertising or materials within your existing identity, or help refresh it." },
  { q: "Do you provide print-ready packaging files?", a: "Final packaging artwork can be prepared for print. Exact file formats and specifications are agreed per project." },
  { q: "Can you work with international clients?", a: "Yes, I'm based in Bangladesh and open to working remotely with clients in other countries." },
  { q: "How can I request a project quote?", a: "Send your project details through the contact form or reach out on LinkedIn. Pricing depends on scope and is discussed individually." },
  { q: "Can you create advertising visuals for an existing product?", a: "Yes. I create product-focused advertising and campaign visuals for products that are already on the market." },
];
