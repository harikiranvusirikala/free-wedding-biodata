"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { completionState, profileCompletion, sectionCompletion } from "@/biodata/completion";
import type { LabelStyle, Section } from "@/biodata/types";
import { focusRing } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t, type AppKey } from "@/lib/i18n";
import en from "@/i18n/app/en.json";
import { SECTION_ICONS, sectionTitle, useLabelStyle } from "./labels";
import { useManage } from "./ManageProvider";
import { sectionAnchor } from "./SectionCard";
import { PhotoIcon } from "@/components/photo/icons";
import { PHOTO_ID } from "./PhotoCard";
import { PHOTO_PAGES_ID } from "./PhotoPagesCard";
import { TOP_ID } from "./TopCard";

// Moving around the form (BUILD_PLAN A7 Editor rule, mockups: editor, editor-phone). Desktop: the section rail,
// each section with its completion dot and count, the one being read highlighted as you scroll; a click scrolls
// to its card. 1024–1279 px: the same rail as icons. Tablets and phones: a sticky row of chips under the header.
// The form itself is one continuous scroll of cards.

const hasKey = (key: string): key is AppKey => Object.hasOwn(en, key);

/** The short name on a phone chip ("Personal" for Personal Details); a renamed or custom section's own title. */
function chipLabel(section: Section, style: LabelStyle): string {
  const key = `editor.chip.${section.key}`;
  return !section.title?.trim() && section.key && hasKey(key) ? t(key) : sectionTitle(section, style);
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The section being read: the last card whose top has passed a line a little below the header (the last card
 * once the page is scrolled to the end). `jump` scrolls a card into view, focuses its title for keyboard and
 * screen-reader users, and holds the highlight on it while the page scrolls there.
 */
export function useCurrentSection(ids: readonly string[]) {
  const [current, setCurrent] = useState<string | undefined>(ids[0]);
  const heldUntil = useRef(0);
  const key = ids.join(" ");

  useEffect(() => {
    const list = key ? key.split(" ") : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (performance.now() < heldUntil.current) return;
      const line = Math.min(window.innerHeight * 0.3, 260);
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      let found = list[0];
      for (const id of list) {
        const el = document.getElementById(sectionAnchor({ id }));
        if (el && el.getBoundingClientRect().top <= line) found = id;
      }
      if (atEnd && window.scrollY > 0) found = list[list.length - 1];
      setCurrent(found);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(measure);
    };
    const release = () => {
      heldUntil.current = 0;
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("scrollend", release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scrollend", release);
    };
  }, [key]);

  const jump = useCallback((id: string) => {
    const card = document.getElementById(sectionAnchor({ id }));
    if (!card) return;
    setCurrent(id);
    heldUntil.current = performance.now() + 1200;
    card.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    card.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, []);

  return { current, jump };
}

interface NavProps {
  sections: readonly Section[];
  current?: string;
  onJump: (id: string) => void;
}

/** "Add a section" at the end of the rail (mockup: editor), the same dialog as the button after the last card. */
function RailAdd({ disabled }: { disabled: boolean }) {
  const manage = useManage();
  return (
    <button
      type="button"
      disabled={disabled}
      title={t("manage.addSection")}
      onClick={() => manage.open({ kind: "addSection" })}
      className={`mt-1 flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-soft disabled:opacity-55 max-xl:justify-center ${focusRing}`}
    >
      <Icon name="plus" className="size-[18px] xl:-mx-px" />
      <span className="max-xl:sr-only">{t("manage.addSection")}</span>
    </button>
  );
}

function onLink(event: React.MouseEvent, id: string, onJump: (id: string) => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onJump(id);
}

/** A section's completion as a dot: a dashed ring (nothing yet), a part-filled ring, or a tick (all filled). */
function CompletionDot({ section, className = "" }: { section: Section; className?: string }) {
  const state = completionState(sectionCompletion(section));
  if (state === "complete") {
    return (
      <span aria-hidden className={`flex size-4 shrink-0 items-center justify-center rounded-full bg-good-soft text-good ${className}`}>
        <Icon name="check" className="size-2.5 [stroke-width:3]" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={`size-4 shrink-0 rounded-full border-[1.5px] ${state === "partial" ? "border-gold bg-[conic-gradient(var(--gold)_0_50%,transparent_50%)]" : "border-dashed border-ink-3/60"} ${className}`}
    />
  );
}

/**
 * "Your biodata is 72% filled" (Step 2.3) at the head of the rail, with a bar; just the number on the icon rail.
 * Informational only (§5): hidden lines and sections don't count, and nothing is ever required.
 */
function OverallCompletion({ sections }: { sections: readonly Section[] }) {
  const { filled, total, percent } = profileCompletion({ sections: [...sections] });
  const detail = t("editor.overallDetail", { filled, total });
  return (
    <div className="mb-3 px-1 xl:px-0" data-testid="overall-completion" title={detail}>
      <div className="rounded-xl border border-line bg-page px-3 py-2.5 max-xl:hidden dark:bg-sunken/60">
        <p className="text-[13px] leading-snug font-semibold text-ink">{t("editor.overall", { percent })}</p>
        <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${percent === 100 ? "bg-good" : "bg-gold"}`} style={{ width: `${percent}%` }} />
        </div>
        <p className="sr-only">{detail}</p>
      </div>
      <p aria-hidden className="text-center text-xs font-semibold tabular-nums text-ink-2 xl:hidden">{t("editor.overallShort", { percent })}</p>
      <p className="sr-only xl:hidden">{t("editor.overall", { percent })}</p>
    </div>
  );
}

/** The rail beside the form: names with dots and counts at 1280 px and up, icons with dots at 1024–1279. */
export function SectionRail({ sections, hasPhoto, hasMorePhotos, current, onJump, canAdd = true }: NavProps & { hasPhoto: boolean; hasMorePhotos: boolean; canAdd?: boolean }) {
  const labelStyle = useLabelStyle();
  return (
    <nav aria-label={t("editor.sections")} className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto px-2 py-4 xl:px-3" data-testid="section-rail">
      <OverallCompletion sections={sections} />
      <h2 className="px-2.5 pb-2 text-[11.5px] font-bold tracking-[0.08em] text-ink-3 uppercase max-xl:sr-only">{t("editor.sections")}</h2>
      <ul className="space-y-0.5">
        {/* Step 2.0: the top of the biodata (symbol, line, title) comes first. */}
        <li>
          <a
            href={`#${sectionAnchor({ id: TOP_ID })}`}
            aria-current={current === TOP_ID ? "location" : undefined}
            title={t("top.title")}
            onClick={(event) => onLink(event, TOP_ID, onJump)}
            className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-colors max-xl:justify-center ${current === TOP_ID ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"} ${focusRing}`}
          >
            <Icon name="diya" className="size-4 shrink-0 max-xl:size-5" />
            <span className="line-clamp-2 min-w-0 flex-1 break-words max-xl:sr-only">{t("top.title")}</span>
          </a>
        </li>
        {/* Step 3.1: the photo, ticked once there is one. */}
        <li>
          <a
            href={`#${sectionAnchor({ id: PHOTO_ID })}`}
            aria-current={current === PHOTO_ID ? "location" : undefined}
            title={t("photo.card.title")}
            onClick={(event) => onLink(event, PHOTO_ID, onJump)}
            className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-colors max-xl:justify-center ${current === PHOTO_ID ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"} ${focusRing}`}
          >
            <PhotoIcon name="camera" className="size-4 shrink-0 max-xl:size-5" />
            <span className="line-clamp-2 min-w-0 flex-1 break-words max-xl:sr-only">{t("photo.card.title")}</span>
            {hasPhoto && (
              <span className="shrink-0 max-xl:hidden" data-testid="rail-photo-done">
                <Icon name="check" className="size-4 text-good" />
                <span className="sr-only">, {t("photo.card.added")}</span>
              </span>
            )}
          </a>
        </li>
        {/* Step 4.2b: more photos (extra pages and the horoscope chart), ticked once something is added. */}
        <li>
          <a
            href={`#${sectionAnchor({ id: PHOTO_PAGES_ID })}`}
            aria-current={current === PHOTO_PAGES_ID ? "location" : undefined}
            title={t("pages.card.title")}
            onClick={(event) => onLink(event, PHOTO_PAGES_ID, onJump)}
            className={`flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-colors max-xl:justify-center ${current === PHOTO_PAGES_ID ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"} ${focusRing}`}
          >
            <PhotoIcon name="gallery" className="size-4 shrink-0 max-xl:size-5" />
            <span className="line-clamp-2 min-w-0 flex-1 break-words max-xl:sr-only">{t("pages.card.title")}</span>
            {hasMorePhotos && (
              <span className="shrink-0 max-xl:hidden" data-testid="rail-pages-done">
                <Icon name="check" className="size-4 text-good" />
                <span className="sr-only">, {t("pages.card.added")}</span>
              </span>
            )}
          </a>
        </li>
        {sections.map((section) => {
          const on = section.id === current;
          const title = sectionTitle(section, labelStyle);
          const { filled, total } = sectionCompletion(section);
          const progress = t("editor.completion", { filled, total });
          return (
            <li key={section.id}>
              <a
                href={`#${sectionAnchor(section)}`}
                aria-current={on ? "location" : undefined}
                title={`${title} · ${progress}`}
                onClick={(event) => onLink(event, section.id, onJump)}
                className={`group relative flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm leading-snug transition-colors max-xl:justify-center ${on ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"} ${focusRing}`}
              >
                <CompletionDot section={section} className="max-xl:hidden" />
                <span className="relative xl:hidden">
                  <Icon name={(section.key && SECTION_ICONS[section.key]) || "list"} className="size-5" />
                  <CompletionDot section={section} className="absolute -right-2 -bottom-1.5 scale-75 ring-2 ring-surface" />
                </span>
                <span className={`line-clamp-2 min-w-0 flex-1 break-words max-xl:sr-only ${section.visible ? "" : "opacity-60"}`}>{title}</span>
                {!section.visible && (
                  <>
                    <Icon name="eyeOff" className="size-4 shrink-0 text-ink-3 max-xl:hidden" />
                    <span className="sr-only">, {t("editor.hidden")}</span>
                  </>
                )}
                {total > 0 && (
                  <span className={`shrink-0 text-xs font-medium tabular-nums max-xl:hidden ${on ? "text-brand-ink/80" : "text-ink-3"}`}>
                    <span aria-hidden>{t("editor.completionShort", { filled, total })}</span>
                  </span>
                )}
                <span className="sr-only">, {progress}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <RailAdd disabled={!canAdd} />
    </nav>
  );
}

/** Tablets and phones: a sticky, sideways-scrolling row of chips; the current one is kept in view. */
export function SectionJump({ sections, current, onJump }: NavProps) {
  const labelStyle = useLabelStyle();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>("[aria-current]");
    if (!list || !chip || list.offsetParent === null) return;
    const left = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
    list.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [current]);

  return (
    <nav aria-label={t("editor.jump")} className="border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85" data-testid="section-jump">
      <ul ref={listRef} className="flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {[{ id: TOP_ID, label: t("editor.chip.top") }, { id: PHOTO_ID, label: t("editor.chip.photo") }, { id: PHOTO_PAGES_ID, label: t("editor.chip.photoPages") }, ...sections.map((section) => ({ id: section.id, label: chipLabel(section, labelStyle) }))].map(({ id, label }) => {
          const on = id === current;
          return (
            <li key={id} className="shrink-0">
              <a
                href={`#${sectionAnchor({ id })}`}
                aria-current={on ? "location" : undefined}
                onClick={(event) => onLink(event, id, onJump)}
                className={`group flex h-11 items-center rounded-full outline-none`}
              >
                <span
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors group-focus-visible:ring-[3px] group-focus-visible:ring-ring ${on ? "border-ink bg-ink text-page" : "border-line-strong bg-surface text-ink-2 hover:bg-sunken"}`}
                >
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
