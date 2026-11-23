import { GoogleTagManager } from "@/components/GoogleTagManager";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SkipLink } from "@/components/SkipLink";
import { gtmId } from "@/lib/site";

/**
 * The public pages (/, /templates, /help, /privacy): the shared header and footer, and Google Tag Manager, here and
 * only here, in production only (gtmId), so the editor never loads it (VISION D22). Links into /editor are plain <a>
 * (full page loads), so Tag Manager's script never stays in memory on the way in.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <GoogleTagManager id={gtmId(process.env)} />
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
