import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SkipLink } from "@/components/SkipLink";

/**
 * The public pages (/, /help, /privacy, later /templates): the shared header and footer. Step 6.1 adds Google
 * Tag Manager here, and only here, so the editor never loads it (VISION D22). Links into /editor are plain
 * <a> (full page loads).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
