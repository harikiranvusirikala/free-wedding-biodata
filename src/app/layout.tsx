import type { Metadata, Viewport } from "next";
import "./globals.css";
import { META_DESCRIPTION, SITE_NAME, TITLE, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  // Makes canonical links and link-preview images full addresses (src/lib/site.ts).
  metadataBase: new URL(siteUrl(process.env)),
  title: { default: TITLE, template: `%s · ${SITE_NAME}` },
  description: META_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", title: TITLE, description: META_DESCRIPTION },
  twitter: { card: "summary_large_image" },
  appleWebApp: { title: SITE_NAME },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

/** Until the theme menu (Step 1.1), Night follows the device, set before first paint so nothing flashes. */
const THEME_SCRIPT = `try{if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script changes <html>'s class before React starts.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
