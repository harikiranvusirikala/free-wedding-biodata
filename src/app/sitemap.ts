import type { MetadataRoute } from "next";
import { sitemapFor } from "@/lib/site";

// A static export writes sitemap.xml once, at build time.
export const dynamic = "force-static";

/** sitemap.xml: the public pages, in production only (src/lib/site.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor(process.env);
}
