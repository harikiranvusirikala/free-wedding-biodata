"use client";

import { memo } from "react";
import { sectionCompletion } from "@/biodata/completion";
import type { DateFormat, HeightFormat, Section } from "@/biodata/types";
import { card, cardRows, cardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { FieldRow, MemberRow, type Edit } from "./FieldRow";
import { sectionTitle } from "./labels";

// A section of the biodata as a card (mockup: editor): its title, how much is filled ("3 of 9 filled",
// informational only, §5) and a row per field, or per family member, in order. Memoised on the section object:
// edits share unchanged sections (edits.ts), so typing re-renders only the card being typed in.

export const sectionAnchor = (section: Pick<Section, "id">) => `section-${section.id}`;

export const SectionCard = memo(function SectionCard({
  section,
  edit,
  readOnly,
  dateFormat,
  heightFormat,
}: {
  section: Section;
  edit: Edit;
  readOnly: boolean;
  dateFormat: DateFormat;
  heightFormat: HeightFormat;
}) {
  const anchor = sectionAnchor(section);
  const titleId = `${anchor}-title`;
  const { filled, total } = sectionCompletion(section);
  return (
    <section id={anchor} aria-labelledby={titleId} data-section={section.key ?? section.id} className={`${card} scroll-mt-20 max-lg:scroll-mt-[7.5rem]`}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <h2 id={titleId} tabIndex={-1} className={`${cardTitle} min-w-0 flex-1 break-words outline-none`}>
          {sectionTitle(section)}
        </h2>
        {total > 0 && (
          <p className={`shrink-0 text-[13px] tabular-nums ${filled === total ? "text-good" : "text-ink-3"}`} data-testid="section-completion">
            {t("editor.completion", { filled, total })}
          </p>
        )}
      </div>
      <div className={cardRows}>
        {section.kind === "fields"
          ? section.fields.map((field) => (
              <FieldRow key={field.id} field={field} edit={edit} readOnly={readOnly} dateFormat={dateFormat} heightFormat={heightFormat} />
            ))
          : section.members.map((member) => <MemberRow key={member.id} member={member} edit={edit} readOnly={readOnly} />)}
      </div>
    </section>
  );
});
