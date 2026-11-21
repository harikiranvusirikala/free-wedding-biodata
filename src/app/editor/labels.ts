import { FIELD_CATALOG, OPTION_LISTS, type FieldKey, type OptionListId } from "@/biodata/defaults";
import type { Choice } from "@/biodata/inputs";
import type { Field, FamilyMember, Section } from "@/biodata/types";
import doc from "@/i18n/doc/en.json";
import { t } from "@/lib/i18n";

// The words the editor shows for the profile's own parts: section titles, field labels, option names and
// relations. The editor is in English (the app language, D23), so they come from the English document dictionary
// whatever the document language is; that only changes the printed page (D11, D33). A renamed field or section
// shows the user's own words.

const lookup = (table: Record<string, string>, key: string | undefined): string | undefined =>
  key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;

export function sectionTitle(section: Pick<Section, "key" | "title">): string {
  return section.title?.trim() || lookup(doc.sections, section.key) || t("editor.untitledSection");
}

export function fieldLabel(field: Pick<Field, "key" | "label">): string {
  return field.label?.trim() || lookup(doc.fields, field.key) || t("editor.untitledField");
}

const OPTION_NAMES: Record<string, Record<string, string>> = doc.options;

/**
 * A select field's choices with their English names (D33), from the field's option list (OPTION_LISTS by its
 * key), or undefined for a field without a list. Built once per key.
 */
export function choicesFor(field: Pick<Field, "key">): readonly Choice[] | undefined {
  if (field.key === undefined || !Object.hasOwn(FIELD_CATALOG, field.key)) return undefined;
  const cached = choiceCache.get(field.key);
  if (cached) return cached;
  const def: { type: string; options?: OptionListId } = FIELD_CATALOG[field.key as FieldKey];
  if (!def.options) return undefined;
  const names = OPTION_NAMES[def.options] ?? {};
  const choices = OPTION_LISTS[def.options].map((key) => ({ key, label: lookup(names, key) ?? key }));
  choiceCache.set(field.key, choices);
  return choices;
}

const choiceCache = new Map<string, readonly Choice[]>();

export function memberLabel(member: Pick<FamilyMember, "relationKey" | "relation">): string {
  return lookup(doc.relations, member.relationKey) || member.relation.trim() || t("editor.unnamedMember");
}
