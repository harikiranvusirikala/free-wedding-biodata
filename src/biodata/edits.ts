import {
  DEFAULT_SECTIONS,
  FIELD_CATALOG,
  QUICK_PICK_SECTIONS,
  createField,
  createSection,
  newUuid,
  systemClock,
  type Clock,
  type FieldKey,
  type NewId,
  type SectionDef,
  TRADITION_FIELD_SETS,
  type Tradition,
} from "./defaults";
import { dateToText, heightToInches, parseDateText, parseTimeText, splitInches, timeToText } from "./inputs";
import type { BiodataProfile, FamilyMember, FamilySection, Field, FieldType, FieldsSection, LabelCase, LangCode, MainPhoto, ProfileOptions, Section, TextSize } from "./types";

// Every change to a profile is a small pure function: (profile, …) → new profile (VISION D6). Nothing is mutated,
// so React sees a new object exactly when something changed, undo is "keep the old one", and each edit is a
// one-line unit test. Unchanged parts are shared, not copied.
//
// An edit that changes nothing (an unknown id, or a value that is already set) returns the same profile object, so
// autosave isn't triggered for nothing. A real change sets updatedAt from the injected clock; `revision` is left
// alone because persistence owns it (D9).
//
// Edits take values exactly as typed: no trimming, because they run on every keystroke and a trailing space is
// often the next word's start. The document trims when it prints.

/** Keys of T that may be left out. */
type OptionalKey<T> = { [K in keyof T]-?: object extends Pick<T, K> ? K : never }[keyof T];

/**
 * A copy without one optional property (absent rather than undefined, so saved records stay clean). Still a T,
 * because only optional keys are allowed; that also keeps a Section's kind intact, which Omit would lose.
 */
function without<T extends object>(value: T, key: OptionalKey<T>): T {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function touch(profile: BiodataProfile, sections: Section[], now: Clock): BiodataProfile {
  return { ...profile, sections, updatedAt: now().toISOString() };
}

/** Applies `change` to one section; returns the profile unchanged if the id is unknown or nothing changed. */
function updateSection(
  profile: BiodataProfile,
  sectionId: string,
  change: (section: Section) => Section,
  now: Clock,
): BiodataProfile {
  let changed = false;
  const sections = profile.sections.map((section) => {
    if (section.id !== sectionId) return section;
    const next = change(section);
    if (next !== section) changed = true;
    return next;
  });
  return changed ? touch(profile, sections, now) : profile;
}

/** Applies `change` to the field with this id, wherever it is; same rules as updateSection. */
function updateField(
  profile: BiodataProfile,
  fieldId: string,
  change: (field: Field) => Field,
  now: Clock,
): BiodataProfile {
  let changed = false;
  const sections = profile.sections.map((section) => {
    if (section.kind !== "fields") return section;
    let sectionChanged = false;
    const fields = section.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const next = change(field);
      if (next !== field) sectionChanged = true;
      return next;
    });
    if (!sectionChanged) return section;
    changed = true;
    return { ...section, fields } satisfies FieldsSection;
  });
  return changed ? touch(profile, sections, now) : profile;
}

/** Applies `change` to the family member with this id, in whichever relation list holds it; same rules. */
function updateMember(
  profile: BiodataProfile,
  memberId: string,
  change: (member: FamilyMember) => FamilyMember,
  now: Clock,
): BiodataProfile {
  let changed = false;
  const sections = profile.sections.map((section) => {
    if (section.kind !== "family") return section;
    let sectionChanged = false;
    const members = section.members.map((member) => {
      if (member.id !== memberId) return member;
      const next = change(member);
      if (next !== member) sectionChanged = true;
      return next;
    });
    if (!sectionChanged) return section;
    changed = true;
    return { ...section, members } satisfies FamilySection;
  });
  return changed ? touch(profile, sections, now) : profile;
}

/** A typed value. Typing replaces a picked option, so it is printed exactly as typed (D33). */
export function setFieldValue(profile: BiodataProfile, fieldId: string, value: string, now: Clock = systemClock) {
  return updateField(
    profile,
    fieldId,
    (field) => {
      if (field.value === value && field.optionKey === undefined) return field;
      return { ...without(field, "optionKey"), value };
    },
    now,
  );
}

/**
 * A value picked from the field's option list (D33): the key is printed in the document language; `value` keeps
 * the text the editor showed (English at launch) as the fallback if a dictionary lacks the key.
 */
export function pickFieldOption(
  profile: BiodataProfile,
  fieldId: string,
  optionKey: string,
  value: string,
  now: Clock = systemClock,
) {
  return updateField(
    profile,
    fieldId,
    (field) => (field.optionKey === optionKey && field.value === value ? field : { ...field, optionKey, value }),
    now,
  );
}

/** Show or hide a field in the document; a hidden field keeps its value (§6). */
export function setFieldVisible(profile: BiodataProfile, fieldId: string, visible: boolean, now: Clock = systemClock) {
  return updateField(profile, fieldId, (field) => (field.visible === visible ? field : { ...field, visible }), now);
}

/** The user's own label. On a default field, a blank label prints the dictionary label; resetFieldLabel removes it. */
export function renameField(profile: BiodataProfile, fieldId: string, label: string, now: Clock = systemClock) {
  return updateField(profile, fieldId, (field) => (field.label === label ? field : { ...field, label }), now);
}

/** Back to the dictionary label. Only for default fields: a custom field's label is all it has. */
export function resetFieldLabel(profile: BiodataProfile, fieldId: string, now: Clock = systemClock) {
  return updateField(
    profile,
    fieldId,
    (field) => {
      if (field.key === undefined || field.label === undefined) return field;
      return without(field, "label");
    },
    now,
  );
}

/** Show or hide a whole section; its fields keep their values and their own visibility. */
export function setSectionVisible(
  profile: BiodataProfile,
  sectionId: string,
  visible: boolean,
  now: Clock = systemClock,
) {
  return updateSection(profile, sectionId, (s) => (s.visible === visible ? s : { ...s, visible }), now);
}

/** The user's own section title; same rules as renameField. */
export function renameSection(profile: BiodataProfile, sectionId: string, title: string, now: Clock = systemClock) {
  return updateSection(profile, sectionId, (s) => (s.title === title ? s : { ...s, title }), now);
}

/** Back to the dictionary title. Only for default sections. */
export function resetSectionTitle(profile: BiodataProfile, sectionId: string, now: Clock = systemClock) {
  return updateSection(
    profile,
    sectionId,
    (section) => {
      if (section.key === undefined || section.title === undefined) return section;
      return without(section, "title");
    },
    now,
  );
}

/** A family member's details (name, occupation, place, phone), as typed (D28). */
export function setMemberDetails(profile: BiodataProfile, memberId: string, details: string, now: Clock = systemClock) {
  return updateMember(profile, memberId, (m) => (m.details === details ? m : { ...m, details }), now);
}

/** Show or hide a family member in the document; a hidden member keeps its details (§6). */
export function setMemberVisible(profile: BiodataProfile, memberId: string, visible: boolean, now: Clock = systemClock) {
  return updateMember(profile, memberId, (m) => (m.visible === visible ? m : { ...m, visible }), now);
}

// ---------------------------------------------------------------------------------------------------------------
// Field and section management (BUILD_PLAN Step 2.2, VISION §6 "Dynamic field functionality"). Same rules as
// above: immutable, unchanged parts shared, a no-op returns the same profile, ids and time injected. Positions are
// array order (no order numbers), so every move is a splice.

/** The types a field the user adds can have; select lists and the height picker belong to catalogue fields. */
export const CUSTOM_FIELD_TYPES = ["text", "textarea", "date", "time", "phone", "email"] as const satisfies readonly FieldType[];
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

const isFieldKey = (key: string | undefined): key is FieldKey => key !== undefined && Object.hasOwn(FIELD_CATALOG, key);

/** Every field in the profile, in order. */
function allFields(profile: Pick<BiodataProfile, "sections">): Field[] {
  return profile.sections.flatMap((section) => (section.kind === "fields" ? section.fields : []));
}

/** The section holding a field, with the field's index in it. */
export function locateField(profile: BiodataProfile, fieldId: string): { section: FieldsSection; index: number } | undefined {
  for (const section of profile.sections) {
    if (section.kind !== "fields") continue;
    const index = section.fields.findIndex((field) => field.id === fieldId);
    if (index >= 0) return { section, index };
  }
  return undefined;
}

/** A copy of `list` with the item at `from` moved to `to` (both in range). */
function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Replaces one fields section by id; `change` returns the new field list (or the same list for no change). */
function updateFields(
  profile: BiodataProfile,
  sectionId: string,
  change: (fields: Field[], section: FieldsSection) => Field[],
  now: Clock,
): BiodataProfile {
  return updateSection(
    profile,
    sectionId,
    (section) => {
      if (section.kind !== "fields") return section;
      const fields = change(section.fields, section);
      return fields === section.fields ? section : { ...section, fields };
    },
    now,
  );
}

/**
 * A field the user makes (§6 "Add a field to any section"): their own label and one of the custom types, empty and
 * shown, appended to the section. The label is stored as typed; a blank label is refused (the row would have no
 * name), as is a section that holds relations rather than fields.
 */
export function addCustomField(
  profile: BiodataProfile,
  sectionId: string,
  { label, type }: { label: string; type: CustomFieldType },
  newId: NewId = newUuid,
  now: Clock = systemClock,
) {
  if (!label.trim()) return profile;
  return updateFields(profile, sectionId, (fields) => [...fields, { id: newId(), label, type, value: "", visible: true }], now);
}

/** The catalogue keys that aren't in the profile yet, anywhere (moved fields count as present). */
export function missingCatalogKeys(profile: BiodataProfile): FieldKey[] {
  const present = new Set(allFields(profile).map((field) => field.key));
  return (Object.keys(FIELD_CATALOG) as FieldKey[]).filter((key) => !present.has(key));
}

/** The default definition of a keyed section (a default section or a quick pick), if it has one. */
export function sectionDefOf(section: Pick<Section, "key">): SectionDef | undefined {
  if (section.key === undefined) return undefined;
  return [...DEFAULT_SECTIONS, ...QUICK_PICK_SECTIONS].find((def) => def.key === section.key);
}

/**
 * Where a default field goes back in its home section: straight after the nearest field before it in the default
 * order that is still in the section, else straight before the nearest one after it, else at the end. Custom and
 * moved-in fields stay where the user put them.
 */
function defaultIndex(keys: readonly (string | undefined)[], order: readonly string[], key: string): number {
  const at = order.indexOf(key);
  for (let i = at - 1; i >= 0; i--) {
    const index = keys.indexOf(order[i]);
    if (index >= 0) return index + 1;
  }
  for (let i = at + 1; i < order.length; i++) {
    const index = keys.indexOf(order[i]);
    if (index >= 0) return index;
  }
  return keys.length;
}

/**
 * A catalogue field the profile doesn't have yet ("Add a field" suggestions). In its own default section it goes
 * back to its default place; anywhere else it is appended. A key already present anywhere is a no-op, so one key
 * always means one field.
 */
export function addCatalogField(
  profile: BiodataProfile,
  sectionId: string,
  key: FieldKey,
  newId: NewId = newUuid,
  now: Clock = systemClock,
) {
  if (!isFieldKey(key) || allFields(profile).some((field) => field.key === key)) return profile;
  return updateFields(
    profile,
    sectionId,
    (fields, section) => {
      const def = sectionDefOf(section);
      const order = def?.kind === "fields" ? def.fields : [];
      const index = order.includes(key) ? defaultIndex(fields.map((f) => f.key), order, key) : fields.length;
      const next = [...fields];
      next.splice(index, 0, createField(key, newId));
      return next;
    },
    now,
  );
}

/** Feet and inches for a stored height, as text ("178" → "5 ft 10 in"); null when it isn't one. */
function heightText(value: string): string | null {
  const inches = heightToInches(value);
  if (inches === null) return null;
  const { ft, in: inch } = splitInches(inches);
  return `${ft} ft ${inch} in`;
}

/** A value carried over to another type: kept as it reads; stored in the new type's format when it can be. */
function convertValue(value: string, from: FieldType, to: FieldType): string {
  if (!value.trim()) return value;
  // Out of a stored format into free text: the text the editor showed, so nothing reads differently.
  let text = value;
  if (from === "date") text = dateToText(value);
  else if (from === "time") text = timeToText(value);
  else if (from === "height") text = heightText(value) ?? value;
  // Into a stored format when the text reads as one, else exactly as it was (the input says "prints as typed").
  if (to === "date") return parseDateText(text) ?? text;
  if (to === "time") return parseTimeText(text) ?? text;
  if (to === "height") return heightToInches(text) !== null ? text.trim() : text;
  return text;
}

/**
 * A field's input type (§6 "Change a field's value and input type where sensible"). The value is kept: a date,
 * time or height becomes the text the editor showed for it ("1998-03-15" → "15-03-1998"); text that reads as the
 * new type is stored in its format ("15 March 1998" → "1998-03-15"); anything else stays exactly as typed, and the
 * input says it prints as typed. A picked option's key is dropped unless it stays a list (the English text stays),
 * a paragraph with line breaks becomes a multi-line row so nothing is joined unseen, and `multiline` is kept only
 * on text rows. Custom fields can take only the custom types; a catalogue field may also go back to its own type.
 */
export function changeFieldType(profile: BiodataProfile, fieldId: string, type: FieldType, now: Clock = systemClock) {
  return updateField(
    profile,
    fieldId,
    (field) => {
      if (field.type === type) return field;
      const own = isFieldKey(field.key) ? FIELD_CATALOG[field.key].type : undefined;
      if (!(CUSTOM_FIELD_TYPES as readonly FieldType[]).includes(type) && type !== own) return field;
      let next: Field = { ...field, type, value: convertValue(field.value, field.type, type) };
      if (type !== "select") next = without(next, "optionKey");
      if (type === "text" && field.type === "textarea" && field.value.includes("\n")) next.multiline = true;
      else if (type !== "text") next = without(next, "multiline");
      return next;
    },
    now,
  );
}

/** Display style for a text row (§6 "single line or multiline"): a multi-line row may hold line breaks. */
export function setFieldMultiline(profile: BiodataProfile, fieldId: string, multiline: boolean, now: Clock = systemClock) {
  return updateField(
    profile,
    fieldId,
    (field) => {
      if (field.type !== "text" || (field.multiline ?? false) === multiline) return field;
      return multiline ? { ...field, multiline: true } : without(field, "multiline");
    },
    now,
  );
}

/** Removes a field and its value (the editor asks first and offers Undo, which is insertField). */
export function removeField(profile: BiodataProfile, fieldId: string, now: Clock = systemClock) {
  const at = locateField(profile, fieldId);
  if (!at) return profile;
  return updateFields(profile, at.section.id, (fields) => fields.filter((field) => field.id !== fieldId), now);
}

/**
 * Puts a field back at an index of a section (Undo after Remove). Refused if its id is already in the profile;
 * the index is clamped, so a section that has changed meanwhile still gets it back.
 */
export function insertField(profile: BiodataProfile, sectionId: string, index: number, field: Field, now: Clock = systemClock) {
  if (locateField(profile, field.id)) return profile;
  return updateFields(
    profile,
    sectionId,
    (fields) => {
      const next = [...fields];
      next.splice(Math.max(0, Math.min(index, fields.length)), 0, field);
      return next;
    },
    now,
  );
}

/** One place up (-1) or down (+1) within its section; a no-op at either end. */
export function moveField(profile: BiodataProfile, fieldId: string, step: -1 | 1, now: Clock = systemClock) {
  const at = locateField(profile, fieldId);
  if (!at) return profile;
  const to = at.index + step;
  if (to < 0 || to >= at.section.fields.length) return profile;
  return updateFields(profile, at.section.id, (fields) => moved(fields, at.index, to), now);
}

/**
 * Moves a field, value and all, to the end of another fields section (§6, D28: Education under Personal details).
 * A no-op for its own section, an unknown section or a relation list.
 */
export function moveFieldToSection(profile: BiodataProfile, fieldId: string, sectionId: string, now: Clock = systemClock) {
  const at = locateField(profile, fieldId);
  const target = profile.sections.find((section) => section.id === sectionId);
  if (!at || !target || target.kind !== "fields" || target.id === at.section.id) return profile;
  const field = at.section.fields[at.index];
  const sections = profile.sections.map((section) => {
    if (section.id === at.section.id) return { ...at.section, fields: at.section.fields.filter((f) => f.id !== fieldId) };
    if (section.id === target.id) return { ...target, fields: [...target.fields, field] };
    return section;
  });
  return touch(profile, sections, now);
}

/** A section of the user's own (§6 "Add a custom section"): empty, shown, at the end. A blank title is refused. */
export function addCustomSection(profile: BiodataProfile, title: string, newId: NewId = newUuid, now: Clock = systemClock) {
  if (!title.trim()) return profile;
  const section: FieldsSection = { id: newId(), kind: "fields", title, visible: true, fields: [] };
  return touch(profile, [...profile.sections, section], now);
}

/**
 * A ready-made section from "Add a section" (D44): a quick pick (References) or a default section the user removed,
 * added at the end with its default fields. Fields already elsewhere in the profile (moved out before the section
 * was removed) aren't duplicated. The section takes the first new id. A no-op if a section with this key is already there or the key is unknown.
 */
export function addPresetSection(profile: BiodataProfile, key: string, newId: NewId = newUuid, now: Clock = systemClock) {
  const def = sectionDefOf({ key });
  if (!def || profile.sections.some((section) => section.key === key)) return profile;
  const present = new Set(allFields(profile).map((field) => field.key));
  const trimmed: SectionDef = def.kind === "fields" ? { ...def, fields: def.fields.filter((k) => !present.has(k)) } : def;
  const id = newId(); // first, so the caller can find (and scroll to) the new section
  return touch(profile, [...profile.sections, { ...createSection(trimmed, newId), id }], now);
}

/** The ready-made sections not in the profile: removed default sections in their default order, then the quick picks. */
export function availablePresetSections(profile: BiodataProfile): SectionDef[] {
  const present = new Set(profile.sections.map((section) => section.key));
  return [...DEFAULT_SECTIONS, ...QUICK_PICK_SECTIONS].filter((def) => !present.has(def.key));
}

/** Removes a section with everything in it (the editor asks first and offers Undo, which is insertSection). */
export function removeSection(profile: BiodataProfile, sectionId: string, now: Clock = systemClock) {
  const sections = profile.sections.filter((section) => section.id !== sectionId);
  return sections.length === profile.sections.length ? profile : touch(profile, sections, now);
}

/** Puts a section back at an index (Undo after Remove); refused if its id is already there; the index is clamped. */
export function insertSection(profile: BiodataProfile, index: number, section: Section, now: Clock = systemClock) {
  if (profile.sections.some((s) => s.id === section.id)) return profile;
  const sections = [...profile.sections];
  sections.splice(Math.max(0, Math.min(index, sections.length)), 0, section);
  return touch(profile, sections, now);
}

/** One place up (-1) or down (+1) in the biodata; a no-op at either end. */
export function moveSection(profile: BiodataProfile, sectionId: string, step: -1 | 1, now: Clock = systemClock) {
  const from = profile.sections.findIndex((section) => section.id === sectionId);
  const to = from + step;
  if (from < 0 || to < 0 || to >= profile.sections.length) return profile;
  return touch(profile, moved(profile.sections, from, to), now);
}

/**
 * What "Restore default fields" would bring back to a section: its default fields that are nowhere in the profile
 * (a field moved to another section is still there, so it isn't duplicated), or for a relation list its default
 * relations (Father, Mother) missing from it. Empty for a custom section.
 */
export function missingDefaults(profile: BiodataProfile, section: Section): string[] {
  const def = sectionDefOf(section);
  if (!def || def.kind !== section.kind) return [];
  if (def.kind === "fields") {
    const present = new Set(allFields(profile).map((field) => field.key));
    return def.fields.filter((key) => !present.has(key));
  }
  const relations = new Set(section.kind === "family" ? section.members.map((m) => m.relationKey) : []);
  return def.members.filter((key) => !relations.has(key));
}

/**
 * Restore default fields (§6). Re-adds only what is missing (missingDefaults), each empty and shown, at its default
 * place (defaultIndex: after the nearest earlier default still in the section). It never removes, reorders,
 * renames, retypes, unhides or clears anything: custom fields, moved-in fields, renamed labels, hidden fields and
 * every value stay exactly as they are. The section title is left alone too (Rename has its own reset).
 */
export function restoreSectionDefaults(profile: BiodataProfile, sectionId: string, newId: NewId = newUuid, now: Clock = systemClock) {
  const section = profile.sections.find((s) => s.id === sectionId);
  if (!section) return profile;
  const missing = missingDefaults(profile, section);
  const def = sectionDefOf(section);
  if (!missing.length || !def) return profile;
  const order: readonly string[] = def.kind === "fields" ? def.fields : def.members;
  let next: Section;
  if (section.kind === "fields") {
    const fields = [...section.fields];
    for (const key of missing) fields.splice(defaultIndex(fields.map((f) => f.key), order, key), 0, createField(key as FieldKey, newId));
    next = { ...section, fields };
  } else {
    const members = [...section.members];
    for (const relationKey of missing) {
      members.splice(defaultIndex(members.map((m) => m.relationKey), order, relationKey), 0, { id: newId(), relationKey, relation: "", details: "", visible: true });
    }
    next = { ...section, members };
  }
  return touch(
    profile,
    profile.sections.map((s) => (s.id === sectionId ? next : s)),
    now,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The editor's opening (BUILD_PLAN Step 2.0, VISION D21, D43): the top of the biodata (motif, invocation line,
// title), the document language, and the tradition chips. Same rules: immutable, a no-op returns the same profile.

/** Applies `change` to the options; the same profile if nothing changed. */
function updateOptions(profile: BiodataProfile, change: (options: ProfileOptions) => ProfileOptions, now: Clock): BiodataProfile {
  const options = change(profile.options);
  return options === profile.options ? profile : { ...profile, options, updatedAt: now().toISOString() };
}

/** The motif at the top (an id from the motif library), or null for None (D21: never inferred). */
export function setMotif(profile: BiodataProfile, motif: string | null, now: Clock = systemClock) {
  const next = motif || null;
  return updateOptions(profile, (o) => (o.motif === next ? o : { ...o, motif: next }), now);
}

/** The invocation line as typed ("" = None). A picked line arrives here as its text, so it stays editable (§7). */
export function setInvocation(profile: BiodataProfile, invocation: string, now: Clock = systemClock) {
  return updateOptions(profile, (o) => (o.invocation === invocation ? o : { ...o, invocation }), now);
}

/**
 * The title's three states (D45): none; a preset printed in the document language (`titleKey`); or the user's own
 * words, printed as typed. "Own words" with nothing typed yet is `{ kind: "custom", text: "" }`: it prints nothing,
 * but the editor keeps the box open.
 */
export type TitleChoice = { kind: "none" } | { kind: "preset"; key: string } | { kind: "custom"; text: string };

export function titleChoice(options: Pick<ProfileOptions, "titleKey" | "title">): TitleChoice {
  if (options.titleKey !== undefined) return { kind: "preset", key: options.titleKey };
  if (options.title !== undefined) return { kind: "custom", text: options.title };
  return { kind: "none" };
}

export function setTitle(profile: BiodataProfile, choice: TitleChoice, now: Clock = systemClock) {
  return updateOptions(
    profile,
    (o) => {
      const current = titleChoice(o);
      if (choice.kind === "none" && current.kind === "none") return o;
      if (choice.kind === "preset" && current.kind === "preset" && current.key === choice.key) return o;
      if (choice.kind === "custom" && current.kind === "custom" && current.text === choice.text) return o;
      const rest = without(without(o, "titleKey"), "title");
      if (choice.kind === "preset" && choice.key) return { ...rest, titleKey: choice.key };
      if (choice.kind === "custom") return { ...rest, title: choice.text };
      return rest;
    },
    now,
  );
}

/** The language of the printed labels (D11); what the user typed is printed as typed whatever it is. */
export function setDocLanguage(profile: BiodataProfile, docLanguage: LangCode, now: Clock = systemClock) {
  return profile.docLanguage === docLanguage ? profile : { ...profile, docLanguage, updatedAt: now().toISOString() };
}

// ---------------------------------------------------------------------------------------------------------------
// The live preview's controls (BUILD_PLAN Step 3.3, VISION D31, D39, D46): design, colour, text size and label case.
// Design and colour ids are checked against the template registry by the caller (src/document is not imported here,
// to keep this module free of React); an unknown id is still safe, since the document falls back at render time.

/**
 * The design and its colour together: colour ids belong to a design (Classic Gold's "gold", Paisley's "copper"),
 * so a design change always says which of its colours to use (the editor passes the new design's first one).
 */
export function setDesign(profile: BiodataProfile, templateId: string, colorId: string, now: Clock = systemClock) {
  if (profile.templateId === templateId && profile.colorId === colorId) return profile;
  return { ...profile, templateId, colorId, updatedAt: now().toISOString() };
}

/** One of the open design's colour variants (D39). */
export function setColor(profile: BiodataProfile, colorId: string, now: Clock = systemClock) {
  return profile.colorId === colorId ? profile : { ...profile, colorId, updatedAt: now().toISOString() };
}

/** Auto (the largest size that fits one page, never below 9 pt) or a fixed size XS–XL (D31). */
export function setTextSize(profile: BiodataProfile, textSize: TextSize, now: Clock = systemClock) {
  return updateOptions(profile, (o) => (o.textSize === textSize ? o : { ...o, textSize }), now);
}

/** Labels as written, or in capitals (D31; only Latin labels change, Indian scripts have no case). */
export function setLabelCase(profile: BiodataProfile, labelCase: LabelCase, now: Clock = systemClock) {
  return updateOptions(profile, (o) => (o.labelCase === labelCase ? o : { ...o, labelCase }), now);
}

/** Where a tradition field goes when its own section isn't in the draft: the first of these that is. */
const TRADITION_FALLBACK = ["religion", "horoscope", "personal"];

/**
 * The fields a tradition chip would add (D32, D43): its set minus the keys already anywhere in the draft, each
 * with the id of the fields section it would go to (its own section, else Religion, Horoscope, Personal details or
 * the first fields section). Empty when there is nothing left to add.
 */
export function traditionFieldsToAdd(profile: Pick<BiodataProfile, "sections">, tradition: Tradition): { key: FieldKey; sectionId: string }[] {
  const present = new Set(allFields(profile).map((field) => field.key));
  const fieldSections = profile.sections.filter((s): s is FieldsSection => s.kind === "fields");
  const byKey = (key: string) => fieldSections.find((s) => s.key === key);
  const out: { key: FieldKey; sectionId: string }[] = [];
  for (const { section, field } of TRADITION_FIELD_SETS[tradition] ?? []) {
    if (present.has(field)) continue;
    const target = byKey(section) ?? TRADITION_FALLBACK.map(byKey).find(Boolean) ?? fieldSections[0];
    if (!target) continue;
    present.add(field);
    out.push({ key: field, sectionId: target.id });
  }
  return out;
}

/**
 * A tradition chip (D32, D43): adds the chip's fields that aren't in the draft yet, empty and shown, at the end of
 * their sections (traditionFieldsToAdd). Tapping it again adds nothing. Only ever called on the user's tap.
 */
export function addTraditionFields(profile: BiodataProfile, tradition: Tradition, newId: NewId = newUuid, now: Clock = systemClock) {
  const adds = traditionFieldsToAdd(profile, tradition);
  if (!adds.length) return profile;
  const sections = profile.sections.map((section) => {
    const mine = adds.filter((a) => a.sectionId === section.id);
    if (!mine.length || section.kind !== "fields") return section;
    return { ...section, fields: [...section.fields, ...mine.map((a) => createField(a.key, newId))] };
  });
  return touch(profile, sections, now);
}

/** Removes several fields at once (Undo after a tradition chip); unknown ids are ignored. */
export function removeFields(profile: BiodataProfile, fieldIds: readonly string[], now: Clock = systemClock) {
  const ids = new Set(fieldIds);
  let changed = false;
  const sections = profile.sections.map((section) => {
    if (section.kind !== "fields" || !section.fields.some((f) => ids.has(f.id))) return section;
    changed = true;
    return { ...section, fields: section.fields.filter((f) => !ids.has(f.id)) };
  });
  return changed ? touch(profile, sections, now) : profile;
}

// ---------------------------------------------------------------------------------------------------------------
// Family members (BUILD_PLAN Step 2.3, VISION §6 "Repeated family members", D28) and References (D44): a relation
// list is an array of members with stable ids, so adding, reordering and removing never touch the other rows. A
// relation is picked (a `relationKey`, printed in the document language) or typed (printed as typed), never both.

/** A member's relation: a picked suggestion's key, or the words typed. */
export type MemberRelation = { relationKey: string } | { relation: string };

/** The relation list holding a member, with the member's index in it. */
export function locateMember(profile: BiodataProfile, memberId: string): { section: FamilySection; index: number } | undefined {
  for (const section of profile.sections) {
    if (section.kind !== "family") continue;
    const index = section.members.findIndex((member) => member.id === memberId);
    if (index >= 0) return { section, index };
  }
  return undefined;
}

/** Replaces one relation list by id; `change` returns the new member list (or the same list for no change). */
function updateMembers(
  profile: BiodataProfile,
  sectionId: string,
  change: (members: FamilyMember[]) => FamilyMember[],
  now: Clock,
): BiodataProfile {
  return updateSection(
    profile,
    sectionId,
    (section) => {
      if (section.kind !== "family") return section;
      const members = change(section.members);
      return members === section.members ? section : { ...section, members };
    },
    now,
  );
}

/** The member's relation fields for a picked or typed relation; undefined when nothing usable was given. */
function relationFields(relation: MemberRelation): Pick<FamilyMember, "relationKey" | "relation"> | undefined {
  if ("relationKey" in relation) return relation.relationKey ? { relationKey: relation.relationKey, relation: "" } : undefined;
  return relation.relation.trim() ? { relation: relation.relation } : undefined;
}

/**
 * A person added to a relation list (Family or References), shown, at the end. Details may hold several lines
 * (a second phone number, D44). Refused without a relation, or for a section that holds fields.
 */
export function addMember(
  profile: BiodataProfile,
  sectionId: string,
  input: MemberRelation & { details?: string },
  newId: NewId = newUuid,
  now: Clock = systemClock,
) {
  const relation = relationFields(input);
  if (!relation) return profile;
  return updateMembers(profile, sectionId, (members) => [...members, { id: newId(), ...relation, details: input.details ?? "", visible: true }], now);
}

/** A new relation for a member: picking one clears the typed words, typing one clears the picked key (D33). */
export function editMemberRelation(profile: BiodataProfile, memberId: string, relation: MemberRelation, now: Clock = systemClock) {
  const next = relationFields(relation);
  if (!next) return profile;
  return updateMember(
    profile,
    memberId,
    (member) => {
      if (member.relationKey === next.relationKey && (next.relationKey !== undefined || member.relation === next.relation)) return member;
      const base = without(member, "relationKey");
      return { ...base, ...next };
    },
    now,
  );
}

/** One place up (-1) or down (+1) in its list; a no-op at either end. */
export function moveMember(profile: BiodataProfile, memberId: string, step: -1 | 1, now: Clock = systemClock) {
  const at = locateMember(profile, memberId);
  if (!at) return profile;
  const to = at.index + step;
  if (to < 0 || to >= at.section.members.length) return profile;
  return updateMembers(profile, at.section.id, (members) => moved(members, at.index, to), now);
}

/** Removes a member and their details (the editor asks first and offers Undo, which is insertMember). */
export function removeMember(profile: BiodataProfile, memberId: string, now: Clock = systemClock) {
  const at = locateMember(profile, memberId);
  if (!at) return profile;
  return updateMembers(profile, at.section.id, (members) => members.filter((member) => member.id !== memberId), now);
}

/** Puts a member back at an index of a relation list (Undo); refused if the id is already there; index clamped. */
export function insertMember(profile: BiodataProfile, sectionId: string, index: number, member: FamilyMember, now: Clock = systemClock) {
  if (locateMember(profile, member.id)) return profile;
  return updateMembers(
    profile,
    sectionId,
    (members) => {
      const next = [...members];
      next.splice(Math.max(0, Math.min(index, members.length)), 0, member);
      return next;
    },
    now,
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The main photo (Step 3.1, D12, D40). Only the reference and crop live in the profile; the picture itself is
// written by the same save (autosave's photo puts and deletes), so a draft never points at a missing image.

const samePhoto = (a: MainPhoto | undefined, b: MainPhoto | undefined) =>
  a === b ||
  (!!a && !!b && a.id === b.id && a.frame === b.frame && a.crop.x === b.crop.x && a.crop.y === b.crop.y && a.crop.zoom === b.crop.zoom && a.crop.rotation === b.crop.rotation);

/** Sets (or, with undefined, removes) the main photo's reference, frame and crop. */
export function setPhoto(profile: BiodataProfile, photo: MainPhoto | undefined, now: Clock = systemClock) {
  if (samePhoto(profile.photo, photo)) return profile;
  if (!photo) {
    const next = without(profile, "photo");
    return { ...next, updatedAt: now().toISOString() };
  }
  return { ...profile, photo, updatedAt: now().toISOString() };
}
