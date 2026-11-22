"use client";

import { TRADITIONS, TRADITION_FIELD_SETS, newUuid, type Tradition } from "@/biodata/defaults";
import { addTraditionFields, removeFields, traditionFieldsToAdd } from "@/biodata/edits";
import type { BiodataProfile } from "@/biodata/types";
import { focusRing } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { t, type AppKey } from "@/lib/i18n";
import { fieldLabel } from "./labels";
import { useManage } from "./ManageProvider";

// "Add details common in your family" (BUILD_PLAN Step 2.0, VISION D32, D43): one-tap chips inside the Religion
// card (the Horoscope card when Religion is gone). A chip adds its tradition's fields that aren't in the draft yet
// (TRADITION_FIELD_SETS), empty, at the end of their sections, with Undo in the toast; a second tap adds nothing.
// Never shown pre-chosen, never inferred from the Religion value. A chip whose fields are all present shows a tick.

/** Joins labels the English way: "A", "A and B", "A, B and C". */
function listOf(labels: string[]): string {
  return labels.length < 2 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/** The chips' card, or nothing: shown in the first of Religion and Horoscope that the draft has. */
export function showsTraditions(profile: Pick<BiodataProfile, "sections">, sectionId: string): boolean {
  const host = profile.sections.find((s) => s.kind === "fields" && s.key === "religion") ?? profile.sections.find((s) => s.kind === "fields" && s.key === "horoscope");
  return host?.id === sectionId;
}

/** The labels of a chip's fields (for "already in your biodata"). */
const setLabels = (tradition: Tradition) => [...new Set(TRADITION_FIELD_SETS[tradition].map((entry) => fieldLabel({ key: entry.field })))];

/** The chips whose fields are all in the draft, as one string (stable while nothing changes, for memoised cards). */
export function doneTraditions(profile: Pick<BiodataProfile, "sections">): string {
  return TRADITIONS.filter((tradition) => traditionFieldsToAdd(profile, tradition).length === 0).join(" ");
}

export function TraditionChips({ done: doneList, readOnly }: { done: string; readOnly: boolean }) {
  const manage = useManage();

  function add(tradition: Tradition) {
    const before = manage.current();
    const adds = traditionFieldsToAdd(before, tradition);
    if (!adds.length) {
      manage.notify(t("traditions.already", { labels: listOf(setLabels(tradition)) }));
      return;
    }
    const ids: string[] = [];
    manage.edit((p) =>
      addTraditionFields(p, tradition, () => {
        const id = newUuid();
        ids.push(id);
        return id;
      }),
    );
    const labels = listOf(adds.map((a) => fieldLabel({ key: a.key })));
    // The first new field, in the middle of the screen (clear of the toast at the bottom).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const first = document.getElementById(`field-${ids[0]}`);
        first?.focus({ preventScroll: true });
        first?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }),
    );
    manage.notify(t("traditions.added", { labels }), () => {
      manage.edit((p) => removeFields(p, ids));
      manage.notify(t("traditions.removed"));
    });
  }

  return (
    <div className="border-b border-line bg-sunken/40 px-4 py-3 sm:px-5" data-testid="tradition-chips">
      <p className="text-[13.5px] font-medium text-ink-2">{t("traditions.title")}</p>
      <p className="mt-0.5 text-[13px] text-pretty text-ink-3">{t("traditions.text")}</p>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {TRADITIONS.map((tradition) => {
          const done = doneList.split(" ").includes(tradition);
          const name = t(`traditions.${tradition}` as AppKey);
          return (
            <li key={tradition}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => add(tradition)}
                data-tradition={tradition}
                aria-label={done ? `${name}, ${t("traditions.inDraft")}` : name}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-55 pointer-coarse:min-h-11 pointer-coarse:px-3.5 pointer-coarse:text-sm ${done ? "border-good/30 bg-good-soft text-good" : "border-line-strong bg-surface text-ink-2 shadow-card hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink"} ${focusRing}`}
              >
                <Icon name={done ? "check" : "plus"} className="size-3.5" />
                {name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

