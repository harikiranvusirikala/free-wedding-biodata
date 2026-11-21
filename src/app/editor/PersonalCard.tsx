"use client";

import { setFieldValue } from "@/biodata/edits";
import type { BiodataProfile, Field, FieldsSection } from "@/biodata/types";
import { card, cardHeader, cardRows, cardTitle } from "@/components/ui/card";
import { field as fieldClass } from "@/components/ui/field";
import { t, type AppKey } from "@/lib/i18n";
import en from "@/i18n/app/en.json";

// Step 1.3's form, just enough to type into and see saved: the first Personal details fields as plain text boxes.
// The full editor (every section, field types, rename, hide, move) is Phase 2; these rows already follow its card
// layout (mockup: editor), label beside the box from tablets up and above it on phones.

/** The Personal fields shown for now; Date of birth is typed as text until Step 2.1 brings the date input. */
const SHOWN = new Set(["fullName", "dateOfBirth", "nationality", "currentCity", "nativePlace"]);

const PLACEHOLDERS: Partial<Record<string, AppKey>> = { dateOfBirth: "editor.placeholder.dateOfBirth" };

/** A field's label in the editor: the user's own, else the English label for its key (document labels come in 3.2). */
export function fieldLabel(field: Field): string {
  if (field.label?.trim()) return field.label;
  const key = `field.${field.key}`;
  return Object.hasOwn(en, key) ? t(key as AppKey) : "";
}

export function PersonalCard({ profile, onChange, readOnly }: { profile: BiodataProfile; onChange: (next: BiodataProfile) => void; readOnly: boolean }) {
  const section = profile.sections.find((s): s is FieldsSection => s.kind === "fields" && s.key === "personal");
  if (!section) return null;
  const fields = section.fields.filter((f) => f.key !== undefined && SHOWN.has(f.key));
  const titleId = `section-${section.id}`;

  return (
    <section aria-labelledby={titleId} className={card}>
      <div className={cardHeader}>
        <h2 id={titleId} className={cardTitle}>
          {section.title?.trim() || t("editor.personal")}
        </h2>
      </div>
      <div className={cardRows}>
        {fields.map((f) => {
          const id = `field-${f.id}`;
          const placeholder = f.key ? PLACEHOLDERS[f.key] : undefined;
          return (
            <div key={f.id} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-4 sm:px-5">
              <label htmlFor={id} className="text-sm font-medium text-ink-2">
                {fieldLabel(f)}
              </label>
              <input
                id={id}
                className={fieldClass}
                value={f.value}
                placeholder={placeholder ? t(placeholder) : undefined}
                readOnly={readOnly}
                autoComplete="off"
                onChange={(event) => onChange(setFieldValue(profile, f.id, event.target.value))}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
