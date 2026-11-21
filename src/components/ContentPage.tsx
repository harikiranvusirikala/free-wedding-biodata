import type { ReactNode } from "react";
import { SectionNav, type Section } from "@/components/SectionNav";
import { card, cardText, cardTitle } from "@/components/ui/card";
import { contentTitle, eyebrow as eyebrowClass, lead as leadClass, pageWidth, prose, sectionTitle } from "@/components/ui/page";

/**
 * A content page (/help, /privacy) in BUILD_PLAN A7's three columns: the section list, the text, and an aside
 * of cards with quick actions. The aside moves under the text below 1280 px, and everything is one column of
 * the full width below 1024 px, where the section list becomes chips under the title. The text never grows
 * past 768 px, a comfortable line.
 */
export function ContentPage(props: { eyebrow: string; title: string; lead: ReactNode; sections: readonly Section[]; aside: ReactNode; children: ReactNode }) {
  const { eyebrow, title, lead, sections, aside, children } = props;
  return (
    <div className={`${pageWidth} grid gap-x-10 gap-y-12 pt-10 pb-20 sm:pt-12 lg:grid-cols-[12rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_17.5rem]`}>
      <div className="hidden lg:row-span-2 lg:block">
        <SectionNav sections={sections} variant="column" />
      </div>

      <div className="min-w-0 lg:max-w-3xl">
        <header id="overview" className="scroll-mt-24">
          <p className={eyebrowClass}>{eyebrow}</p>
          <h1 className={`mt-2.5 ${contentTitle}`}>{title}</h1>
          <div className={`mt-4 ${leadClass}`}>{lead}</div>
          <div className="mt-6 lg:hidden">
            <SectionNav sections={sections} variant="chips" />
          </div>
        </header>
        <div className="mt-10 space-y-11">{children}</div>
      </div>

      <aside className="min-w-0 lg:col-start-2 lg:max-w-3xl xl:col-start-3 xl:row-start-1 xl:max-w-none">
        <div className="grid gap-3.5 xl:sticky xl:top-24">{aside}</div>
      </aside>
    </div>
  );
}

/** One section of a content page: its heading (a target for the section list) and its content. */
export function ContentSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className={sectionTitle}>
        {title}
      </h2>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** Paragraphs in a content section. */
export function Prose({ children }: { children: ReactNode }) {
  return <div className={prose}>{children}</div>;
}

/**
 * A card in a content page's aside: a title, a sentence and one button. In the narrow aside column the button
 * fills the card's width; under the text (tablets, small laptops) the card is a row with the button on the right.
 */
export function AsideCard({ title, text, children, className = card }: { title: string; text?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={`${className} flex flex-col gap-3.5 p-[18px] sm:flex-row sm:items-center sm:gap-6 xl:flex-col xl:items-stretch xl:gap-3.5`}>
      <div className="min-w-0 flex-1">
        <h2 className={`${cardTitle} text-[15px]`}>{title}</h2>
        {text && <p className={`mt-1 ${cardText} text-[13.5px]`}>{text}</p>}
      </div>
      {children && <div className="shrink-0 [&>a]:w-full sm:[&>a]:w-auto xl:[&>a]:w-full">{children}</div>}
    </div>
  );
}
