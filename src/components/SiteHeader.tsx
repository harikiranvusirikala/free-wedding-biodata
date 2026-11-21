import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { ThemeMenu } from "@/components/ThemeMenu";
import { button } from "@/components/ui/button";
import { pageWidth } from "@/components/ui/page";
import { t } from "@/lib/i18n";

/**
 * The public pages' header (mockups: landing, help, privacy): logo and name, the pages that exist, the theme
 * menu and Create my biodata. The editor link is a plain <a>, a full page load, so analytics on the public
 * pages (Step 6.1) can't follow into the editor (VISION D22). Phones show the logo and theme only, as in the
 * mockup; the pages and the editor are linked from the page and the footer.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md backdrop-saturate-150">
      <div className={`${pageWidth} flex h-14 items-center gap-6 sm:h-16`}>
        <Logo />
        <NavLinks className="hidden sm:block" />
        <div className="ml-auto flex items-center gap-3">
          <ThemeMenu />
          <a href="/editor?new=1" className={`${button("primary")} max-sm:hidden`}>
            {t("header.create")}
          </a>
        </div>
      </div>
    </header>
  );
}
