import type { Metadata } from "next";
import { breadcrumbs, jsonLd, STRUCTURED_DATA_SITE } from "@/components/landing/content";
import { TRADITION_PAGES } from "@/components/landing/traditions";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { contentTitle, eyebrow, lead, pageWidth, sectionTitle } from "@/components/ui/page";
import { t, type AppKey } from "@/lib/i18n";
import { pageOpenGraph } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: t("guide.metaTitle") },
  description: t("guide.metaDescription"),
  alternates: { canonical: "/guide" },
  openGraph: pageOpenGraph(t("guide.metaTitle"), t("guide.metaDescription"), "/guide"),
};

// "What to write in each part" (Step 6.1 part 2, VISION D36): short advice per part of a biodata, each with an
// example from the fictional sample, then the tradition formats and a way into the editor.

const PARTS = ["personal", "horoscope", "education", "family", "contact", "about", "partner", "photo", "before"] as const;
const WITH_EXAMPLE = new Set<string>(["personal", "horoscope", "education", "family", "contact", "about", "partner"]);

export default function GuidePage() {
  return (
    <div className={`${pageWidth} pt-10 pb-20 sm:pt-12`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(STRUCTURED_DATA_SITE, [[t("nav.guide"), "/guide"]])) }} />
      <div className="max-w-3xl">
        <p className={eyebrow}>{t("guide.eyebrow")}</p>
        <h1 className={`mt-2.5 ${contentTitle}`}>{t("guide.title")}</h1>
        <p className={`mt-4 ${lead}`}>{t("guide.lead")}</p>
        <ol className="mt-10 space-y-10">
          {PARTS.map((part, i) => (
            <li key={part} id={part} className="scroll-mt-24">
              <h2 className={`flex items-baseline gap-3 ${sectionTitle}`}>
                <span aria-hidden className="text-base font-bold text-brand-ink tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t(`guide.${part}.title` as AppKey)}
              </h2>
              <p className={`mt-3 ${lead}`}>{t(`guide.${part}.text` as AppKey)}</p>
              {WITH_EXAMPLE.has(part) ? (
                <p className="mt-4 rounded-xl border border-gold/25 bg-gold-soft px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">{t("guide.example")}: </span>
                  {t(`guide.${part}.example` as AppKey)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <section aria-labelledby="formats" className="mt-14 border-t border-line pt-8">
          <h2 id="formats" className={sectionTitle}>
            {t("guide.formats")}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {TRADITION_PAGES.map((p) => (
              <li key={p}>
                <a href={`/biodata-format/${p}`} className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card hover:text-ink pointer-coarse:min-h-11 pointer-coarse:items-center">
                  {t(`tradition.${p}.h1` as AppKey)}
                </a>
              </li>
            ))}
          </ul>
          <a href="/editor?new=1" className={`${button("primary", "lg")} mt-8`}>
            <Icon name="edit" className="size-[18px]" />
            {t("guide.cta")}
          </a>
        </section>
      </div>
    </div>
  );
}
