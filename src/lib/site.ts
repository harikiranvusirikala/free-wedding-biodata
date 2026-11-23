import type { MetadataRoute } from "next";

// The product's identity in one place (VISION §1, D17, D37, D42), and where the site lives. Pure, so it is
// unit-tested; layout.tsx and robots.ts pass process.env, read at build time (the site is a static export).

export const SITE_NAME = "Free Wedding Biodata";
/** The production address (VISION §1). Previews and local builds use their own (siteUrl). */
export const PRODUCTION_URL = "https://free-wedding-biodata.vercel.app";
/** The search result title (VISION D42). */
export const TITLE = "Free Wedding Biodata Maker – Marriage Biodata PDF & PNG";
/** The home page's main heading (VISION §1). */
export const HEADLINE = "Free Wedding Biodata Maker";
/** Shown on the landing page in full (VISION D42). */
export const SHORT_DESCRIPTION =
  "Create a beautiful wedding biodata online for free. Add your personal, education, career, family and horoscope details, customize the design, and download a high-quality PDF or PNG.";
/** The meta description: search engines cut longer ones near 160 characters (VISION D42, tested). */
export const META_DESCRIPTION =
  "Create a free marriage biodata online in minutes. Pick a beautiful design, add your photo and details, and download a high-quality PDF or PNG. No login needed.";
/** The "Buy me a coffee" link, as in the sibling apps. Never a gate (VISION D25). */
export const SUPPORT_URL = "https://buymeacoffee.com/harikiranvusirikala";
export const REPOSITORY_URL = "https://github.com/harikiranvusirikala/free-wedding-biodata";

/**
 * The owner's Google Tag Manager container (VISION D22, 2026-11-23): loaded on the public pages only, in production
 * only (gtmId), never in the editor. A copy of the app puts its own here, or deletes it.
 */
export const GTM_CONTAINER = "GTM-KJ4DFJHW";

/**
 * Google Search Console's check that the owner runs the live site (VISION D26, 2026-11-23): a `google-site-verification`
 * meta tag on the home page. Google ties the code to the owner's account, so a copy of the app uses its own.
 */
export const GOOGLE_SITE_VERIFICATION = "iS4OF4-2DT8drLIM-FZU8JA8b-ALGsTFZEbWyQEoj8Y";

/** process.env, or a test's own. VERCEL_ENV is "production", "preview" or "development" (unset locally); VERCEL_URL is this deployment's host. */
export type SiteEnv = Record<string, string | undefined>;

/** Only production is for search engines. */
export const isLiveSite = (env: SiteEnv) => env.VERCEL_ENV === "production";

/** The site's address without a trailing slash: production's in production, the deployment's on a preview, else localhost. */
export function siteUrl(env: SiteEnv): string {
  if (isLiveSite(env)) return PRODUCTION_URL;
  const host = env.VERCEL_URL?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return host ? `https://${host}` : "http://localhost:3000";
}

/** The Tag Manager container for this build: production's only, so previews and local runs send nothing to Google. */
export const gtmId = (env: SiteEnv): string | undefined => (isLiveSite(env) ? GTM_CONTAINER : undefined);

/** Pages that are the app or for development, not for search results. */
const PRIVATE_PATHS = ["/editor", "/dev/"];

/** robots.txt: production allows everything but the app; previews and local builds ask search engines to stay away. */
export function robotsFor(env: SiteEnv): MetadataRoute.Robots {
  if (!isLiveSite(env)) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${PRODUCTION_URL}/sitemap.xml` };
}

/** The public pages search engines may list (the editor and dev pages never). */
export const PUBLIC_PATHS = ["/", "/templates", "/help", "/privacy"] as const;

/** sitemap.xml: the public pages in production; elsewhere empty (robots.txt asks search engines to stay away). */
export function sitemapFor(env: SiteEnv): MetadataRoute.Sitemap {
  if (!isLiveSite(env)) return [];
  return PUBLIC_PATHS.map((path) => ({ url: `${PRODUCTION_URL}${path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.7 }));
}

/**
 * A page's Open Graph tags. Next.js replaces the root layout's whole `openGraph` object when a page sets its own, so
 * the site name and type are repeated here (the link preview image comes from src/app/opengraph-image.png either way).
 */
export function pageOpenGraph(title: string, description: string, url: string) {
  return { siteName: SITE_NAME, type: "website" as const, title, description, url };
}
