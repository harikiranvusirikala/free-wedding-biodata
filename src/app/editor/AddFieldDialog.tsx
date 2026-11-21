"use client";

import { useId, useState } from "react";
import { DEFAULT_SECTIONS, TRADITION_FIELD_SETS, newUuid, type FieldKey } from "@/biodata/defaults";
import { CUSTOM_FIELD_TYPES, addCatalogField, addCustomField, missingCatalogKeys, sectionDefOf, type CustomFieldType } from "@/biodata/edits";
import type { BiodataProfile, FieldsSection } from "@/biodata/types";
import { button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/Dialog";
import { field as fieldClass, fieldHint, fieldLabel as fieldLabelClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import type { Edit } from "./FieldRow";
import { fieldLabel, sectionTitle } from "./labels";

// "Add a field" (BUILD_PLAN Step 2.2, VISION §6): ready-made fields from the catalogue that aren't in the draft
// (this section's usual ones first, its tradition fields included; then usual fields of other sections that were
// removed), each added with one tap; or the user's own field, a label and one of six types. Labels the user types
// print exactly as typed.

/** Pill buttons for the ready-made fields. */
const PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink-2 shadow-card transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand-ink outline-none focus-visible:ring-[3px] focus-visible:ring-ring pointer-coarse:min-h-11 pointer-coarse:px-3.5 pointer-coarse:text-sm";

/** The section's own usual keys (its default fields and its tradition fields), then the rest of the defaults. */
function suggestionsFor(profile: BiodataProfile, section: FieldsSection): { usual: FieldKey[]; other: FieldKey[] } {
  const missing = new Set(missingCatalogKeys(profile));
  const def = sectionDefOf(section);
  const own: FieldKey[] = [
    ...(def?.kind === "fields" ? def.fields : []),
    ...Object.values(TRADITION_FIELD_SETS)
      .flat()
      .filter((entry) => entry.section === section.key)
      .map((entry) => entry.field),
  ];
  const usual = own.filter((key) => missing.has(key));
  const defaults = DEFAULT_SECTIONS.flatMap((d) => (d.kind === "fields" ? d.fields : []));
  const other = defaults.filter((key) => missing.has(key) && !own.includes(key));
  return { usual, other };
}

export function AddFieldDialog({
  open,
  section,
  profile,
  edit,
  onClose,
  onAdded,
}: {
  open: boolean;
  section?: FieldsSection;
  profile: BiodataProfile;
  edit: Edit;
  onClose: () => void;
  /** The new field's id, to focus its input. */
  onAdded: (fieldId: string) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  const typeName = useId();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLabel("");
      setType("text");
    }
  }

  const { usual, other } = section ? suggestionsFor(profile, section) : { usual: [], other: [] };

  function addKey(key: FieldKey) {
    if (!section) return;
    const id = newUuid();
    const sectionId = section.id;
    edit((p) => addCatalogField(p, sectionId, key, () => id));
    onClose();
    onAdded(id);
  }

  function addCustom() {
    if (!section || !label.trim()) return;
    const id = newUuid();
    const sectionId = section.id;
    const typed = label.trim();
    edit((p) => addCustomField(p, sectionId, { label: typed, type }, () => id));
    onClose();
    onAdded(id);
  }

  const group = (title: string, keys: FieldKey[], testId: string) =>
    keys.length > 0 && (
      <div role="group" aria-label={title} data-testid={testId}>
        <h3 className="text-[12px] font-semibold tracking-[0.06em] text-ink-3 uppercase">{title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {keys.map((key) => (
            <button key={key} type="button" className={PILL} onClick={() => addKey(key)}>
              <Icon name="plus" className="size-3.5" />
              {fieldLabel({ key })}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={section ? t("manage.addField.title", { section: sectionTitle(section) }) : ""}
      description={t("manage.addField.description")}
    >
      {(usual.length > 0 || other.length > 0) && (
        <div className="mb-5 space-y-4 border-b border-line pb-5">
          {group(t("manage.addField.suggested"), usual, "suggested-fields")}
          {group(t("manage.addField.other"), other, "other-fields")}
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          addCustom();
        }}
      >
        <h3 className="mb-3 text-[15px] font-semibold tracking-tight">{t("manage.addField.custom")}</h3>
        <label htmlFor={labelId} className={fieldLabelClass}>
          {t("manage.addField.label")}
        </label>
        <input
          id={labelId}
          className={`mt-1.5 ${fieldClass}`}
          value={label}
          placeholder={t("manage.addField.labelPlaceholder")}
          onChange={(event) => setLabel(event.target.value)}
          autoComplete="off"
          autoCapitalize="sentences"
          aria-describedby={hintId}
        />
        <p id={hintId} className={`mt-1.5 ${fieldHint}`}>
          {t("manage.addField.labelHint")}
        </p>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-ink">{t("manage.addField.type")}</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {CUSTOM_FIELD_TYPES.map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line-strong bg-surface px-3 py-2.5 transition-colors hover:bg-sunken has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:ring-[3px] has-focus-visible:ring-ring"
              >
                <input type="radio" name={typeName} value={value} checked={type === value} onChange={() => setType(value)} className="mt-0.5 size-4 shrink-0 accent-brand" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{t(`manage.type.${value}`)}</span>
                  <span className="block text-[12.5px] leading-snug text-ink-3">{t(`manage.typeHint.${value}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <DialogActions>
          <button type="button" className={button("secondary")} onClick={onClose}>
            {t("ui.cancel")}
          </button>
          <button type="submit" className={button("primary")} disabled={!label.trim()}>
            <Icon name="plus" className="size-4" />
            {t("manage.addField.add")}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
