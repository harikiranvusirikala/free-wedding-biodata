import type { Metadata } from "next";
import { ContinueEditing } from "@/components/landing/ContinueEditing";
import { homeStructuredData, jsonLd, STRUCTURED_DATA_SITE } from "@/components/landing/content";
import { ALL_LOCALES, HOME_LOCALE, LANGUAGE_ALTERNATES } from "@/components/landing/languages";
import { ClosingCall, Faq, FeatureRow, FeaturesGrid, HowItWorks, LanguageChips, PagePicture, Privacy, ProductShot, SectionHeading } from "@/components/landing/Sections";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { pageWidth } from "@/components/ui/page";
import { DESIGN_CATALOG } from "@/document/templates/catalog";
import { t } from "@/lib/i18n";
import { GOOGLE_SITE_VERIFICATION, HEADLINE, META_DESCRIPTION, SHORT_DESCRIPTION, TITLE, pageOpenGraph } from "@/lib/site";

// The landing page (BUILD_PLAN Step 6.1, VISION §5, D26, D36; mockup: landing): what the app is, Create my biodata
// (always a new draft) with Continue editing when this browser has a draft (Step 1.4), the real product shot, how it
// works, three feature rows, the templates strip, the features grid, the privacy promise, the questions and a closing
// call to action. Links into the editor are plain <a> (full page loads, VISION D22).

export const metadata: Metadata = {
  // The root layout's title and description; this page is their canonical home.
  title: { absolute: TITLE },
  alternates: { canonical: "/", languages: LANGUAGE_ALTERNATES },
  openGraph: { ...pageOpenGraph(TITLE, META_DESCRIPTION, "/"), locale: HOME_LOCALE, alternateLocale: ALL_LOCALES.filter((l) => l !== HOME_LOCALE) },
  verification: { google: GOOGLE_SITE_VERIFICATION },
};

const TICKS = ["watermark", "signup", "offline", "languages"] as const;
/** The templates strip: one of each kind (traditional, festive, modern, minimal). */
const STRIP = ["classic-gold", "peacock", "executive-navy", "minimal-ivory"];

export default function Home() {
  const [first, ...rest] = HEADLINE.split(" ");
  const highlighted = rest.slice(0, 2).join(" ");
  const tail = rest.slice(2).join(" ");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(homeStructuredData(STRUCTURED_DATA_SITE)) }} />
      <section className="relative overflow-hidden pb-20 sm:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[560px] bg-[radial-gradient(55%_60%_at_50%_30%,rgb(222_160_70/0.22),transparent),radial-gradient(50%_50%_at_75%_20%,rgb(138_28_43/0.10),transparent)] dark:opacity-40"
        />
        <div className={`${pageWidth} relative pt-14 sm:pt-20 lg:pt-24`}>
          <div className="flex flex-col items-center text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card">
              <span className="size-1.5 rounded-full bg-gold" aria-hidden />
              <span className="sm:hidden">{t("home.badgeShort")}</span>
              <span className="max-sm:hidden">{t("home.badge")}</span>
            </p>
            <h1 className="mt-6 max-w-4xl text-[34px] leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {first} <span className="text-accent-gradient">{highlighted}</span> {tail}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-pretty text-ink-2">{SHORT_DESCRIPTION}</p>
            <div className="mt-8 flex w-full flex-col items-center gap-2">
              <a href="/editor?new=1" className={`${button("primary", "lg")} h-12 px-6 text-base`}>
                <Icon name="edit" className="size-[18px]" />
                {t("header.create")}
              </a>
              <ContinueEditing />
            </div>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-3">
              {TICKS.map((id) => (
                <li key={id} className="flex items-center gap-1.5">
                  <Icon name="check" className="size-4 text-good" />
                  {t(`home.tick.${id}`)}
                </li>
              ))}
            </ul>
          </div>
          <ProductShot />
        </div>
      </section>

      <HowItWorks />

      <section aria-label={t("home.preview.eyebrow")} className="space-y-20 border-t border-line bg-sunken/40 py-16 sm:space-y-28 sm:py-24">
        <div className={pageWidth}>
          <FeatureRow prefix="home.preview" points={3}>
            <PagePicture id="classic-gold" alt={t("home.preview.alt")} className="mx-auto max-w-sm" />
          </FeatureRow>
        </div>
        <div className={pageWidth}>
          <FeatureRow id="languages" prefix="home.languages" points={0} flip after={<LanguageChips />}>
            <PagePicture id="classic-gold-te" alt={t("home.languages.alt")} className="mx-auto max-w-sm" />
          </FeatureRow>
        </div>
        <div className={pageWidth}>
          <FeatureRow prefix="home.share" points={3}>
            <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
              <PagePicture id="royal-maroon" alt={t("home.share.alt")} />
              <PagePicture id="deepam-night" alt="" className="translate-y-6" />
            </div>
          </FeatureRow>
        </div>
      </section>

      <section id="templates" aria-labelledby="templates-title" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
        <div className={pageWidth}>
          <SectionHeading id="templates-title" eyebrowKey="home.templates.eyebrow" titleKey="home.templates.title" leadKey="home.templates.lead" />
          <ul className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STRIP.map((id) => {
              const design = DESIGN_CATALOG.find((d) => d.id === id)!;
              return (
                <li key={id}>
                  <a href="/templates" className="group block rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                    <div className="rounded-2xl border border-line bg-surface p-3 shadow-card transition-shadow group-hover:shadow-pop">
                      <PagePicture id={id} alt={t("templates.alt", { name: design.name })} />
                    </div>
                    <p className="mt-2.5 flex items-center justify-between gap-2 px-1 text-[15px] font-semibold text-ink">
                      {design.name}
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">{t(`templates.style.${design.skeleton}`)}</span>
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-10 text-center">
            <a href="/templates" className={button("secondary")}>
              {t("home.templates.all")}
              <Icon name="arrowRight" className="size-4" />
            </a>
          </div>
        </div>
      </section>

      <FeaturesGrid />
      <Privacy />
      <Faq />
      <ClosingCall />
    </>
  );
}
