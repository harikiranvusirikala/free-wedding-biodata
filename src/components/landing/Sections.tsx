import Image from "next/image";
import type { ReactNode } from "react";
import { button } from "@/components/ui/button";
import { card, cardText, cardTitle } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icons";
import { eyebrow, pageWidth } from "@/components/ui/page";
import { t, type AppKey } from "@/lib/i18n";
import { FAQ } from "./content";
import { LANGUAGE_PAGES } from "./languages";

// The landing page's parts (BUILD_PLAN A7 landing composition, mockup: landing): product shot, how it works,
// feature rows beside real pictures, the templates strip, the features grid, the privacy promise, the questions and
// the closing call to action. Server components; every picture is a real screen of the app (e2e/capture.spec.ts →
// npm run images → public/landing/, public/designs/), drawn at its own size so nothing shifts while it loads.

/** A biodata page picture: 720 × 1019 (A4). */
export const PAGE_IMAGE = { width: 720, height: 1019 } as const;

const sectionTitle = "mt-2 text-[28px] leading-[1.15] font-bold tracking-tight text-balance text-ink sm:text-4xl";
const sectionLead = "mt-3 text-base text-pretty text-ink-3 sm:text-[17px]";

/** A centred section heading: eyebrow, title, lead. */
export function SectionHeading({ id, eyebrowKey, titleKey, leadKey }: { id?: string; eyebrowKey: AppKey; titleKey: AppKey; leadKey?: AppKey }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={eyebrow}>{t(eyebrowKey)}</p>
      <h2 id={id} className={sectionTitle}>
        {t(titleKey)}
      </h2>
      {leadKey ? <p className={sectionLead}>{t(leadKey)}</p> : null}
    </div>
  );
}

/**
 * The hero's product shot: the editor on a computer in a browser frame, with the phone preview in front of it. On
 * phones the computer screen would be too small to read, so only the phone is shown, larger.
 */
export function ProductShot() {
  return (
    <div className="relative mx-auto mt-12 max-w-5xl sm:mt-16">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-pop max-sm:hidden">
        <div aria-hidden className="flex items-center gap-2 border-b border-line bg-sunken px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="size-2.5 rounded-full bg-line-strong" />
          <span className="ml-2 truncate rounded-md bg-surface px-3 py-0.5 text-xs text-ink-3">free-wedding-biodata.vercel.app/editor</span>
        </div>
        <Image src="/landing/editor-desktop.webp" width={1800} height={1125} alt={t("home.shot.desktop")} priority sizes="(min-width: 1024px) 64rem, 100vw" className="block h-auto w-full" />
      </div>
      <div className="mx-auto w-64 overflow-hidden rounded-[2rem] border-[7px] border-stone-900 bg-stone-900 shadow-pop sm:absolute sm:-bottom-10 sm:-left-6 sm:w-[24%] sm:max-w-[15rem] lg:-left-14">
        <Image src="/landing/editor-phone.webp" width={600} height={1022} alt={t("home.shot.phone")} priority sizes="(min-width: 640px) 15rem, 16rem" className="block h-auto w-full rounded-[1.5rem]" />
      </div>
    </div>
  );
}

const STEPS: { id: string; icon: IconName }[] = [
  { id: "fill", icon: "edit" },
  { id: "photo", icon: "image" },
  { id: "design", icon: "layout" },
  { id: "download", icon: "share" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
      <div className={pageWidth}>
        <SectionHeading id="how-title" eyebrowKey="home.how.eyebrow" titleKey="home.how.title" leadKey="home.how.lead" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ id, icon }, i) => (
            <li key={id} className={`${card} p-5`}>
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-tile text-brand-ink ring-1 ring-brand/10 ring-inset">
                  <Icon name={icon} className="size-[18px]" />
                </span>
                <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-ink text-xs font-bold text-page">
                  {i + 1}
                </span>
              </div>
              <h3 className={`mt-4 ${cardTitle}`}>{t(`home.how.${id}.title` as AppKey)}</h3>
              <p className={`mt-1.5 ${cardText}`}>{t(`home.how.${id}.text` as AppKey)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A feature row: words with ticks on one side, a real picture on the other (`flip` puts the picture first on wide screens). */
export function FeatureRow({ id, prefix, points, flip = false, children, after }: { id?: string; prefix: string; points: number; flip?: boolean; children: ReactNode; after?: ReactNode }) {
  return (
    <div id={id} className="grid scroll-mt-20 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : undefined}>
        <p className={eyebrow}>{t(`${prefix}.eyebrow` as AppKey)}</p>
        <h3 className={sectionTitle}>{t(`${prefix}.title` as AppKey)}</h3>
        <p className={sectionLead}>{t(`${prefix}.text` as AppKey)}</p>
        {points ? (
          <ul className="mt-6 space-y-3">
            {Array.from({ length: points }, (_, i) => (
              <li key={i} className="flex gap-3 text-[15px] text-ink-2">
                <Icon name="check" className="mt-0.5 size-[18px] text-good" />
                {t(`${prefix}.${i + 1}` as AppKey)}
              </li>
            ))}
          </ul>
        ) : null}
        {after}
      </div>
      <div className={`rounded-2xl border border-line bg-gradient-to-br from-gold-soft/70 via-surface to-surface p-5 shadow-card sm:p-8 ${flip ? "lg:order-1" : ""}`}>{children}</div>
    </div>
  );
}

/** A biodata page picture with a soft shadow. */
export function PagePicture({ id, alt, className = "" }: { id: string; alt: string; className?: string }) {
  return (
    <Image
      src={`/designs/${id}.webp`}
      width={PAGE_IMAGE.width}
      height={PAGE_IMAGE.height}
      alt={alt}
      sizes="(min-width: 1024px) 24rem, 80vw"
      className={`block h-auto w-full rounded-[3px] shadow-[0_10px_30px_-10px_rgb(0_0_0/0.35)] ring-1 ring-black/5 ${className}`}
    />
  );
}

/** The ten document languages, each named in its own script, linking to its page (English is this one). */
export function LanguageChips() {
  const chip = "inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink-2 shadow-card transition-colors hover:text-ink pointer-coarse:min-h-11 pointer-coarse:items-center";
  return (
    <ul aria-label={t("home.languages.list")} className="mt-6 flex flex-wrap gap-2">
      <li>
        <span lang="en" className={chip}>
          English
        </span>
      </li>
      {LANGUAGE_PAGES.map((p) => (
        <li key={p.lang}>
          <a href={`/${p.lang}`} lang={p.lang} className={chip}>
            {p.native}
          </a>
        </li>
      ))}
    </ul>
  );
}

const FEATURES: { id: string; icon: IconName }[] = [
  { id: "fields", icon: "plus" },
  { id: "hide", icon: "eyeOff" },
  { id: "photo", icon: "image" },
  { id: "fit", icon: "type" },
  { id: "backup", icon: "backup" },
  { id: "offline", icon: "wifi" },
];

export function FeaturesGrid() {
  return (
    <section aria-labelledby="features-title" className="border-t border-line py-16 sm:py-24">
      <div className={pageWidth}>
        <SectionHeading id="features-title" eyebrowKey="home.features.eyebrow" titleKey="home.features.title" leadKey="home.features.lead" />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ id, icon }) => (
            <li key={id} className={`${card} p-5`}>
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-tile text-brand-ink ring-1 ring-brand/10 ring-inset">
                <Icon name={icon} className="size-[18px]" />
              </span>
              <h3 className={`mt-4 ${cardTitle}`}>{t(`home.features.${id}.title` as AppKey)}</h3>
              <p className={`mt-1.5 ${cardText}`}>{t(`home.features.${id}.text` as AppKey)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const COMPARISON = ["fields", "server", "name", "account", "later"] as const;

export function Privacy() {
  return (
    <section aria-labelledby="privacy-title" className="border-t border-line py-16 sm:py-24">
      <div className={`${pageWidth} grid items-center gap-10 lg:grid-cols-2 lg:gap-16`}>
        <div>
          <p className={eyebrow}>{t("home.privacy.eyebrow")}</p>
          <h2 id="privacy-title" className={sectionTitle}>
            {t("home.privacy.title")}
          </h2>
          <p className={sectionLead}>{t("home.privacy.text")}</p>
          <ul className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <li key={i} className="flex gap-3 text-[15px] text-ink-2">
                <Icon name="shield" className="mt-0.5 size-[18px] text-good" />
                {t(`home.privacy.${i}` as AppKey)}
              </li>
            ))}
          </ul>
          <a href="/privacy" className={`${button("secondary")} mt-7`}>
            <Icon name="lock" className="size-4" />
            {t("help.aside.privacy.action")}
          </a>
        </div>
        <div className={`${card} overflow-hidden`}>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("home.privacy.table")}</caption>
            <thead className="bg-sunken text-[11.5px] font-bold tracking-[0.08em] text-ink-3 uppercase">
              <tr>
                <td className="px-4 py-3 sm:px-5" />
                <th scope="col" className="px-3 py-3 font-bold">
                  {t("home.privacy.them")}
                </th>
                <th scope="col" className="px-3 py-3 font-bold text-ink sm:pr-5">
                  {t("home.privacy.us")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARISON.map((id) => (
                <tr key={id}>
                  <th scope="row" className="px-4 py-3.5 font-medium text-ink sm:px-5">
                    {t(`home.privacy.row.${id}` as AppKey)}
                  </th>
                  <td className="px-3 py-3.5 text-ink-3">{t(`home.privacy.row.${id}.them` as AppKey)}</td>
                  <td className="px-3 py-3.5 font-semibold text-good sm:pr-5">{t(`home.privacy.row.${id}.us` as AppKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** The questions, as disclosure rows (the same list is the page's FAQPage structured data). */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-line py-16 sm:py-24">
      <div className={pageWidth}>
        <SectionHeading id="faq-title" eyebrowKey="home.faq.eyebrow" titleKey="home.faq.title" />
        <div className="mx-auto mt-10 grid max-w-5xl items-start gap-3 md:grid-cols-2">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className={`${card} group`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 text-[15px] font-semibold text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
                {question}
                <Icon name="chevronDown" className="size-4 text-ink-3 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <p className="-mt-1 px-4 pb-4 text-[14.5px] leading-relaxed text-pretty text-ink-3 sm:px-5">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClosingCall() {
  return (
    <section className="border-t border-line py-16 sm:py-24">
      <div className={pageWidth}>
        <div className="relative overflow-hidden rounded-3xl bg-[radial-gradient(80%_120%_at_50%_0%,#a3243a,#7d1a27_55%,#5e1320)] px-6 py-14 text-center shadow-pop sm:px-12 sm:py-16">
          <h2 className="mx-auto max-w-2xl text-[28px] leading-tight font-bold tracking-tight text-balance text-white sm:text-4xl">{t("home.cta.title")}</h2>
          <p className="mt-3 text-[17px] text-white/80">{t("home.cta.text")}</p>
          <a href="/editor?new=1" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-[#fff6e5] px-6 text-base font-semibold text-[#7d1a27] shadow-card transition-colors outline-none hover:bg-white focus-visible:ring-[3px] focus-visible:ring-white/70">
            <Icon name="edit" className="size-[18px]" />
            {t("header.create")}
          </a>
        </div>
      </div>
    </section>
  );
}
