import { describe, expect, it } from "vitest";
import type { FieldsSection } from "./types";
import {
  DEFAULT_OPTIONS,
  DEFAULT_SECTIONS,
  FIELD_CATALOG,
  OPTION_LISTS,
  QUICK_PICK_SECTIONS,
  RELATION_KEYS,
  SAMPLE_PROFILE,
  SIMPLE_SECTIONS,
  TRADITION_FIELD_SETS,
  createProfile,
  createSampleProfile,
  createSection,
  layoutSections,
  optionsFor,
  type FieldKey,
} from "./defaults";
import { profileSchema } from "./schema";
import type { BiodataProfile, Field } from "./types";

const counter = () => {
  let n = 0;
  return () => `id-${++n}`;
};
const NOW = new Date("2026-11-21T10:00:00.000Z");
const create = () => createProfile({ newId: counter(), now: () => NOW });
const createDetailed = () => createProfile({ newId: counter(), now: () => NOW, formLayout: "detailed" });
const outlineOf = (profile: BiodataProfile) =>
  profile.sections.map((s) => (s.kind === "fields" ? [s.key, s.fields.map((f) => f.key)] : [s.key, s.members.map((m) => m.relationKey)]));

const allFields = (profile: BiodataProfile): Field[] =>
  profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : []));

describe("createProfile", () => {
  it("starts with the Simple form: four sections with the fields most biodatas print (D50)", () => {
    const profile = create();
    expect(profile.options.formLayout).toBe("simple");
    expect(outlineOf(profile)).toEqual([
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
          "complexion",
          "highestQualification",
          "occupation",
          "annualIncome",
        ],
      ],
      ["family", ["father", "mother"]],
      ["contact", ["phone", "address"]],
      ["partnerPreferences", ["partnerExpectations"]],
    ]);
  });

  it("has the default sections and fields of VISION §6 in the D39 reading order in the Detailed form", () => {
    const profile = createDetailed();
    expect(profile.options.formLayout).toBe("detailed");
    expect(outlineOf(profile)).toEqual([
      ["aboutMe", ["aboutMe"]],
      [
        "personal",
        ["fullName", "gender", "dateOfBirth", "height", "complexion", "maritalStatus", "nationality", "motherTongue", "currentCity", "nativePlace"],
      ],
      ["religion", ["religion", "community", "caste", "subCaste"]],
      ["horoscope", ["birthTime", "birthPlace", "rashi", "nakshatra", "nakshatraPada", "gotra", "maternalGotra", "manglik"]],
      ["education", ["highestQualification", "university", "college", "additionalQualifications"]],
      ["career", ["occupation", "designation", "employer", "employmentType", "workLocation", "annualIncome"]],
      ["family", ["father", "mother"]],
      ["familyBackground", ["familyType", "familyValues", "familyOrigin", "residence", "otherFamilyInfo"]],
      ["contact", ["contactPerson", "contactRelation", "phone", "alternatePhone", "email", "address"]],
      [
        "partnerPreferences",
        ["partnerAgeRange", "partnerHeightRange", "partnerEducation", "partnerOccupation", "partnerLocation", "partnerExpectations"],
      ],
    ]);
  });

  it("never stores an age field; Complexion (owner's choice) is a plain typed field right below Height, never preselected", () => {
    const profiles = [create(), createDetailed()];
    for (const profile of profiles) {
      const personal = profile.sections.find((s) => s.key === "personal") as FieldsSection;
      const keys = personal.fields.map((f) => f.key);
      expect(keys[keys.indexOf("height") + 1]).toBe("complexion");
      expect(personal.fields.find((f) => f.key === "complexion")).toMatchObject({ type: "text", value: "", visible: true });
      expect(personal.fields.find((f) => f.key === "complexion")?.optionKey).toBeUndefined();
    }
    expect(FIELD_CATALOG.complexion).toEqual({ type: "text" });
    expect(Object.keys(FIELD_CATALOG).some((k) => /^age$/i.test(k))).toBe(false);
  });

  it("starts every field empty, visible and unlabelled, with nothing picked or inferred", () => {
    for (const field of [...allFields(create()), ...allFields(createDetailed())]) {
      expect(field).toMatchObject({ value: "", visible: true });
      expect(field.label).toBeUndefined();
      expect(field.optionKey).toBeUndefined();
      expect(field.type).toBe(FIELD_CATALOG[field.key as FieldKey].type);
    }
  });

  it("pre-adds Father and Mother as picked relations with empty details (D28)", () => {
    for (const profile of [create(), createDetailed()]) {
      const family = profile.sections.find((s) => s.key === "family");
      expect(family?.kind === "family" && family.members.map((m) => [m.relationKey, m.relation, m.details])).toEqual([
        ["father", "", ""],
        ["mother", "", ""],
      ]);
    }
  });

  it("uses a fresh id for every profile, section, field and member", () => {
    const profile = create();
    const ids = [
      profile.id,
      ...profile.sections.flatMap((s) => [s.id, ...(s.kind === "fields" ? s.fields : s.members).map((x) => x.id)]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(profile.id).toBe("id-1");
  });

  it("uses crypto.randomUUID by default", () => {
    expect(createProfile().id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("starts as an unsaved version 1 draft with the default options", () => {
    const profile = create();
    expect(profile).toMatchObject({
      schemaVersion: 1,
      revision: 0,
      draftName: "",
      docLanguage: "en",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(profile.options).toEqual({
      showAge: false,
      dateFormat: "dd-mm-yyyy",
      heightFormat: "ft-in",
      textSize: "auto",
      labelCase: "normal",
      formLayout: "simple",
      motif: null,
      invocation: "",
    });
    expect(profile.photo).toBeUndefined();
  });

  it("doesn't share the options object between drafts", () => {
    const profile = create();
    profile.options.showAge = true;
    expect(DEFAULT_OPTIONS.showAge).toBe(false);
  });

  it("takes a draft name and document language", () => {
    const profile = createProfile({ newId: counter(), now: () => NOW, draftName: "Mine", docLanguage: "te" });
    expect([profile.draftName, profile.docLanguage]).toEqual(["Mine", "te"]);
    expect(profileSchema.safeParse(profile).success).toBe(true);
  });
});

describe("field catalogue and lists", () => {
  it("gives every select field an option list, and only select fields", () => {
    for (const [key, def] of Object.entries(FIELD_CATALOG)) {
      expect("options" in def, key).toBe(def.type === "select");
    }
  });

  it("has unique keys in every option list and relation list", () => {
    for (const list of [...Object.values(OPTION_LISTS), RELATION_KEYS]) expect(new Set(list).size).toBe(list.length);
    expect(OPTION_LISTS.rashi).toHaveLength(12);
    expect(OPTION_LISTS.nakshatra).toHaveLength(27);
  });

  it("finds options by field key, and none for custom fields", () => {
    expect(optionsFor({ key: "maritalStatus" })).toContain("neverMarried");
    expect(optionsFor({ key: "lagnam" })).toBe(OPTION_LISTS.rashi);
    expect(optionsFor({ key: "fullName" })).toBeUndefined();
    expect(optionsFor({})).toBeUndefined();
    expect(optionsFor({ key: "toString" })).toBeUndefined();
  });

  it("keeps tradition fields out of new drafts and points chips at real sections (D32, D43)", () => {
    const defaultKeys = new Set(allFields(createDetailed()).map((f) => f.key));
    const sectionKeys = new Set(DEFAULT_SECTIONS.map((s) => s.key));
    for (const set of Object.values(TRADITION_FIELD_SETS)) {
      // Each chip adds something a new draft lacks; it may also name a default field (Gotra), skipped if present.
      expect(set.some(({ field }) => !defaultKeys.has(field))).toBe(true);
      expect(set.length).toBeLessThanOrEqual(4);
      for (const { section } of set) expect(sectionKeys.has(section), section).toBe(true);
    }
    const chipOnly = Object.values(TRADITION_FIELD_SETS).flatMap((set) => set.map((e) => e.field)).filter((k) => !defaultKeys.has(k));
    for (const key of chipOnly) expect(DEFAULT_SECTIONS.some((s) => s.kind === "fields" && s.fields.includes(key)), key).toBe(false);
  });

  it("offers References as a quick pick, not a default section (D44)", () => {
    expect(DEFAULT_SECTIONS.some((s) => s.key === "references")).toBe(false);
    const references = createSection(QUICK_PICK_SECTIONS[0], counter());
    expect(references).toEqual({ id: "id-1", kind: "family", key: "references", visible: true, members: [] });
  });

  it("marks the address as a wrapping row", () => {
    const address = allFields(create()).find((f) => f.key === "address");
    expect(address?.multiline).toBe(true);
  });
});

describe("SIMPLE_SECTIONS (D50)", () => {
  const keysOf = (defs: readonly (typeof SIMPLE_SECTIONS)[number][]) => defs.flatMap((d) => (d.kind === "fields" ? d.fields : []));

  it("uses only Detailed section keys, in the Detailed reading order, so headings print from the same dictionaries", () => {
    const detailed = DEFAULT_SECTIONS.map((d) => d.key);
    const simple = SIMPLE_SECTIONS.map((d) => d.key);
    expect(simple).toEqual(["personal", "family", "contact", "partnerPreferences"]);
    expect(simple.map((key) => detailed.indexOf(key))).toEqual([...simple.map((key) => detailed.indexOf(key))].sort((a, b) => a - b));
    for (const def of SIMPLE_SECTIONS) expect(DEFAULT_SECTIONS.find((d) => d.key === def.key)?.kind).toBe(def.kind);
  });

  it("holds only Detailed default fields, each once, with Complexion right below Height", () => {
    const simple = keysOf(SIMPLE_SECTIONS);
    const detailed = new Set(keysOf(DEFAULT_SECTIONS));
    expect(new Set(simple).size).toBe(simple.length);
    for (const key of simple) expect(detailed.has(key), key).toBe(true);
    expect(simple[simple.indexOf("height") + 1]).toBe("complexion");
  });

  it("keeps fields that share a section in both forms in the same relative order", () => {
    for (const def of SIMPLE_SECTIONS) {
      if (def.kind !== "fields") continue;
      const detailed = DEFAULT_SECTIONS.find((d) => d.key === def.key);
      const order = detailed?.kind === "fields" ? detailed.fields : [];
      const shared = def.fields.filter((key) => order.includes(key));
      expect(shared).toEqual(order.filter((key) => shared.includes(key)));
    }
  });

  it("is what layoutSections gives for each form", () => {
    expect(layoutSections("simple")).toBe(SIMPLE_SECTIONS);
    expect(layoutSections("detailed")).toBe(DEFAULT_SECTIONS);
  });
});

describe("SAMPLE_PROFILE", () => {
  it("passes the schema", () => {
    expect(profileSchema.parse(SAMPLE_PROFILE)).toEqual(SAMPLE_PROFILE);
  });

  it("is a Detailed draft, the full showcase (D50)", () => {
    expect(SAMPLE_PROFILE.options.formLayout).toBe("detailed");
    expect(createSampleProfile().options.formLayout).toBe("detailed");
    for (const def of DEFAULT_SECTIONS) expect(SAMPLE_PROFILE.sections.some((s) => s.key === def.key), def.key).toBe(true);
  });

  it("is the fictional Sai Teja Mandapati", () => {
    expect(allFields(SAMPLE_PROFILE).find((f) => f.key === "fullName")?.value).toBe("Sai Teja Mandapati");
    expect(allFields(SAMPLE_PROFILE).find((f) => f.key === "address")?.value).toContain("Plot 12, Sample Colony, Guntur");
  });

  it("only uses phone numbers in the unassigned +91 90000 0000x range", () => {
    const text = JSON.stringify(SAMPLE_PROFILE);
    const candidates = text.match(/\+?\d[\d\s-]{6,}\d/g) ?? [];
    const phones = candidates.map((c) => c.replace(/\D/g, "")).filter((digits) => digits.length >= 10);
    expect(phones.length).toBeGreaterThanOrEqual(3);
    for (const digits of phones) expect(digits).toMatch(/^(91)?900000000\d$/);
  });

  it("fills every default field except the community details", () => {
    const empty = allFields(SAMPLE_PROFILE)
      .filter((f) => f.value === "")
      .map((f) => f.key);
    expect(empty).toEqual(["complexion", "community", "caste", "subCaste", "otherFamilyInfo"]);
  });

  it("shows picked options, a renamed label, a custom field, a hidden field and references", () => {
    const fields = allFields(SAMPLE_PROFILE);
    expect(fields.find((f) => f.key === "maritalStatus")).toMatchObject({ optionKey: "neverMarried" });
    expect(fields.find((f) => f.key === "employer")?.label).toBe("Company");
    expect(fields.find((f) => f.label === "Blood group")?.key).toBeUndefined();
    expect(fields.find((f) => f.key === "annualIncome")?.visible).toBe(false);
    expect(fields.find((f) => f.key === "alternatePhone")?.note).toBe("Mother");
    expect(SAMPLE_PROFILE.sections.at(-1)?.key).toBe("references");
  });

  it("can't be changed by accident", () => {
    expect(Object.isFrozen(SAMPLE_PROFILE.sections[0])).toBe(true);
    expect(Object.isFrozen(structuredClone(SAMPLE_PROFILE))).toBe(false);
  });
});

describe("createSampleProfile (Open a sample)", () => {
  const ids = (profile: BiodataProfile) => [
    profile.id,
    ...profile.sections.flatMap((s) => [s.id, ...(s.kind === "fields" ? s.fields.map((f) => f.id) : s.members.map((m) => m.id))]),
  ];

  it("is a new, never-saved draft with the sample's content and fresh ids everywhere", () => {
    const sample = createSampleProfile({ newId: counter(), now: () => NOW });
    expect(profileSchema.parse(sample)).toEqual(sample);
    expect(sample.revision).toBe(0);
    expect(sample.createdAt).toBe(NOW.toISOString());
    expect(sample.updatedAt).toBe(NOW.toISOString());
    expect(sample.draftName).toBe(SAMPLE_PROFILE.draftName);
    const fresh = ids(sample);
    expect(new Set(fresh).size).toBe(fresh.length);
    for (const id of ids(SAMPLE_PROFILE)) expect(fresh).not.toContain(id);
    // The same content in the same order, ids aside.
    const strip = (profile: BiodataProfile) => JSON.parse(JSON.stringify(profile, (key, value) => (key === "id" || key === "createdAt" || key === "updatedAt" ? undefined : value)));
    expect(strip(sample)).toEqual(strip(SAMPLE_PROFILE));
  });

  it("is a copy: changing it leaves the shared sample alone, and two copies never share ids", () => {
    const a = createSampleProfile();
    const b = createSampleProfile();
    (a.sections[0] as { title?: string }).title = "Changed";
    expect(SAMPLE_PROFILE.sections[0].title).toBeUndefined();
    expect(ids(a).some((id) => ids(b).includes(id))).toBe(false);
  });
});
