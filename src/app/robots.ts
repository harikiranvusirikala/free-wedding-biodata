import type { MetadataRoute } from "next";
import { robotsFor } from "@/lib/site";

// A static export writes robots.txt once, at build time.
export const dynamic = "force-static";

/** robots.txt: production allows the public pages; everywhere else nothing (src/lib/site.ts). */
export default function robots(): MetadataRoute.Robots {
  return robotsFor(process.env);
}
