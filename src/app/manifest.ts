import type { MetadataRoute } from "next";
import { META_DESCRIPTION, SITE_NAME } from "@/lib/site";

// A static export writes manifest.webmanifest once, at build time.
export const dynamic = "force-static";

/**
 * The web app manifest (Step 5.2): "Install app" / "Add to Home screen". The installed app opens the editor, which
 * reopens the last draft and works offline after its first visit (public/sw.js), and never loads analytics (D22).
 * The icons come from `npm run images` (scripts/site-images.mts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/editor",
    name: SITE_NAME,
    short_name: "Biodata",
    description: META_DESCRIPTION,
    start_url: "/editor",
    scope: "/",
    display: "standalone",
    lang: "en",
    categories: ["productivity", "utilities"],
    background_color: "#fafaf9", // the Day page colour (globals.css --page)
    theme_color: "#8a1c2b", // the brand maroon, the icon's tile
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
