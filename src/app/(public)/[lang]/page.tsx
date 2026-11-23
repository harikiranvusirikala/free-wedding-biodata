import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { breadcrumbs, jsonLd, STRUCTURED_DATA_SITE } from "@/components/landing/content";
import { ALL_LOCALES, getLanguagePage, LANGUAGE_ALTERNATES, LANGUAGE_PAGES } from "@/components/landing/languages";
import { PagePicture } from "@/components/landing/Sections";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { pageWidth } from "@/components/ui/page";
import { SITE_NAME, pageOpenGraph } from "@/lib/site";

// A language landing page (Step 6.1 part 2, VISION D36): /te, /hi, … in that language, with a real page made by the
// app with that language's headings, and "Create" opening a new draft whose headings print in it
// (/editor?new=1&lang=<code>, a full page load, D22). Only these nine paths exist (dynamicParams = false).

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGE_PAGES.map((p) => ({ lang: p.lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const page = getLanguagePage((await params).lang);
  if (!page) return {};
  const path = `/${page.lang}`;
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: path, languages: LANGUAGE_ALTERNATES },
    openGraph: { ...pageOpenGraph(page.title, page.description, path), locale: page.locale, alternateLocale: ALL_LOCALES.filter((l) => l !== page.locale) },
  };
}

export default async function LanguagePage({ params }: { params: Promise<{ lang: string }> }) {
  const page = getLanguagePage((await params).lang);
  if (!page) notFound();
  return (
    <div lang={page.lang} className={`${pageWidth} pt-10 pb-20 sm:pt-14`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(STRUCTURED_DATA_SITE, [[page.native, `/${page.lang}`]])) }} />
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card">
            <span className="size-1.5 rounded-full bg-gold" aria-hidden />
            {page.native} · {SITE_NAME}
          </p>
          <h1 className="mt-5 text-[32px] leading-[1.2] font-bold tracking-tight text-balance text-ink sm:text-5xl">{page.h1}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-ink-2">{page.lead}</p>
          <a href={`/editor?new=1&lang=${page.lang}`} className={`${button("primary", "lg")} mt-7 h-12 px-6 text-base`}>
            <Icon name="edit" className="size-[18px]" />
            {page.cta}
          </a>
          <ul className="mt-8 space-y-3">
            {page.points.map((point) => (
              <li key={point} className="flex gap-3 text-[15.5px] leading-relaxed text-ink-2">
                <Icon name="check" className="mt-1 size-[18px] text-good" />
                {point}
              </li>
            ))}
          </ul>
          <p className="mt-6 flex gap-2.5 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm leading-relaxed text-ink-3">
            <Icon name="info" className="mt-0.5 size-4" />
            {page.note}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-gradient-to-br from-gold-soft/70 via-surface to-surface p-5 shadow-card sm:p-8">
          <PagePicture id={`classic-gold-${page.lang}`} alt={page.alt} className="mx-auto max-w-sm" />
        </div>
      </div>
      <nav aria-label={page.others} className="mt-16 border-t border-line pt-8">
        <h2 className="text-base font-semibold text-ink">{page.others}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          <li>
            <a href="/" lang="en" className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card hover:text-ink pointer-coarse:min-h-11 pointer-coarse:items-center">
              English
            </a>
          </li>
          {LANGUAGE_PAGES.filter((p) => p.lang !== page.lang).map((p) => (
            <li key={p.lang}>
              <a href={`/${p.lang}`} lang={p.lang} className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card hover:text-ink pointer-coarse:min-h-11 pointer-coarse:items-center">
                {p.native}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
