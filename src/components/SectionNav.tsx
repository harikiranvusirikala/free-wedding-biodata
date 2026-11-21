"use client";

import { useEffect, useState } from "react";
import { focusRing } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export type Section = { id: string; label: string };

/** How far below the top of the window a section's heading counts as "being read" (under the sticky header). */
const READING_LINE = 120;

/**
 * A content page's "On this page" list (BUILD_PLAN A7, mockups: help, privacy). From laptops up it is a sticky
 * column that marks the section being read; below that, a row of chips under the title.
 */
export function SectionNav({ sections, variant }: { sections: readonly Section[]; variant: "column" | "chips" }) {
  const [active, setActive] = useState(sections[0]?.id);
  const ids = sections.map((s) => s.id).join(" ");

  useEffect(() => {
    if (variant !== "column") return;
    const list = ids.split(" ");
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = list[0];
      for (const id of list) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= READING_LINE) current = id;
      }
      // Scrolled to the bottom: the last section may be too short to reach the line.
      const root = document.documentElement;
      if (scrollY > 0 && innerHeight + scrollY >= root.scrollHeight - 2) current = list[list.length - 1];
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
    };
  }, [ids, variant]);

  if (variant === "chips") {
    return (
      <nav aria-label={t("ui.onThisPage")}>
        <ul className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`flex h-8 items-center rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 shadow-card hover:bg-sunken hover:text-ink pointer-coarse:min-h-11 ${focusRing}`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={t("ui.onThisPage")} className="sticky top-24">
      <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{t("ui.onThisPage")}</p>
      <ul className="grid gap-0.5">
        {sections.map((s) => {
          const current = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={current ? "location" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm leading-snug font-medium transition-colors ${focusRing} ${current ? "bg-sunken text-ink" : "text-ink-3 hover:bg-sunken/60 hover:text-ink"}`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
