import { ExternalLink } from "@/components/ExternalLink";
import { Logo } from "@/components/Logo";
import { button, focusRing } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { pageWidth } from "@/components/ui/page";
import { t } from "@/lib/i18n";
import { REPOSITORY_URL, SITE_NAME, SUPPORT_URL } from "@/lib/site";

// 44 px tall on touch screens, like every control (VISION D16), so the lists open up a little on phones.
const link = `inline-flex items-center rounded-sm text-ink-3 transition-colors hover:text-ink pointer-coarse:min-h-11 ${focusRing}`;
const heading = "mb-3 text-[13.5px] font-semibold text-ink";

/**
 * The public pages' footer (mockup: landing): what the product is, Buy me a coffee (VISION D25, never a
 * gate), the pages that exist, the code, and the notice that this is a document tool that doesn't match or
 * connect people (D35). The year is the build's: the site is rebuilt on every change.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className={`${pageWidth} pt-12 pb-8 text-sm sm:pt-14`}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-[1.6fr_1fr_1fr] lg:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 sm:col-span-1">
            <Logo />
            <p className="mt-3.5 max-w-xs text-pretty text-ink-3">{t("footer.about")}</p>
            <ExternalLink href={SUPPORT_URL} className={`${button("secondary", "sm")} mt-4`}>
              <Icon name="coffee" className="size-4" />
              {t("footer.coffee")}
            </ExternalLink>
          </div>
          <nav aria-label={t("footer.use")}>
            <h2 className={heading}>{t("footer.use")}</h2>
            <ul className="space-y-2.5 pointer-coarse:space-y-0">
              <li>
                <a href="/editor?new=1" className={link}>
                  {t("footer.create")}
                </a>
              </li>
              <li>
                <a href="/templates" className={link}>
                  {t("footer.templates")}
                </a>
              </li>
              <li>
                <a href="/help" className={link}>
                  {t("footer.help")}
                </a>
              </li>
              <li>
                <a href="/privacy" className={link}>
                  {t("footer.privacy")}
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label={t("footer.project")}>
            <h2 className={heading}>{t("footer.project")}</h2>
            <ul className="space-y-2.5 pointer-coarse:space-y-0">
              <li>
                <ExternalLink href={REPOSITORY_URL} className={link}>
                  {t("footer.source")}
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={`${REPOSITORY_URL}/issues`} className={link}>
                  {t("footer.issues")}
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href={`${REPOSITORY_URL}/blob/main/LICENSE`} className={link}>
                  {t("footer.licence")}
                </ExternalLink>
              </li>
            </ul>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-5 text-ink-3 sm:flex-row sm:justify-between sm:gap-6">
          <p className="text-pretty">{t("footer.notice")}</p>
          <p className="shrink-0">{t("footer.copyright", { year: new Date().getFullYear(), name: SITE_NAME })}</p>
        </div>
      </div>
    </footer>
  );
}
