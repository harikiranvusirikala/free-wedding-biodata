"use client";

import { memo } from "react";
import { sectionCompletion } from "@/biodata/completion";
import type { DateFormat, HeightFormat, Section } from "@/biodata/types";
import { button } from "@/components/ui/button";
import { accentCard, accentTile, card, cardRows, cardTitle, iconTile } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { FieldRow, MemberRow, type Edit } from "./FieldRow";
import { SECTION_ICONS, sectionTitle, useLabelStyle } from "./labels";
import { SectionMenu } from "./ManageMenus";
import { useManage } from "./ManageProvider";
import { TraditionChips } from "./TraditionChips";

// A section of the biodata as a card (mockup: editor): its title, how much is filled ("3 of 9 filled",
// informational only, §5), its ⋯ menu (rename, move, hide, restore default fields, remove: Step 2.2), a row per
// field, or per family member, in order, and "Add a field" (or "Add a family member", Step 2.3) at the foot.
// Memoised on the section object: edits share unchanged sections (edits.ts), so typing re-renders only the card
// being typed in.

export const sectionAnchor = (section: Pick<Section, "id">) => `section-${section.id}`;

export const SectionCard = memo(function SectionCard({
  section,
  edit,
  readOnly,
  dateFormat,
  heightFormat,
  traditions,
}: {
  section: Section;
  edit: Edit;
  readOnly: boolean;
  dateFormat: DateFormat;
  heightFormat: HeightFormat;
  /** Step 2.0: this card holds the tradition chips; the chips already fully added (doneTraditions). */
  traditions?: string;
}) {
  const manage = useManage();
  const labelStyle = useLabelStyle();
  const anchor = sectionAnchor(section);
  const titleId = `${anchor}-title`;
  const { filled, total } = sectionCompletion(section);
  const empty = section.kind === "fields" ? section.fields.length === 0 : section.members.length === 0;
  // In Personal details (the Simple form's host, D50) the chips follow the rows, so the card opens with Name.
  const chipsAtEnd = section.key === "personal";
  return (
    <section
      id={anchor}
      aria-labelledby={titleId}
      data-section={section.key ?? section.id}
      data-hidden={section.visible ? undefined : ""}
      className={`${section.visible ? accentCard : card} scroll-mt-20 max-lg:scroll-mt-[7.5rem]`}
    >
      <div className="flex items-center gap-2 border-b border-line py-2 pr-2 pl-4 sm:gap-3 sm:pr-3 sm:pl-5">
        <span aria-hidden className={`${iconTile} ${accentTile} ${section.visible ? "" : "opacity-60 grayscale"}`}>
          <Icon name={(section.key && SECTION_ICONS[section.key]) || "list"} className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5">
          <h2 id={titleId} tabIndex={-1} className={`${cardTitle} min-w-0 break-words outline-none ${section.visible ? "" : "text-ink-3!"}`}>
            {sectionTitle(section, labelStyle)}
          </h2>
          {!section.visible && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-sunken px-2 py-0.5 text-[11.5px] font-semibold text-ink-3 ring-1 ring-line-strong ring-inset"
            >
              <Icon name="eyeOff" className="size-3.5" />
              {t("editor.hidden")}
            </span>
          )}
        </div>
        {total > 0 && (
          <p className={`shrink-0 text-[13px] tabular-nums ${filled === total ? "text-good" : "text-ink-3"}`} data-testid="section-completion">
            {t("editor.completion", { filled, total })}
          </p>
        )}
        <SectionMenu section={section} readOnly={readOnly} />
      </div>
      {traditions !== undefined && !chipsAtEnd && <TraditionChips done={traditions} readOnly={readOnly} />}
      {!section.visible && <p className="border-b border-line bg-sunken/60 px-4 py-2 text-[13px] text-pretty text-ink-3 sm:px-5">{t("manage.section.hiddenTip")}</p>}
      {empty ? (
        <p className="px-4 py-5 text-sm text-pretty text-ink-3 sm:px-5" data-testid="section-empty">
          {t(section.kind === "fields" ? "manage.section.empty" : section.key === "references" ? "manage.section.emptyReferences" : "manage.section.emptyList")}
        </p>
      ) : (
        <div className={cardRows}>
          {section.kind === "fields"
            ? section.fields.map((field) => (
                <FieldRow key={field.id} field={field} edit={edit} readOnly={readOnly} dateFormat={dateFormat} heightFormat={heightFormat} />
              ))
            : section.members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  edit={edit}
                  readOnly={readOnly}
                  placeholder={t(section.key === "references" ? "member.placeholder.reference" : "member.placeholder.family")}
                />
              ))}
        </div>
      )}
      {traditions !== undefined && chipsAtEnd && <TraditionChips done={traditions} readOnly={readOnly} atEnd />}
      <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border-t border-line bg-sunken/50 px-4 py-3 sm:px-5">
        <button
          type="button"
          className={button("secondary", "sm")}
          disabled={readOnly}
          onClick={() => manage.open(section.kind === "fields" ? { kind: "addField", sectionId: section.id } : { kind: "addMember", sectionId: section.id })}
        >
          <Icon name="plus" className="size-4" />
          {t(section.kind === "fields" ? "manage.addField" : section.key === "references" ? "member.addReference" : "member.add")}
        </button>
      </div>
    </section>
  );
});
