import type { Metadata } from "next";
import { AsideCard, ContentPage, ContentSection, Prose } from "@/components/ContentPage";
import { ExternalLink } from "@/components/ExternalLink";
import { Rich } from "@/components/Rich";
import { button } from "@/components/ui/button";
import { card, cardText, cardTitle, noteCard } from "@/components/ui/card";
import { GitHubMark, Icon } from "@/components/ui/icons";
import { breadcrumbs, jsonLd, STRUCTURED_DATA_SITE } from "@/components/landing/content";
import { t } from "@/lib/i18n";
import { REPOSITORY_URL, SITE_NAME, SUPPORT_URL, pageOpenGraph } from "@/lib/site";

export const metadata: Metadata = {
  title: t("help.metaTitle"),
  description: t("help.metaDescription"),
  alternates: { canonical: "/help" },
  openGraph: pageOpenGraph(t("help.metaTitle"), t("help.metaDescription"), "/help"),
};

// Practical help (VISION §5, mockup: help) as a content page (BUILD_PLAN A7). Honest about what exists: the
// editor is still being built, so parts that haven't arrived say so, with no dates promised. Each step that
// ships a feature updates its words in src/i18n/app/en.json.

const SECTIONS = [
  { id: "how", label: t("help.how.title") },
  { id: "saving", label: t("help.saving.title") },
  { id: "languages", label: t("help.languages.title") },
  { id: "printing", label: t("help.printing.title") },
  { id: "faq", label: t("help.faq.title") },
  { id: "support", label: t("help.support.title") },
];

const STEPS = ["fill", "preview", "download"] as const;
const PRINT_TIPS = ["help.printing.1", "help.printing.2", "help.printing.3", "help.printing.4", "help.printing.5"] as const;
const FAQ = ["free", "account", "who", "update", "device", "headings", "image", "watermark", "matrimony", "offline", "script"] as const;

export default function HelpPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs(STRUCTURED_DATA_SITE, [[t("nav.help"), "/help"]])) }} />
      <ContentPage
        eyebrow={t("help.eyebrow")}
        title={t("help.title")}
        lead={t("help.lead")}
        sections={SECTIONS}
        aside={
          <>
            <AsideCard title={t("help.aside.editor.title")} text={t("help.aside.editor.text")}>
              {/* A plain <a>: a full page load into the editor (VISION D22). */}
              <a href="/editor" className={button("primary")}>
                <Icon name="edit" className="size-4" />
                {t("help.aside.editor.action")}
              </a>
            </AsideCard>
            <AsideCard title={t("help.aside.privacy.title")} text={t("help.aside.privacy.text")}>
              <a href="/privacy" className={button("secondary")}>
                <Icon name="shield" className="size-4" />
                {t("help.aside.privacy.action")}
              </a>
            </AsideCard>
            {/* Only beside the text: below 1280 px it would repeat "Support the project" just above it. */}
            <AsideCard title={t("help.aside.coffee.title")} text={t("help.aside.coffee.text")} className={`${card} max-xl:hidden`}>
              <ExternalLink href={SUPPORT_URL} className={button("secondary")}>
                <Icon name="coffee" className="size-4" />
                {t("help.support.coffee")}
              </ExternalLink>
            </AsideCard>
          </>
        }
      >
        <p className={`${noteCard} flex gap-3 text-[15px] leading-relaxed text-pretty text-ink-2 [&_b]:font-semibold [&_b]:text-ink`}>
          <Icon name="info" className="mt-0.5 size-5 text-gold" />
          <span>
            <Rich text={t("help.status")} />
          </span>
        </p>

        <ContentSection id="how" title={t("help.how.title")}>
          <ol className="grid gap-3.5 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step} className={`${card} flex gap-3.5 p-4 sm:block sm:p-[18px]`}>
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-page">
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5 sm:mt-3 sm:pt-0">
                  <p className={`${cardTitle} text-[15px]`}>{t(`help.how.${step}.title`)}</p>
                  <p className={`mt-1 ${cardText}`}>{t(`help.how.${step}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <Prose>
              <p>{t("help.how.after")}</p>
            </Prose>
          </div>
        </ContentSection>

        <ContentSection id="saving" title={t("help.saving.title")}>
          <Prose>
            <p>{t("help.saving.1")}</p>
            <p>{t("help.saving.2")}</p>
            <p>
              <Rich text={t("help.saving.3")} />
            </p>
          </Prose>
        </ContentSection>

        <ContentSection id="languages" title={t("help.languages.title")}>
          <Prose>
            <p>{t("help.languages.1")}</p>
            <p>{t("help.languages.2")}</p>
            <p>{t("help.languages.3")}</p>
          </Prose>
        </ContentSection>

        <ContentSection id="printing" title={t("help.printing.title")}>
          <Prose>
            <p>{t("help.printing.lead")}</p>
          </Prose>
          <ul className={`${card} mt-4 divide-y divide-line`}>
            {PRINT_TIPS.map((key) => (
              <li key={key} className="flex gap-3 px-4 py-3 text-[15px] leading-relaxed text-pretty text-ink-2 sm:px-[18px]">
                <Icon name="check" className="mt-1 size-4 text-good" />
                {t(key)}
              </li>
            ))}
          </ul>
        </ContentSection>

        <ContentSection id="faq" title={t("help.faq.title")}>
          <div className="grid gap-2.5">
            {FAQ.map((id, i) => (
              <details key={id} open={i === 0} className={`${card} group`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:px-[18px] pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
                  {t(`help.faq.${id}.q`)}
                  <Icon name="chevronDown" className="size-[18px] text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <p className="-mt-1 px-4 pb-4 text-[14.5px] leading-relaxed text-pretty text-ink-3 sm:px-[18px]">{t(`help.faq.${id}.a`)}</p>
              </details>
            ))}
          </div>
        </ContentSection>

        <ContentSection id="support" title={t("help.support.title")}>
          <Prose>
            <p>{t("help.support.1", { name: SITE_NAME })}</p>
            <p>{t("help.support.2")}</p>
          </Prose>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <ExternalLink href={SUPPORT_URL} className={button("secondary")}>
              <Icon name="coffee" className="size-4" />
              {t("help.support.coffee")}
            </ExternalLink>
            <ExternalLink href={`${REPOSITORY_URL}/issues`} className={button("secondary")}>
              <GitHubMark className="size-4" />
              {t("help.support.issues")}
            </ExternalLink>
          </div>
        </ContentSection>
      </ContentPage>
    </>
  );
}
