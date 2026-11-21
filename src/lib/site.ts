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

/** Pages that are the app or for development, not for search results. */
const PRIVATE_PATHS = ["/editor", "/dev/"];

/** robots.txt: production allows everything but the app; previews and local builds ask search engines to stay away. */
export function robotsFor(env: SiteEnv): MetadataRoute.Robots {
  if (!isLiveSite(env)) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS } };
}
