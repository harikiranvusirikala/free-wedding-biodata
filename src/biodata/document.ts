import { FIELD_CATALOG } from "./defaults";
import { ageOn, formatAge, formatDate, formatHeight, formatTime } from "./format";
import type { BiodataProfile, Field, LabelCase, LangCode, PhotoFrame, Section, TextSize } from "./types";
import { labelTables, type DocDictionary, type LabelTables } from "@/i18n/doc";

// Profile + document dictionary + today → the document model (BUILD_PLAN A4 step 1). Everything a template
// prints and nothing else: hidden or empty fields, members and sections are dropped (§6, §7 "empty fields and
// empty section headings must not appear"); labels come from the dictionary unless the user renamed them; picked
// options print in the document language and typed values exactly as typed (D33); dates, time and height are
// formatted; the age is computed from the date of birth only when asked (D13). Pure, so templates, the preview
// and tests all see the same document.

/** A label/value line: a field, a computed age, or a family member (relation : details, D28). */
export interface DocRow {
  kind: "row";
  /** The field or member id (the age row uses "<dob id>:age"). */
  id: string;
  /** The field key, "age" for the computed age, or undefined for custom fields and members. */
  key?: string;
  label: string;
  value: string;
  /** Printed after the value in brackets, as typed (D44). */
  note?: string;
  /** The value may run over several lines and keeps the user's line breaks (an address). */
  multiline?: boolean;
}

/** A paragraph field (About me, Partner expectations): printed as a short block, split across pages by lines. */
export interface DocParagraph {
  kind: "paragraph";
  id: string;
  key?: string;
  label: string;
  text: string;
}

export type DocItem = DocRow | DocParagraph;

export interface DocSection {
  id: string;
  key?: string;
  kind: Section["kind"];
  title: string;
  items: DocItem[];
}

export interface DocModel {
  lang: LangCode;
  templateId: string;
  colorId: string;
  textSize: TextSize;
  labelCase: LabelCase;
  /** The title (a preset in the document language, or the user's own), if any (D45). */
  title?: string;
  /** Motif id, or null for None (D21: never inferred). */
  motif: string | null;
  /** The invocation line as typed, if any. */
  invocation?: string;
  /** The full name, if printed, for skeletons that set it as a heading (Minimal). */
  name?: string;
  /** The main photo slot, when the profile has one. The picture itself is supplied by the caller (Step 3.1). */
  photo?: { id: string; frame: PhotoFrame };
  sections: DocSection[];
}

const isCatalogKey = (key: string | undefined): key is keyof typeof FIELD_CATALOG =>
  key !== undefined && Object.hasOwn(FIELD_CATALOG, key);

const lookup = (table: Record<string, string>, key: string | undefined): string | undefined =>
  key !== undefined && Object.hasOwn(table, key) ? table[key] : undefined;

/** The printed label: the user's own if set (and not blank), else the dictionary's (in the label style) by key. */
function fieldLabel(field: Field, tables: LabelTables): string {
  return field.label?.trim() || lookup(tables.fields, field.key) || field.key || "";
}

/** The printed value, or "" when there is nothing to print. */
function fieldValue(field: Field, profile: BiodataProfile, dict: DocDictionary): string {
  if (field.optionKey !== undefined && isCatalogKey(field.key)) {
    const def: { type: string; options?: string } = FIELD_CATALOG[field.key];
    const options = def.options ? (dict.options as Record<string, Record<string, string>>)[def.options] : undefined;
    const label = options ? lookup(options, field.optionKey) : undefined;
    if (label) return label;
  }
  const value = field.value;
  if (!value.trim()) return "";
  switch (field.type) {
    case "date":
      // Always dd-mm-yyyy: `options.dateFormat` is kept in stored drafts for compatibility and ignored.
      return formatDate(value);
    case "time":
      return formatTime(value, dict);
    case "height":
      return formatHeight(value, profile.options.heightFormat, dict);
    case "textarea":
      return value.trim();
    default:
      return field.multiline ? value.trim() : value.trim().replace(/\s*\n\s*/g, ", ");
  }
}

function sectionItems(section: Section, profile: BiodataProfile, dict: DocDictionary, tables: LabelTables, today: Date): DocItem[] {
  if (section.kind === "family") {
    return section.members
      .filter((m) => m.visible && m.details.trim())
      .map((m) => ({
        kind: "row" as const,
        id: m.id,
        label: lookup(dict.relations, m.relationKey) || m.relation.trim(),
        value: m.details.trim(),
        multiline: m.details.includes("\n") || undefined,
      }));
  }
  const items: DocItem[] = [];
  for (const field of section.fields) {
    if (!field.visible) continue;
    const value = fieldValue(field, profile, dict);
    if (!value) continue;
    const label = fieldLabel(field, tables);
    if (field.type === "textarea") {
      items.push({ kind: "paragraph", id: field.id, key: field.key, label, text: value });
      continue;
    }
    const row: DocRow = { kind: "row", id: field.id, key: field.key, label, value };
    if (field.note?.trim()) row.note = field.note.trim();
    if (field.multiline) row.multiline = true;
    items.push(row);
    if (field.key === "dateOfBirth" && profile.options.showAge) {
      const age = ageOn(field.value, today);
      if (age !== null) items.push({ kind: "row", id: `${field.id}:age`, key: "age", label: dict.words.age, value: formatAge(age, dict) });
    }
  }
  return items;
}

/** The document model for a profile in its document language, as of `today` (for the age). */
export function toDocument(profile: BiodataProfile, dict: DocDictionary, today: Date): DocModel {
  const { options } = profile;
  // English pages may use the Telugu families' wording (Star, Swagothram…); other languages ignore the style.
  const tables = labelTables(dict, profile.docLanguage, options.labelStyle);
  const sections: DocSection[] = [];
  let name: string | undefined;
  for (const section of profile.sections) {
    if (!section.visible) continue;
    const items = sectionItems(section, profile, dict, tables, today);
    if (!items.length) continue;
    name ??= items.find((i): i is DocRow => i.kind === "row" && i.key === "fullName")?.value;
    sections.push({
      id: section.id,
      key: section.key,
      kind: section.kind,
      title: section.title?.trim() || lookup(tables.sections, section.key) || section.key || "",
      items,
    });
  }

  const doc: DocModel = {
    lang: profile.docLanguage,
    templateId: profile.templateId,
    colorId: profile.colorId,
    textSize: options.textSize,
    labelCase: options.labelCase,
    motif: options.motif,
    sections,
  };
  const title = options.titleKey !== undefined ? lookup(dict.titles, options.titleKey) : options.title?.trim();
  if (title) doc.title = title;
  if (options.invocation.trim()) doc.invocation = options.invocation.trim();
  if (name) doc.name = name;
  if (profile.photo) doc.photo = { id: profile.photo.id, frame: profile.photo.frame };
  return doc;
}

/** Every string the document prints, in order (for tests that check a rendering shows all of it). */
export function docTexts(doc: DocModel): string[] {
  const out: string[] = [];
  if (doc.invocation) out.push(doc.invocation);
  if (doc.title) out.push(doc.title);
  for (const section of doc.sections) {
    out.push(section.title);
    for (const item of section.items) {
      if (item.kind === "row") {
        if (item.label) out.push(item.label);
        out.push(item.value);
        if (item.note) out.push(item.note);
      } else out.push(item.text);
    }
  }
  return out;
}
