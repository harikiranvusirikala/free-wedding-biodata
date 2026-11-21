import { systemClock, type Clock } from "./defaults";
import type { BiodataProfile, Field, FieldsSection, Section } from "./types";

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
