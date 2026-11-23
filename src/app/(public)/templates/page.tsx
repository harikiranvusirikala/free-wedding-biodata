import type { Metadata } from "next";
import { breadcrumbs, galleryStructuredData, jsonLd, STRUCTURED_DATA_SITE } from "@/components/landing/content";
import { PagePicture } from "@/components/landing/Sections";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { contentTitle, eyebrow, lead, pageWidth } from "@/components/ui/page";
import { DESIGN_CATALOG } from "@/document/templates/catalog";
import { t } from "@/lib/i18n";
import { pageOpenGraph } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: t("templates.metaTitle") },
  description: t("templates.metaDescription"),
  alternates: { canonical: "/templates" },
  openGraph: pageOpenGraph(t("templates.metaTitle"), t("templates.metaDescription"), "/templates"),
};

// The design gallery (BUILD_PLAN Step 6.1, VISION D26, D36; mockup: templates): every design as a real page made
// by the app (the Simple form's fictional sample, e2e/capture.spec.ts → public/designs/), its kind, its three colours
// and "Use <design>", which opens a new draft already in it (/editor?new=1&design=<id>, a full page load, D22).

export default function TemplatesPage() {
  const site = STRUCTURED_DATA_SITE;
  return (
    <div className={`${pageWidth} pt-10 pb-20 sm:pt-12`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(site, [[t("nav.templates"), "/templates"]])) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(galleryStructuredData(site, DESIGN_CATALOG)) }} />
      <header className="max-w-3xl">
        <p className={eyebrow}>{t("templates.eyebrow")}</p>
        <h1 className={`mt-2.5 ${contentTitle}`}>{t("templates.title")}</h1>
        <p className={`mt-4 ${lead}`}>{t("templates.lead")}</p>
      </header>
      <ul className="mt-10 grid grid-cols-1 gap-x-5 gap-y-9 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="design-gallery">
        {DESIGN_CATALOG.map((design) => (
          <li key={design.id} className="flex flex-col" data-design={design.id}>
            <div className="rounded-2xl border border-line bg-surface p-3 shadow-card">
              <PagePicture id={design.id} alt={t("templates.alt", { name: design.name })} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <h2 className="text-[15px] font-semibold text-ink">{design.name}</h2>
              <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-3">{t(`templates.style.${design.skeleton}`)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="flex items-center gap-1.5">
                <span className="sr-only">{t("templates.colours", { names: design.colors.map((c) => c.name).join(", ") })}</span>
                {design.colors.map((c) => (
                  <span key={c.id} aria-hidden title={c.name} className="size-4 rounded-full ring-1 ring-black/15" style={{ background: c.swatch }} />
                ))}
              </p>
              <a href={`/editor?new=1&design=${design.id}`} aria-label={t("templates.useLabel", { name: design.name })} className={button("secondary", "sm")}>
                {t("templates.use")}
                <Icon name="arrowRight" className="size-4" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
