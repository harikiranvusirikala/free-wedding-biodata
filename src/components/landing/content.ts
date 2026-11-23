import { t, type AppKey } from "@/lib/i18n";
import { META_DESCRIPTION, PRODUCTION_URL, REPOSITORY_URL, SITE_NAME, TITLE } from "@/lib/site";

// The words search engines read twice (VISION D26, D36): the landing page's questions and answers (shown on the page
// and given as FAQPage structured data, from this one list, so they always match) and the structured data itself.
// Pure: the pages (server components) and the tests import it. Wording lives in src/i18n/app/en.json.

export interface Question {
  question: string;
  answer: string;
}

/** The landing page's questions, in order (the help page has more). */
export const FAQ_IDS = ["free", "who", "update", "headings", "device", "image", "watermark", "matrimony"] as const;

export const FAQ: Question[] = FAQ_IDS.map((id) => ({ question: t(`help.faq.${id}.q` as AppKey), answer: t(`help.faq.${id}.a` as AppKey) }));

/** What the app does, for search engines (schema.org featureList). */
const FEATURES = [
  "Twenty biodata designs, each in three colours",
  "Live A4 preview that fits one page automatically",
  "Headings in English, Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Gujarati, Bengali and Punjabi",
  "Photo crop, zoom and rotate; extra photo pages and a horoscope page",
  "PDF with real text, and JPEG or PNG pages",
  "Saved only in the browser on your device; backup to a file",
  "Works offline",
];

/** schema.org's @id for a node of the site: `site` without a trailing slash. */
const node = (site: string, name: string) => `${site}/#${name}`;

/**
 * The home page's structured data (JSON-LD): the publisher, the site, the app (free: price 0) and the questions.
 * No HowTo (Google stopped showing it) and no counters, since nothing is counted (D36).
 */
export function homeStructuredData(site: string) {
  const home = `${site}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": node(site, "organization"), name: SITE_NAME, url: home, logo: `${site}/icons/icon-512.png`, sameAs: [REPOSITORY_URL] },
      { "@type": "WebSite", "@id": node(site, "website"), url: home, name: SITE_NAME, description: META_DESCRIPTION, inLanguage: "en", publisher: { "@id": node(site, "organization") } },
      {
        "@type": "WebApplication",
        "@id": node(site, "app"),
        name: SITE_NAME,
        alternateName: TITLE,
        url: home,
        description: META_DESCRIPTION,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Any, in a web browser",
        browserRequirements: "Requires JavaScript",
        image: `${site}/opengraph-image.png`,
        screenshot: `${site}/landing/editor-desktop.webp`,
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        featureList: FEATURES,
        license: "https://opensource.org/license/mit",
        publisher: { "@id": node(site, "organization") },
      },
      {
        "@type": "FAQPage",
        "@id": node(site, "faq"),
        mainEntity: FAQ.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
      },
    ],
  };
}

/** A page's place under Home, as BreadcrumbList structured data: `trail` is [name, path] from Home down. */
export function breadcrumbs(site: string, trail: readonly (readonly [name: string, path: string])[]) {
  const all = [[t("breadcrumb.home"), "/"] as const, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site}${path === "/" ? "/" : path}` })),
  };
}

/** The design gallery as an ItemList of its sample images (D36). */
export function galleryStructuredData(site: string, designs: readonly { id: string; name: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: t("templates.title"),
    itemListElement: designs.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: { "@type": "ImageObject", contentUrl: `${site}/designs/${d.id}.webp`, name: d.name, caption: t("templates.alt", { name: d.name }) },
    })),
  };
}

/** JSON-LD for a <script>: `<` escaped so text can never close the script element. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Search engines see the production address in structured data even on previews (they don't index those). */
export const STRUCTURED_DATA_SITE = PRODUCTION_URL;
