import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS, createProfile } from "./defaults";
import {
  addCatalogField,
  addCustomField,
  addCustomSection,
  addPresetSection,
  availablePresetSections,
  changeFieldType,
  insertField,
  insertSection,
  locateField,
  missingCatalogKeys,
  missingDefaults,
  moveField,
  moveFieldToSection,
  moveSection,
  removeField,
  removeSection,
  renameField,
  restoreSectionDefaults,
  setFieldMultiline,
  setFieldValue,
  setFieldVisible,
  pickFieldOption,
} from "./edits";
import { profileSchema } from "./schema";
import type { BiodataProfile, FamilySection, Field, FieldsSection } from "./types";

// Step 2.2: adding, retyping, moving, removing and restoring fields and sections (VISION §6). Every edit is checked
// to be immutable (the original is deep-frozen), to share what it didn't touch, to return the same profile when it
// changes nothing, and to leave a profile the schema accepts.

const CREATED = new Date("2026-11-21T10:00:00.000Z");
const LATER = new Date("2026-11-21T10:05:00.000Z");
const later = () => LATER;

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function setup() {
  let n = 0;
  const profile = freeze(createProfile({ newId: () => `id-${++n}`, now: () => CREATED }));
  let m = 0;
  const newId = () => `new-${++m}`;
  return { profile, newId };
}

const section = (profile: BiodataProfile, key: string) => profile.sections.find((s) => s.key === key) as FieldsSection;
const family = (profile: BiodataProfile) => profile.sections.find((s) => s.key === "family") as FamilySection;
const keys = (s: FieldsSection) => s.fields.map((f) => f.key ?? f.label);
const field = (profile: BiodataProfile, key: string) =>
  profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : [])).find((f) => f.key === key) as Field;
const valid = (profile: BiodataProfile) => expect(profileSchema.safeParse(profile).success).toBe(true);

describe("adding fields", () => {
  it("adds a custom field at the end of a section, empty and shown, with the label as typed", () => {
    const { profile, newId } = setup();
    const horoscope = section(profile, "horoscope");
    const next = addCustomField(profile, horoscope.id, { label: "Star  pada ", type: "text" }, newId, later);
    const fields = section(next, "horoscope").fields;
    expect(fields.at(-1)).toEqual({ id: "new-1", label: "Star  pada ", type: "text", value: "", visible: true });
    expect(fields.slice(0, -1)).toEqual(horoscope.fields);
    expect(next.updatedAt).toBe(LATER.toISOString());
    expect(next.sections[0]).toBe(profile.sections[0]);
    valid(next);
  });

  it("refuses a blank label, an unknown section and a relation list", () => {
    const { profile, newId } = setup();
    expect(addCustomField(profile, section(profile, "personal").id, { label: "  ", type: "text" }, newId, later)).toBe(profile);
    expect(addCustomField(profile, "nope", { label: "Blood group", type: "text" }, newId, later)).toBe(profile);
    expect(addCustomField(profile, family(profile).id, { label: "Blood group", type: "text" }, newId, later)).toBe(profile);
  });

  it("lists the catalogue fields not in the profile, counting moved fields as present", () => {
    const { profile } = setup();
    expect(missingCatalogKeys(profile)).toEqual(["lagnam", "dosham", "kulaDevata", "muslimSect", "denomination", "church", "sikhPractice", "jainSect"]);
    const gotra = field(profile, "gotra");
    const moved = moveFieldToSection(profile, gotra.id, section(profile, "religion").id, later);
    expect(missingCatalogKeys(moved)).not.toContain("gotra");
    expect(missingCatalogKeys(removeField(profile, gotra.id, later))).toContain("gotra");
  });

  it("adds a catalogue field back at its default place in its own section, and at the end elsewhere", () => {
    const { profile, newId } = setup();
    const removed = removeField(profile, field(profile, "rashi").id, later);
    const back = addCatalogField(removed, section(removed, "horoscope").id, "rashi", newId, later);
    expect(keys(section(back, "horoscope"))).toEqual(keys(section(profile, "horoscope")));
    expect(field(back, "rashi")).toEqual({ id: "new-1", key: "rashi", type: "select", value: "", visible: true });

    const elsewhere = addCatalogField(removed, section(removed, "personal").id, "rashi", newId, later);
    expect(keys(section(elsewhere, "personal")).at(-1)).toBe("rashi");

    const lagnam = addCatalogField(profile, section(profile, "horoscope").id, "lagnam", newId, later);
    expect(keys(section(lagnam, "horoscope")).at(-1)).toBe("lagnam");
    valid(lagnam);
  });

  it("never adds a catalogue key twice", () => {
    const { profile, newId } = setup();
    expect(addCatalogField(profile, section(profile, "career").id, "gotra", newId, later)).toBe(profile);
  });
});

describe("changing a field's type", () => {
  function custom(type: Field["type"], value: string) {
    const { profile, newId } = setup();
    const personal = section(profile, "personal");
    let next = addCustomField(profile, personal.id, { label: "Mine", type: "text" }, newId, later);
    next = changeFieldType(next, "new-1", type, later);
    return setFieldValue(next, "new-1", value, later);
  }
  const mine = (profile: BiodataProfile) => locateField(profile, "new-1")!.section.fields[locateField(profile, "new-1")!.index];

  it("turns a stored date into the text the editor showed, and readable text into a stored date", () => {
    const date = custom("date", "1998-03-15");
    expect(mine(changeFieldType(date, "new-1", "text", later)).value).toBe("15-03-1998");
    const text = custom("text", "15 March 1998");
    expect(mine(changeFieldType(text, "new-1", "date", later)).value).toBe("1998-03-15");
  });

  it("keeps text that doesn't read as the new type exactly as typed", () => {
    const text = custom("text", "Around Diwali 1998");
    expect(mine(changeFieldType(text, "new-1", "date", later)).value).toBe("Around Diwali 1998");
    expect(mine(changeFieldType(text, "new-1", "time", later)).value).toBe("Around Diwali 1998");
  });

  it("converts times both ways", () => {
    const time = custom("time", "18:45");
    expect(mine(changeFieldType(time, "new-1", "text", later)).value).toBe("6:45 PM");
    expect(mine(changeFieldType(custom("text", "6.45 pm"), "new-1", "time", later)).value).toBe("18:45");
  });

  it("keeps the value between text, paragraph, phone and email", () => {
    const text = custom("text", "+91 90000 00001");
    const phone = changeFieldType(text, "new-1", "phone", later);
    expect(mine(phone)).toMatchObject({ type: "phone", value: "+91 90000 00001" });
    expect(mine(changeFieldType(phone, "new-1", "textarea", later)).value).toBe("+91 90000 00001");
  });

  it("makes a paragraph with line breaks a multi-line row, and drops multiline on other types", () => {
    const para = custom("textarea", "Line one\nLine two");
    const row = changeFieldType(para, "new-1", "text", later);
    expect(mine(row)).toMatchObject({ type: "text", value: "Line one\nLine two", multiline: true });
    expect(mine(changeFieldType(row, "new-1", "email", later))).not.toHaveProperty("multiline");
    expect(mine(changeFieldType(custom("textarea", "One line"), "new-1", "text", later))).not.toHaveProperty("multiline");
  });

  it("turns a height into feet and inches, and lets a catalogue field go back to its own type", () => {
    const { profile } = setup();
    const height = field(profile, "height");
    const set = setFieldValue(profile, height.id, "178", later);
    const asText = changeFieldType(set, height.id, "text", later);
    expect(field(asText, "height")).toMatchObject({ type: "text", value: "5 ft 10 in" });
    // Back to the picker: "5 ft 10 in" isn't centimetres, so it stays as typed (the picker shows it "as typed").
    expect(field(changeFieldType(asText, height.id, "height", later), "height")).toMatchObject({ type: "height", value: "5 ft 10 in" });
  });

  it("drops a picked option's key when it stops being a list, keeping its text", () => {
    const { profile } = setup();
    const rashi = field(profile, "rashi");
    const picked = pickFieldOption(profile, rashi.id, "simha", "Simha", later);
    const text = changeFieldType(picked, rashi.id, "text", later);
    expect(field(text, "rashi")).toEqual({ id: rashi.id, key: "rashi", type: "text", value: "Simha", visible: true });
    expect(field(changeFieldType(text, rashi.id, "select", later), "rashi").type).toBe("select");
    valid(text);
  });

  it("refuses list and height types on fields that aren't catalogue fields of that type, and a no-op type", () => {
    const text = custom("text", "x");
    expect(changeFieldType(text, "new-1", "select", later)).toBe(text);
    expect(changeFieldType(text, "new-1", "height", later)).toBe(text);
    expect(changeFieldType(text, "new-1", "text", later)).toBe(text);
    const { profile } = setup();
    expect(changeFieldType(profile, field(profile, "gotra").id, "height", later)).toBe(profile);
  });

  it("switches a text row between one line and several, only on text rows", () => {
    const { profile } = setup();
    const city = field(profile, "currentCity");
    const multi = setFieldMultiline(profile, city.id, true, later);
    expect(field(multi, "currentCity").multiline).toBe(true);
    expect(field(setFieldMultiline(multi, city.id, false, later), "currentCity")).not.toHaveProperty("multiline");
    expect(setFieldMultiline(profile, city.id, false, later)).toBe(profile);
    expect(setFieldMultiline(profile, field(profile, "dateOfBirth").id, true, later)).toBe(profile);
  });
});

describe("removing and moving fields", () => {
  it("removes a field, and insertField puts it back where it was (Undo)", () => {
    const { profile } = setup();
    const gotra = field(profile, "gotra");
    const at = locateField(profile, gotra.id)!;
    const removed = removeField(profile, gotra.id, later);
    expect(keys(section(removed, "horoscope"))).not.toContain("gotra");
    expect(removed.sections[0]).toBe(profile.sections[0]);
    const undone = insertField(removed, at.section.id, at.index, gotra, later);
    expect(section(undone, "horoscope").fields).toEqual(section(profile, "horoscope").fields);
    expect(insertField(undone, at.section.id, at.index, gotra, later)).toBe(undone);
    expect(removeField(profile, "nope", later)).toBe(profile);
  });

  it("clamps an Undo index when the section has shrunk meanwhile", () => {
    const { profile } = setup();
    const horoscope = section(profile, "horoscope");
    const last = horoscope.fields.at(-1)!;
    let next = removeField(profile, last.id, later);
    next = removeField(next, horoscope.fields[0].id, later);
    next = insertField(next, horoscope.id, 7, last, later);
    expect(section(next, "horoscope").fields.at(-1)).toBe(last);
  });

  it("moves a field up and down within its section, stopping at the ends", () => {
    const { profile } = setup();
    const personal = section(profile, "personal");
    const [first, second] = personal.fields;
    const down = moveField(profile, first.id, 1, later);
    expect(section(down, "personal").fields.slice(0, 2)).toEqual([second, first]);
    expect(moveField(down, first.id, -1, later).sections).toEqual(profile.sections);
    expect(moveField(profile, first.id, -1, later)).toBe(profile);
    expect(moveField(profile, personal.fields.at(-1)!.id, 1, later)).toBe(profile);
  });

  it("moves a field with its value, label and visibility to the end of another section", () => {
    const { profile } = setup();
    const occupation = field(profile, "occupation");
    let next = setFieldValue(profile, occupation.id, "Engineer", later);
    next = renameField(next, occupation.id, "Profession", later);
    next = setFieldVisible(next, occupation.id, false, later);
    const before = field(next, "occupation");
    const personal = section(next, "personal");
    const moved = moveFieldToSection(next, occupation.id, personal.id, later);
    expect(section(moved, "personal").fields.at(-1)).toBe(before);
    expect(keys(section(moved, "career"))).not.toContain("occupation");
    expect(moved.sections[0]).toBe(next.sections[0]);
    valid(moved);
  });

  it("won't move a field to its own section, a relation list or an unknown section", () => {
    const { profile } = setup();
    const gotra = field(profile, "gotra");
    expect(moveFieldToSection(profile, gotra.id, section(profile, "horoscope").id, later)).toBe(profile);
    expect(moveFieldToSection(profile, gotra.id, family(profile).id, later)).toBe(profile);
    expect(moveFieldToSection(profile, gotra.id, "nope", later)).toBe(profile);
    expect(moveFieldToSection(profile, "nope", section(profile, "career").id, later)).toBe(profile);
  });
});

describe("sections", () => {
  it("adds a custom section at the end with the title as typed, and refuses a blank one", () => {
    const { profile, newId } = setup();
    const next = addCustomSection(profile, "Hobbies", newId, later);
    expect(next.sections.at(-1)).toEqual({ id: "new-1", kind: "fields", title: "Hobbies", visible: true, fields: [] });
    expect(addCustomSection(profile, " ", newId, later)).toBe(profile);
    valid(next);
  });

  it("adds References once, as an empty relation list at the end (D44)", () => {
    const { profile, newId } = setup();
    expect(availablePresetSections(profile).map((d) => d.key)).toEqual(["references"]);
    const next = addPresetSection(profile, "references", newId, later);
    expect(next.sections.at(-1)).toEqual({ id: "new-1", kind: "family", key: "references", visible: true, members: [] });
    expect(addPresetSection(next, "references", newId, later)).toBe(next);
    expect(availablePresetSections(next)).toEqual([]);
    expect(addPresetSection(profile, "nonsense", newId, later)).toBe(profile);
  });

  it("offers a removed default section back, without fields that were moved elsewhere", () => {
    const { profile, newId } = setup();
    const horoscope = section(profile, "horoscope");
    let next = moveFieldToSection(profile, field(profile, "gotra").id, section(profile, "religion").id, later);
    next = removeSection(next, horoscope.id, later);
    expect(availablePresetSections(next).map((d) => d.key)).toEqual(["horoscope", "references"]);
    next = addPresetSection(next, "horoscope", newId, later);
    expect(section(next, "horoscope").id).toBe("new-1");
    expect(keys(section(next, "horoscope"))).toEqual(["birthTime", "birthPlace", "rashi", "nakshatra", "nakshatraPada", "maternalGotra", "manglik"]);
    expect(keys(section(next, "religion")).at(-1)).toBe("gotra");
    valid(next);
  });

  it("removes a section with its fields, and insertSection puts it back (Undo)", () => {
    const { profile } = setup();
    const horoscope = section(profile, "horoscope");
    const index = profile.sections.indexOf(horoscope);
    const removed = removeSection(profile, horoscope.id, later);
    expect(removed.sections.map((s) => s.id)).not.toContain(horoscope.id);
    expect(removeSection(profile, "nope", later)).toBe(profile);
    const undone = insertSection(removed, index, horoscope, later);
    expect(undone.sections).toEqual(profile.sections);
    expect(insertSection(undone, index, horoscope, later)).toBe(undone);
  });

  it("moves a section up and down, stopping at the ends", () => {
    const { profile } = setup();
    const [first, second] = profile.sections;
    const up = moveSection(profile, second.id, -1, later);
    expect(up.sections.slice(0, 2)).toEqual([second, first]);
    expect(up.sections[2]).toBe(profile.sections[2]);
    expect(moveSection(profile, first.id, -1, later)).toBe(profile);
    expect(moveSection(profile, profile.sections.at(-1)!.id, 1, later)).toBe(profile);
    expect(moveSection(profile, "nope", 1, later)).toBe(profile);
  });
});

describe("restore default fields", () => {
  it("has nothing to restore in a new draft or a custom section", () => {
    const { profile, newId } = setup();
    for (const s of profile.sections) expect(missingDefaults(profile, s)).toEqual([]);
    const custom = addCustomSection(profile, "Hobbies", newId, later);
    expect(missingDefaults(custom, custom.sections.at(-1)!)).toEqual([]);
    expect(restoreSectionDefaults(custom, "new-1", newId, later)).toBe(custom);
    expect(restoreSectionDefaults(profile, section(profile, "personal").id, newId, later)).toBe(profile);
  });

  it("re-adds removed default fields at their default places, empty and shown", () => {
    const { profile, newId } = setup();
    const personal = section(profile, "personal");
    let next = removeField(profile, field(profile, "fullName").id, later);
    next = removeField(next, field(next, "height").id, later);
    next = removeField(next, field(next, "nativePlace").id, later);
    expect(missingDefaults(next, section(next, "personal"))).toEqual(["fullName", "height", "nativePlace"]);
    const restored = restoreSectionDefaults(next, personal.id, newId, later);
    expect(keys(section(restored, "personal"))).toEqual(keys(personal));
    expect(field(restored, "height")).toEqual({ id: "new-2", key: "height", type: "height", value: "", visible: true });
    valid(restored);
  });

  it("never touches the user's own fields, values, labels, visibility or order", () => {
    const { profile, newId } = setup();
    const personal = section(profile, "personal");
    let next = setFieldValue(profile, field(profile, "fullName").id, "Sai Teja", later);
    next = renameField(next, field(next, "dateOfBirth").id, "Born on", later);
    next = setFieldVisible(next, field(next, "gender").id, false, later);
    next = addCustomField(next, personal.id, { label: "Blood group", type: "text" }, newId, later);
    next = moveField(next, "new-1", -1, later); // the custom field now sits before Native place
    next = moveFieldToSection(next, field(next, "occupation").id, personal.id, later);
    next = removeField(next, field(next, "height").id, later);
    next = removeField(next, field(next, "currentCity").id, later);
    const before = section(next, "personal");

    const restored = restoreSectionDefaults(next, personal.id, newId, later);
    const after = section(restored, "personal");
    expect(keys(after)).toEqual(["fullName", "gender", "dateOfBirth", "height", "maritalStatus", "nationality", "motherTongue", "currentCity", "Blood group", "nativePlace", "occupation"]);
    // Every field that was there is the very same object.
    for (const f of before.fields) expect(after.fields).toContain(f);
    expect(after.fields).toHaveLength(before.fields.length + 2);
    // Other sections are shared, and Occupation (moved here) isn't re-added to Career.
    const career = section(restored, "career");
    expect(career).toBe(section(next, "career"));
    expect(missingDefaults(restored, career)).toEqual([]);
  });

  it("puts a field back before the next default when everything before it was removed", () => {
    const { profile, newId } = setup();
    const horoscope = section(profile, "horoscope");
    let next = removeField(profile, field(profile, "birthTime").id, later);
    next = removeField(next, field(next, "birthPlace").id, later);
    next = addCustomField(next, horoscope.id, { label: "Lagna", type: "text" }, newId, later);
    next = moveField(next, "new-1", -1, later);
    for (let i = 0; i < 6; i++) next = moveField(next, "new-1", -1, later); // custom field first
    const restored = restoreSectionDefaults(next, horoscope.id, newId, later);
    expect(keys(section(restored, "horoscope"))).toEqual(["Lagna", "birthTime", "birthPlace", "rashi", "nakshatra", "nakshatraPada", "gotra", "maternalGotra", "manglik"]);
  });

  it("restores Father and Mother to the family list without touching other relations", () => {
    const { profile, newId } = setup();
    const fam = family(profile);
    const [father, mother] = fam.members;
    const removedFather = { ...profile, sections: profile.sections.map((s) => (s.id === fam.id ? { ...fam, members: [mother] } : s)) };
    expect(missingDefaults(removedFather, family(removedFather))).toEqual(["father"]);
    const restored = restoreSectionDefaults(removedFather, fam.id, newId, later);
    expect(family(restored).members.map((m) => m.relationKey)).toEqual(["father", "mother"]);
    expect(family(restored).members[1]).toBe(mother);
    expect(family(restored).members[0]).toEqual({ ...father, id: "new-1" });
  });

  it("covers every default section", () => {
    const { profile, newId } = setup();
    for (const def of DEFAULT_SECTIONS) {
      if (def.kind !== "fields") continue;
      const s = section(profile, def.key);
      let next = profile;
      for (const f of s.fields) next = removeField(next, f.id, later);
      const restored = restoreSectionDefaults(next, s.id, newId, later);
      expect(keys(section(restored, def.key))).toEqual([...def.fields]);
    }
  });
});
