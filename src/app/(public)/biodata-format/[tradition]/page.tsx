import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { breadcrumbs, jsonLd, STRUCTURED_DATA_SITE } from "@/components/landing/content";
import { PagePicture } from "@/components/landing/Sections";
import { chipFields, personalRows, samplePicture, TRADITION_PAGES, type TraditionPage } from "@/components/landing/traditions";
import { button } from "@/components/ui/button";
import { card, cardText, cardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { contentTitle, eyebrow, lead, pageWidth, sectionTitle } from "@/components/ui/page";
import { getDocDictionary } from "@/i18n/doc";
import { t, type AppKey } from "@/lib/i18n";
import { pageOpenGraph } from "@/lib/site";

// A tradition page (Step 6.1 part 2, VISION D36): what a <tradition> marriage biodata usually holds (Personal details'
// rows from the editor's own chip data, printed labels from the English dictionary), the symbol families put at the
// top, three tips, how to add the tradition's rows in the editor (never inferred, D43), and a real sample page.

export const dynamicParams = false;

export function generateStaticParams() {
  return TRADITION_PAGES.map((tradition) => ({ tradition }));
}

const isPage = (value: string): value is TraditionPage => (TRADITION_PAGES as readonly string[]).includes(value);
const k = (page: TraditionPage, key: string) => t(`tradition.${page}.${key}` as AppKey);

export async function generateMetadata({ params }: { params: Promise<{ tradition: string }> }): Promise<Metadata> {
  const { tradition } = await params;
  if (!isPage(tradition)) return {};
  const path = `/biodata-format/${tradition}`;
  return {
    title: { absolute: k(tradition, "metaTitle") },
    description: k(tradition, "metaDescription"),
    alternates: { canonical: path },
    openGraph: pageOpenGraph(k(tradition, "metaTitle"), k(tradition, "metaDescription"), path),
  };
}

export default async function TraditionFormatPage({ params }: { params: Promise<{ tradition: string }> }) {
  const { tradition } = await params;
  if (!isPage(tradition)) notFound();
  const dict = getDocDictionary("en");
  const label = (key: string) => (dict.fields as Record<string, string>)[key] ?? key;
  const name = t(`tradition.name.${tradition}` as AppKey);
  const parts: [title: string, text: string][] = [
    [dict.sections.personal, personalRows(tradition).map(label).join(", ")],
    [dict.sections.family, t("tradition.family")],
    [dict.sections.contact, t("tradition.contact")],
    [dict.sections.partnerPreferences, t("tradition.partner")],
  ];
  return (
    <div className={`${pageWidth} pt-10 pb-20 sm:pt-12`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(STRUCTURED_DATA_SITE, [[k(tradition, "h1"), `/biodata-format/${tradition}`]])) }} />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
        <div className="min-w-0">
          <p className={eyebrow}>{t("tradition.eyebrow")}</p>
          <h1 className={`mt-2.5 ${contentTitle}`}>{k(tradition, "h1")}</h1>
          <p className={`mt-4 ${lead}`}>{k(tradition, "lead")}</p>
          <a href="/editor?new=1" className={`${button("primary", "lg")} mt-7`}>
            <Icon name="edit" className="size-[18px]" />
            {t("tradition.cta")}
          </a>

          <section aria-labelledby="includes" className="mt-12">
            <h2 id="includes" className={sectionTitle}>
              {t("tradition.includes")}
            </h2>
            <ul className="mt-4 grid gap-3">
              {parts.map(([title, text]) => (
                <li key={title} className={`${card} p-4 sm:p-5`}>
                  <h3 className={cardTitle}>{title}</h3>
                  <p className={`mt-1.5 ${cardText}`}>{text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="symbol" className="mt-11">
            <h2 id="symbol" className={sectionTitle}>
              {t("tradition.symbolTitle")}
            </h2>
            <p className={`mt-3 ${lead}`}>{k(tradition, "symbol")}</p>
          </section>

          <section aria-labelledby="tips" className="mt-11">
            <h2 id="tips" className={sectionTitle}>
              {t("tradition.tipsTitle")}
            </h2>
            <ul className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <li key={i} className="flex gap-3 text-[15.5px] leading-relaxed text-ink-2">
                  <Icon name="check" className="mt-1 size-[18px] text-good" />
                  {k(tradition, `tip.${i}`)}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="editor" className="mt-11">
            <h2 id="editor" className={sectionTitle}>
              {t("tradition.editorTitle")}
            </h2>
            <p className={`mt-3 ${lead}`}>{t("tradition.editorText", { chip: k(tradition, "chip"), fields: chipFields(tradition).map(label).join(", ") })}</p>
          </section>
        </div>

        <aside className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-line bg-gradient-to-br from-gold-soft/70 via-surface to-surface p-5 shadow-card">
              <PagePicture id={samplePicture(tradition)} alt={t("tradition.sampleAlt", { name })} />
            </div>
            <p className="mt-3 text-center text-sm text-ink-3">{t("tradition.sample")}</p>
            <nav aria-labelledby="other-formats" className="mt-8">
              <h2 id="other-formats" className="text-sm font-semibold text-ink">
                {t("tradition.others")}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {TRADITION_PAGES.filter((p) => p !== tradition).map((p) => (
                  <li key={p}>
                    <a href={`/biodata-format/${p}`} className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card hover:text-ink pointer-coarse:min-h-11 pointer-coarse:items-center">
                      {t(`tradition.name.${p}` as AppKey)}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/guide" className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card hover:text-ink pointer-coarse:min-h-11 pointer-coarse:items-center">
                    {t("tradition.guide")}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
