import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTIONS,
  DEFAULT_SECTIONS,
  FIELD_CATALOG,
  OPTION_LISTS,
  QUICK_PICK_SECTIONS,
  RELATION_KEYS,
  SAMPLE_PROFILE,
  TRADITION_FIELD_SETS,
  createProfile,
  createSection,
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

const allFields = (profile: BiodataProfile): Field[] =>
  profile.sections.flatMap((s) => (s.kind === "fields" ? s.fields : []));

describe("createProfile", () => {
  it("has the default sections and fields of VISION §6 in the D39 reading order", () => {
    const outline = create().sections.map((s) =>
      s.kind === "fields" ? [s.key, s.fields.map((f) => f.key)] : [s.key, s.members.map((m) => m.relationKey)],
    );
    expect(outline).toEqual([
      ["aboutMe", ["aboutMe"]],
      [
        "personal",
        ["fullName", "gender", "dateOfBirth", "height", "maritalStatus", "nationality", "motherTongue", "currentCity", "nativePlace"],
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

  it("never adds a complexion or stored age field", () => {
    const keys = allFields(create()).map((f) => f.key?.toLowerCase());
    expect(keys.some((k) => k?.includes("complexion") || k === "age")).toBe(false);
    expect(Object.keys(FIELD_CATALOG).some((k) => /complexion|^age$/i.test(k))).toBe(false);
  });

  it("starts every field empty, visible and unlabelled, with nothing picked or inferred", () => {
    for (const field of allFields(create())) {
      expect(field).toMatchObject({ value: "", visible: true });
      expect(field.label).toBeUndefined();
      expect(field.optionKey).toBeUndefined();
      expect(field.type).toBe(FIELD_CATALOG[field.key as FieldKey].type);
    }
  });

  it("pre-adds Father and Mother as picked relations with empty details (D28)", () => {
    const family = create().sections.find((s) => s.key === "family");
    expect(family?.kind === "family" && family.members.map((m) => [m.relationKey, m.relation, m.details])).toEqual([
      ["father", "", ""],
      ["mother", "", ""],
    ]);
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
    const defaultKeys = new Set(allFields(create()).map((f) => f.key));
    const sectionKeys = new Set(DEFAULT_SECTIONS.map((s) => s.key));
    for (const set of Object.values(TRADITION_FIELD_SETS)) {
      for (const { section, field } of set) {
        expect(defaultKeys.has(field), field).toBe(false);
        expect(sectionKeys.has(section), section).toBe(true);
      }
    }
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

describe("SAMPLE_PROFILE", () => {
  it("passes the schema", () => {
    expect(profileSchema.parse(SAMPLE_PROFILE)).toEqual(SAMPLE_PROFILE);
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
    expect(empty).toEqual(["community", "caste", "subCaste", "otherFamilyInfo"]);
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
