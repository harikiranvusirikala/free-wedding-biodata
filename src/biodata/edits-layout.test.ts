import { describe, expect, it } from "vitest";
import { profileCompletion } from "./completion";
import { SIMPLE_SECTIONS, createProfile } from "./defaults";
import {
  addCatalogField,
  addCustomField,
  addCustomSection,
  addPresetSection,
  addTraditionFields,
  availablePresetSections,
  changeFieldType,
  missingDefaults,
  moveFieldToSection,
  moveSection,
  pickFieldOption,
  presetFieldKeys,
  removeField,
  removeSection,
  renameField,
  renameSection,
  restoreSectionDefaults,
  setFieldMultiline,
  setFieldValue,
  setFieldVisible,
  setFormLayout,
  setSectionVisible,
  traditionFieldsToAdd,
  undoFormLayout,
  addMember,
} from "./edits";
import { profileSchema } from "./schema";
import type { BiodataProfile, FamilySection, Field, FieldsSection, FormLayout } from "./types";

// Step 2.4: the Simple and Detailed forms (VISION D50). setFormLayout is checked like every edit (immutable on a
// deep-frozen draft, a no-op returns the same profile, the result passes the schema) and, above all, for never
// losing anything typed and for round trips: Simple → Detailed → Simple gives back the very same draft, and
// Detailed → Simple → Detailed the same sections and fields in the same order (empty fields it had to make again
// get new ids, so those are compared without ids).

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

function setup(formLayout: FormLayout = "simple") {
  let n = 0;
  const profile = freeze(createProfile({ newId: () => `id-${++n}`, now: () => CREATED, formLayout }));
  let m = 0;
  const newId = () => `new-${++m}`;
  return { profile, newId };
}

const section = (profile: BiodataProfile, key: string) => profile.sections.find((s) => s.key === key) as FieldsSection;
const family = (profile: BiodataProfile) => profile.sections.find((s) => s.key === "family") as FamilySection;
const allFields = (profile: BiodataProfile) => profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : []));
const field = (profile: BiodataProfile, key: string) => allFields(profile).find((f) => f.key === key) as Field;
const byLabel = (profile: BiodataProfile, label: string) => allFields(profile).find((f) => f.label === label) as Field;
const valid = (profile: BiodataProfile) => expect(profileSchema.safeParse(profile).success).toBe(true);
/** Sections (key or title) with their fields (key or label) or members, in order. */
const outline = (profile: BiodataProfile) =>
  profile.sections.map((s) => [s.key ?? s.title, s.kind === "fields" ? s.fields.map((f) => f.key ?? f.label) : s.members.map((m) => m.relationKey ?? m.relation)]);
/** The draft without ids and timestamps, for comparing drafts whose re-made empty fields have new ids. */
const withoutIds = (profile: BiodataProfile) =>
  JSON.parse(JSON.stringify(profile, (key, value) => (key === "id" || key === "updatedAt" ? undefined : value)));
const sameDraft = (a: BiodataProfile, b: BiodataProfile) => expect({ ...a, updatedAt: "" }).toEqual({ ...b, updatedAt: "" });

const DETAILED_OUTLINE = outline(createProfile({ formLayout: "detailed" }));
const SIMPLE_OUTLINE = outline(createProfile());

describe("setFormLayout: a new draft", () => {
  it("returns the same profile when the draft already has that form", () => {
    const { profile, newId } = setup();
    expect(setFormLayout(profile, "simple", newId, later)).toBe(profile);
    const detailed = setup("detailed").profile;
    expect(setFormLayout(detailed, "detailed", newId, later)).toBe(detailed);
  });

  it("turns a new Simple draft into exactly a new Detailed one, moving the fields Simple placed with their ids", () => {
    const { profile, newId } = setup();
    const next = setFormLayout(profile, "detailed", newId, later);
    expect(outline(next)).toEqual(DETAILED_OUTLINE);
    expect(next.options).toEqual({ ...profile.options, formLayout: "detailed" });
    expect(next.updatedAt).toBe(LATER.toISOString());
    // Moved fields keep their ids; the four Simple sections keep theirs; family is shared untouched.
    for (const key of ["birthTime", "nakshatra", "caste", "highestQualification", "occupation", "annualIncome", "phone", "partnerExpectations"]) {
      expect(field(next, key).id).toBe(field(profile, key).id);
    }
    for (const key of ["personal", "contact", "partnerPreferences"]) expect(section(next, key).id).toBe(section(profile, key).id);
    expect(family(next)).toBe(family(profile));
    valid(next);
  });

  it("turns a new Detailed draft into exactly a new Simple one", () => {
    const { profile, newId } = setup("detailed");
    const next = setFormLayout(profile, "simple", newId, later);
    expect(outline(next)).toEqual(SIMPLE_OUTLINE);
    expect(next.options.formLayout).toBe("simple");
    for (const key of ["fullName", "rashi", "gotra", "occupation", "address"]) expect(field(next, key).id).toBe(field(profile, key).id);
    // Nothing new was needed: every Simple field is a Detailed one.
    expect(JSON.stringify(next)).not.toContain("new-");
    valid(next);
  });

  it("gives back the very same draft after Simple → Detailed → Simple", () => {
    const { profile, newId } = setup();
    const back = setFormLayout(setFormLayout(profile, "detailed", newId, later), "simple", newId, later);
    sameDraft(back, profile);
  });

  it("gives back the same sections and fields after Detailed → Simple → Detailed (re-made empty fields get new ids)", () => {
    const { profile, newId } = setup("detailed");
    const back = setFormLayout(setFormLayout(profile, "simple", newId, later), "detailed", newId, later);
    expect(outline(back)).toEqual(outline(profile));
    expect(withoutIds(back)).toEqual(withoutIds(profile));
    expect(field(back, "fullName").id).toBe(field(profile, "fullName").id);
    expect(field(back, "gender").id).not.toBe(field(profile, "gender").id);
  });
});

/** A Simple draft as someone would fill it: values, a picked option, a rename, a hidden row, own fields and sections. */
function filledSimple() {
  const { profile, newId } = setup();
  let p: BiodataProfile = profile;
  const id = (key: string) => field(p, key).id;
  p = setFieldValue(p, id("fullName"), "Sai Teja Mandapati", later);
  p = setFieldValue(p, id("birthTime"), "06:45", later);
  p = pickFieldOption(p, id("nakshatra"), "magha", "Magha", later);
  p = setFieldValue(p, id("occupation"), "Software Engineer", later);
  p = renameField(p, id("occupation"), "Profession", later);
  p = setFieldValue(p, id("annualIncome"), "₹ 18 lakh per year", later);
  p = setFieldVisible(p, id("annualIncome"), false, later);
  p = setFieldValue(p, id("phone"), "+91 90000 00001", later);
  p = addCustomField(p, section(p, "personal").id, { label: "Blood group", type: "text" }, () => "own-1", later);
  p = setFieldValue(p, "own-1", "B+", later);
  p = addTraditionFields(p, "hinduTelugu", newId, later);
  p = addCustomSection(p, "Hobbies", () => "own-section", later);
  p = addCustomField(p, "own-section", { label: "Music", type: "text" }, () => "own-2", later);
  p = addPresetSection(p, "references", newId, later);
  p = addMember(p, family(p).id, { relationKey: "elderSister", details: "Sravani, Bengaluru" }, newId, later);
  return { profile: freeze(p), newId };
}

/** A Detailed draft with everything the switch must respect. */
function filledDetailed() {
  const { profile, newId } = setup("detailed");
  let p: BiodataProfile = profile;
  const id = (key: string) => field(p, key).id;
  p = setFieldValue(p, id("fullName"), "Sai Teja Mandapati", later);
  p = setFieldValue(p, id("aboutMe"), "Calm and cheerful.", later); // a filled Detailed-only field
  p = setFieldValue(p, id("nationality"), "Indian", later); // a filled Detailed-only field in Personal details
  p = setFieldValue(p, id("employer"), "Example Technologies", later);
  p = renameField(p, id("employer"), "Company", later); // renamed and filled, Detailed only
  p = renameField(p, id("designation"), "Role", later); // renamed but empty, Detailed only
  p = setFieldVisible(p, id("familyType"), false, later); // hidden but empty, Detailed only
  p = renameField(p, id("occupation"), "Profession", later); // renamed, in both forms
  p = setFieldVisible(p, id("annualIncome"), false, later); // hidden, in both forms
  p = pickFieldOption(p, id("rashi"), "simha", "Simha", later);
  p = moveFieldToSection(p, id("nativePlace"), section(p, "contact").id, later); // moved by the user, empty
  p = addCustomField(p, section(p, "personal").id, { label: "Blood group", type: "text" }, () => "own-1", later);
  p = addTraditionFields(p, "hinduTelugu", newId, later); // Intiperu in Personal; Lagnam, Dosham in Horoscope
  p = addTraditionFields(p, "muslim", newId, later); // Sect and Maslak in Religion
  p = addCustomSection(p, "Hobbies", () => "own-section", later);
  p = addPresetSection(p, "references", newId, later);
  return { profile: freeze(p), newId };
}

describe("setFormLayout: a filled draft", () => {
  it("gives back the very same Simple draft after Detailed and back, with everything typed", () => {
    const { profile, newId } = filledSimple();
    const detailed = setFormLayout(profile, "detailed", newId, later);
    valid(detailed);
    const back = setFormLayout(detailed, "simple", newId, later);
    sameDraft(back, profile);
    valid(back);
  });

  it("moves Simple's fields to their Detailed homes with value, label, visibility and option, keeping the rest", () => {
    const { profile, newId } = filledSimple();
    const next = setFormLayout(profile, "detailed", newId, later);
    expect(section(next, "horoscope").fields.map((f) => f.key)).toEqual([
      "birthTime",
      "birthPlace",
      "rashi",
      "nakshatra",
      "nakshatraPada",
      "gotra",
      "maternalGotra",
      "manglik",
      "lagnam", // a chip's fields go to the Detailed home the chip would use, after the defaults
      "dosham",
    ]);
    expect(field(next, "nakshatra")).toEqual(field(profile, "nakshatra"));
    expect(field(next, "occupation")).toEqual(field(profile, "occupation"));
    expect(section(next, "career").fields.find((f) => f.key === "occupation")?.label).toBe("Profession");
    expect(section(next, "career").fields.find((f) => f.key === "annualIncome")).toMatchObject({ visible: false, value: "₹ 18 lakh per year" });
    // Personal details: Detailed's defaults in order, then the user's own field and Intiperu (home in both).
    expect(section(next, "personal").fields.map((f) => f.key ?? f.label)).toEqual([
      "fullName",
      "gender",
      "dateOfBirth",
      "height",
      "maritalStatus",
      "nationality",
      "motherTongue",
      "currentCity",
      "nativePlace",
      "Blood group",
      "intiPeru",
    ]);
    // The user's own section, References and the family members stay as they were.
    expect(next.sections.find((s) => s.title === "Hobbies")).toBe(profile.sections.find((s) => s.title === "Hobbies"));
    expect(next.sections.at(-1)?.key).toBe("references");
    expect(family(next)).toBe(family(profile));
  });

  it("keeps everything typed when going to Simple: filled, renamed, hidden, moved, own and chip fields", () => {
    const { profile, newId } = filledDetailed();
    const next = setFormLayout(profile, "simple", newId, later);
    valid(next);
    expect(outline(next)).toEqual([
      ["aboutMe", ["aboutMe"]],
      [
        "personal",
        [
          "fullName",
          "dateOfBirth",
          "birthTime",
          "birthPlace",
          "nakshatra",
          "rashi",
          "caste",
          "gotra",
          "maternalGotra",
          "height",
          "highestQualification",
          "occupation",
          "annualIncome",
          "nationality",
          "Blood group",
          "intiPeru",
          "muslimSect", // chip fields arrive in section order: Religion's, then Horoscope's
          "maslak",
          "lagnam",
          "dosham",
        ],
      ],
      ["career", ["designation", "employer"]],
      ["family", ["father", "mother"]],
      ["familyBackground", ["familyType"]],
      ["contact", ["phone", "address", "nativePlace"]],
      ["partnerPreferences", ["partnerExpectations"]],
      ["Hobbies", []],
      ["references", []],
    ]);
    expect(field(next, "employer")).toEqual(field(profile, "employer"));
    expect(field(next, "rashi")).toEqual(field(profile, "rashi"));
    expect(field(next, "occupation").label).toBe("Profession");
    expect(field(next, "annualIncome").visible).toBe(false);
    expect(field(next, "familyType").visible).toBe(false);
  });

  it("restores the same sections and fields after Detailed → Simple → Detailed", () => {
    const { profile, newId } = filledDetailed();
    const back = setFormLayout(setFormLayout(profile, "simple", newId, later), "detailed", newId, later);
    valid(back);
    expect(outline(back)).toEqual(outline(profile));
    expect(withoutIds(back)).toEqual(withoutIds(profile));
    // Everything typed, renamed, hidden, moved or added by the user is the same field as before.
    for (const key of ["fullName", "aboutMe", "employer", "designation", "familyType", "occupation", "annualIncome", "rashi", "nativePlace", "lagnam", "muslimSect"]) {
      expect(field(back, key), key).toEqual(field(profile, key));
    }
    expect(byLabel(back, "Blood group")).toEqual(byLabel(profile, "Blood group"));
  });

  it("leaves a field the user moved where they put it, and doesn't add it again", () => {
    let { profile } = setup("detailed");
    const { newId } = setup();
    profile = addCustomSection(profile, "Stars", () => "stars", later);
    profile = moveFieldToSection(profile, field(profile, "rashi").id, "stars", later);
    const next = setFormLayout(profile, "simple", newId, later);
    expect(section(next, "personal").fields.some((f) => f.key === "rashi")).toBe(false);
    expect(next.sections.find((s) => s.id === "stars")).toBe(profile.sections.find((s) => s.id === "stars"));
    expect(setFormLayout(next, "detailed", newId, later).sections.find((s) => s.id === "stars")?.kind).toBe("fields");
  });

  it.each([
    ["a value", (p: BiodataProfile, id: string) => setFieldValue(p, id, "Male", later)],
    ["a picked option", (p: BiodataProfile, id: string) => pickFieldOption(p, id, "male", "Male", later)],
    ["a new label", (p: BiodataProfile, id: string) => renameField(p, id, "Sex", later)],
    ["hiding", (p: BiodataProfile, id: string) => setFieldVisible(p, id, false, later)],
    ["a new type", (p: BiodataProfile, id: string) => changeFieldType(p, id, "text", later)],
    ["several lines", (p: BiodataProfile, id: string) => setFieldMultiline(changeFieldType(p, id, "text", later), id, true, later)],
  ])("keeps a Detailed-only field touched by %s when going to Simple", (_, touch) => {
    const { profile, newId } = setup("detailed");
    const touched = touch(profile, field(profile, "gender").id);
    const next = setFormLayout(touched, "simple", newId, later);
    expect(field(next, "gender")).toEqual(field(touched, "gender"));
    expect(section(next, "personal").fields.map((f) => f.key).slice(0, 3)).toEqual(["fullName", "gender", "dateOfBirth"]);
  });

  it("keeps a field with a note (D44) when going to Simple", () => {
    const { profile, newId } = setup("detailed");
    const alt = field(profile, "alternatePhone");
    const noted: BiodataProfile = {
      ...profile,
      sections: profile.sections.map((s) => (s.key === "contact" && s.kind === "fields" ? { ...s, fields: s.fields.map((f) => (f.id === alt.id ? { ...f, note: "Mother" } : f)) } : s)),
    };
    expect(field(setFormLayout(noted, "simple", newId, later), "alternatePhone").note).toBe("Mother");
  });

  it("keeps renamed, hidden and own empty sections, and every family member, when going to Simple", () => {
    let { profile } = setup("detailed");
    const { newId } = setup();
    for (const key of ["designation", "employer", "employmentType", "workLocation"]) profile = removeField(profile, field(profile, key).id, later);
    profile = renameSection(profile, section(profile, "career").id, "Work", later);
    profile = setSectionVisible(profile, section(profile, "education").id, false, later);
    profile = addMember(profile, family(profile).id, { relation: "Grandmother (Late)" }, newId, later);
    const next = setFormLayout(profile, "simple", newId, later);
    // Career lost its last fields to Personal details but keeps its own name; hidden Education is left as it was.
    expect(section(next, "career")).toMatchObject({ title: "Work", fields: [] });
    expect(section(next, "education")).toBe(section(profile, "education"));
    expect(family(next).members.map((m) => m.relationKey ?? m.relation)).toEqual(["father", "mother", "Grandmother (Late)"]);
    expect(next.sections.some((s) => s.key === "horoscope" || s.key === "religion" || s.key === "aboutMe")).toBe(false);
  });

  it("leaves a hidden section alone both ways, so what prints doesn't change", () => {
    let { profile } = setup("detailed");
    const { newId } = setup();
    profile = freeze(setSectionVisible(profile, section(profile, "horoscope").id, false, later));
    const simple = setFormLayout(profile, "simple", newId, later);
    expect(section(simple, "horoscope")).toBe(section(profile, "horoscope"));
    expect(section(simple, "personal").fields.some((f) => f.key === "birthTime")).toBe(false);
    expect(allFields(simple).filter((f) => f.key === "birthTime")).toHaveLength(1);
    const back = setFormLayout(simple, "detailed", newId, later);
    expect(withoutIds(back)).toEqual(withoutIds(profile));

    let hiddenContact = setup().profile;
    hiddenContact = freeze(setSectionVisible(hiddenContact, section(hiddenContact, "contact").id, false, later));
    const detailed = setFormLayout(hiddenContact, "detailed", newId, later);
    expect(section(detailed, "contact")).toBe(section(hiddenContact, "contact"));
    sameDraft(setFormLayout(detailed, "simple", newId, later), hiddenContact);
  });

  it("adds missing sections of the new form at their default places among the user's own", () => {
    let { profile } = setup();
    const { newId } = setup();
    profile = addCustomSection(profile, "Hobbies", () => "own-section", later);
    profile = moveSection(moveSection(profile, "own-section", -1, later), "own-section", -1, later); // after Family
    profile = addPresetSection(profile, "references", newId, later);
    const next = setFormLayout(profile, "detailed", newId, later);
    expect(next.sections.map((s) => s.key ?? s.title)).toEqual([
      "aboutMe",
      "personal",
      "religion",
      "horoscope",
      "education",
      "career",
      "family",
      "familyBackground",
      "Hobbies",
      "contact",
      "partnerPreferences",
      "references",
    ]);
  });

  it("brings back a Simple section the Detailed draft had removed, with its fields", () => {
    let { profile } = setup("detailed");
    const { newId } = setup();
    profile = removeSection(profile, section(profile, "contact").id, later);
    const next = setFormLayout(profile, "simple", newId, later);
    expect(outline(next)).toEqual(SIMPLE_OUTLINE);
    expect(section(next, "contact").fields.map((f) => f.id)).toEqual(["new-2", "new-3"]); // the section took new-1
  });

  it("adds a Simple field that is nowhere in the draft, empty, at its Simple place", () => {
    let { profile } = setup("detailed");
    const { newId } = setup();
    profile = removeField(profile, field(profile, "caste").id, later);
    const next = setFormLayout(profile, "simple", newId, later);
    expect(outline(next)).toEqual(SIMPLE_OUTLINE);
    expect(field(next, "caste")).toEqual({ id: "new-1", key: "caste", type: "text", value: "", visible: true });
  });
});

describe("undoFormLayout (the toast's Undo)", () => {
  it("puts back the draft exactly as it was, even after a save bumped the revision", () => {
    const { profile, newId } = filledDetailed();
    const after = setFormLayout(profile, "simple", newId, later);
    const saved = { ...after, revision: after.revision + 1 }; // what autosave adopts after writing
    const undone = undoFormLayout(saved, profile, after, newId, later);
    expect(undone.sections).toBe(profile.sections);
    expect(undone.options).toBe(profile.options);
    expect(undone.revision).toBe(saved.revision);
  });

  it("switches back, keeping what was typed after the switch", () => {
    const { profile, newId } = setup();
    const after = setFormLayout(profile, "detailed", newId, later);
    const typed = setFieldValue(after, field(after, "religion").id, "Hindu", later);
    const undone = undoFormLayout(typed, profile, after, newId, later);
    expect(undone.options.formLayout).toBe("simple");
    expect(field(undone, "religion").value).toBe("Hindu");
    expect(outline(undone)).toEqual([SIMPLE_OUTLINE[0], ["religion", ["religion"]], ...SIMPLE_OUTLINE.slice(1)]);
  });
});

describe("the editor's other edits in the Simple form (D50)", () => {
  it("puts a tradition chip's fields in Personal details, skipping what Simple already has", () => {
    const { profile, newId } = setup();
    const personal = section(profile, "personal").id;
    expect(traditionFieldsToAdd(profile, "hinduTelugu")).toEqual([
      { key: "intiPeru", sectionId: personal },
      { key: "lagnam", sectionId: personal },
      { key: "dosham", sectionId: personal },
    ]);
    expect(traditionFieldsToAdd(profile, "sikh")).toEqual([{ key: "sikhPractice", sectionId: personal }]); // Gotra is there
    const next = addTraditionFields(profile, "muslim", newId, later);
    expect(section(next, "personal").fields.slice(-2).map((f) => f.key)).toEqual(["muslimSect", "maslak"]);
    valid(next);
  });

  it("restores Simple's default fields in Personal details, at their Simple places", () => {
    let { profile } = setup();
    const { newId } = setup();
    for (const key of ["caste", "highestQualification"]) profile = removeField(profile, field(profile, key).id, later);
    const personal = section(profile, "personal");
    expect(missingDefaults(profile, personal)).toEqual(["caste", "highestQualification"]);
    const restored = restoreSectionDefaults(profile, personal.id, newId, later);
    expect(section(restored, "personal").fields.map((f) => f.key)).toEqual(SIMPLE_SECTIONS[0].kind === "fields" ? SIMPLE_SECTIONS[0].fields : []);
    // Detailed-only fields (gender…) are not "missing" in Simple.
    expect(missingDefaults(restored, section(restored, "personal"))).toEqual([]);
  });

  it("adds a removed Simple field back at its Simple place, and a Detailed one at the end", () => {
    let { profile } = setup();
    const { newId } = setup();
    profile = removeField(profile, field(profile, "rashi").id, later);
    const personal = section(profile, "personal").id;
    const back = addCatalogField(profile, personal, "rashi", newId, later);
    expect(section(back, "personal").fields.map((f) => f.key).indexOf("rashi")).toBe(5);
    const gender = addCatalogField(back, personal, "gender", newId, later);
    expect(section(gender, "personal").fields.at(-1)?.key).toBe("gender");
  });

  it("offers the Detailed sections Simple doesn't start with, each without fields already in the draft", () => {
    const { profile, newId } = setup();
    const offered = availablePresetSections(profile);
    expect(offered.map((d) => d.key)).toEqual(["aboutMe", "religion", "horoscope", "education", "career", "familyBackground", "references"]);
    const horoscope = offered.find((d) => d.key === "horoscope")!;
    expect(presetFieldKeys(profile, horoscope)).toEqual(["nakshatraPada", "manglik"]);
    const next = addPresetSection(profile, "horoscope", newId, later);
    expect(outline(next).at(-1)).toEqual(["horoscope", ["nakshatraPada", "manglik"]]);
    valid(next);
  });

  it("offers a removed Simple section back with Simple's fields", () => {
    let { profile } = setup();
    const { newId } = setup();
    profile = removeSection(profile, section(profile, "contact").id, later);
    expect(availablePresetSections(profile).find((d) => d.key === "contact")).toEqual({ key: "contact", kind: "fields", fields: ["phone", "address"] });
    expect(outline(addPresetSection(profile, "contact", newId, later)).at(-1)).toEqual(["contact", ["phone", "address"]]);
  });
});

describe("completion in the Simple form", () => {
  it("counts the fields the draft has: Simple's 18 lines, then Detailed's after a switch", () => {
    const { profile, newId } = setup();
    expect(profileCompletion(profile)).toEqual({ filled: 0, total: 18, percent: 0 });
    let p = setFieldValue(profile, field(profile, "fullName").id, "Sai Teja Mandapati", later);
    p = setFieldValue(p, field(p, "phone").id, "+91 90000 00001", later);
    expect(profileCompletion(p)).toEqual({ filled: 2, total: 18, percent: 11 });
    expect(profileCompletion(setFormLayout(p, "detailed", newId, later))).toEqual({ filled: 2, total: 51, percent: 3 });
  });
});
