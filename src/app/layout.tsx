import type { Metadata, Viewport } from "next";
import "./globals.css";
import { META_DESCRIPTION, SITE_NAME, TITLE, siteUrl } from "@/lib/site";
import { THEME_SCRIPT } from "@/lib/theme-script";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script changes <html>'s class before React starts.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Day, Night or Follow device, on <html> before the first paint so nothing flashes (theme-script.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page bg-page-wash font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
